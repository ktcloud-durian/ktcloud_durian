import crypto from 'node:crypto';
import express from 'express';
import helmet from 'helmet';
import bcrypt from 'bcryptjs';

// 사용자가 없을 때도 비밀번호 비교 시간을 똑같이 들여서, 응답 시간으로 아이디 존재 여부를 알 수 없게 함
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

const ACCOUNT_NO = /^\d{3}-\d{4}-\d{4}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function log(entry) {
  // 구조화 로그 (JSON 한 줄). 비밀번호·토큰·전화번호는 남기지 않음 (SEC-02)
  console.log(JSON.stringify({ t: new Date().toISOString(), svc: 'core-api', ...entry }));
}

export function createApp({ repo, serviceToken }) {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(express.json({ limit: '10kb' }));

  app.get('/health', async (_req, res) => {
    try {
      await repo.ping();
      res.json({ status: 'ok' });
    } catch {
      res.status(503).json({ status: 'db_unavailable' });
    }
  });

  // 내부 API는 web 서비스만 호출: 서비스 토큰(Secret으로 주입) + 네트워크(Tailscale ACL·NetworkPolicy)로 이중 제한
  app.use('/internal', (req, res, next) => {
    if (!safeEqual(req.get('x-service-token') || '', serviceToken)) {
      log({ event: 'service_auth_failed', path: req.path });
      return res.status(401).json({ error: 'unauthorized' });
    }
    next();
  });

  const clientIp = (req) => (req.get('x-client-ip') || '').slice(0, 45) || null;

  app.post('/internal/auth/login', async (req, res) => {
    const { username, password } = req.body || {};
    if (typeof username !== 'string' || typeof password !== 'string' || !username || username.length > 40 || password.length > 100) {
      return res.status(400).json({ error: 'invalid_input' });
    }
    const user = await repo.findCustomerByUsername(username);
    const ok = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);
    if (user && Number(user.is_locked)) {
      await repo.audit({ customerId: user.id, action: 'login', clientIp: clientIp(req), result: 'locked' });
      return res.status(423).json({ error: 'locked' });
    }
    if (!user || !ok) {
      if (user) await repo.recordLoginFailure(user.id);
      await repo.audit({ customerId: user ? user.id : null, action: 'login', clientIp: clientIp(req), result: 'failed' });
      log({ event: 'login_failed', known_user: Boolean(user) });
      return res.status(401).json({ error: 'invalid_credentials' });
    }
    await repo.recordLoginSuccess(user.id);
    await repo.audit({ customerId: user.id, action: 'login', clientIp: clientIp(req), result: 'ok' });
    res.json({ customerId: user.id, name: user.name });
  });

  app.get('/internal/customers/:id/summary', async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'invalid_input' });
    const s = await repo.getCustomerSummary(id);
    if (!s) return res.status(404).json({ error: 'not_found' });
    res.json(s);
  });

  app.get('/internal/accounts/:accountNo/transactions', async (req, res) => {
    const { accountNo } = req.params;
    const customerId = Number(req.query.customerId);
    const to = typeof req.query.to === 'string' ? req.query.to : new Date().toISOString().slice(0, 10);
    const from = typeof req.query.from === 'string' ? req.query.from : new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
    const type = ['all', 'deposit', 'withdraw'].includes(req.query.type) ? req.query.type : 'all';
    if (!ACCOUNT_NO.test(accountNo) || !Number.isInteger(customerId) || !DATE.test(from) || !DATE.test(to)) {
      return res.status(400).json({ error: 'invalid_input' });
    }
    // 본인 계좌인지 DB에서 다시 확인 (web에서 확인했더라도 한 번 더, 방어 계층)
    const account = await repo.getAccountForCustomer(accountNo, customerId);
    if (!account) {
      await repo.audit({ customerId, action: 'view_transactions', accountNo, clientIp: clientIp(req), result: 'forbidden' });
      log({ event: 'forbidden_account_access', customerId });
      return res.status(403).json({ error: 'forbidden' });
    }
    const items = await repo.listTransactions(account.id, { from, to, type, limit: 100 });
    await repo.audit({ customerId, action: 'view_transactions', accountNo, clientIp: clientIp(req), result: 'ok' });
    res.json({
      account: { accountNo: account.accountNo, product: account.product, holder: account.holder, balance: Number(account.balance) },
      items: items.map((t) => ({ ...t, withdraw: Number(t.withdraw), deposit: Number(t.deposit), balanceAfter: Number(t.balanceAfter) })),
    });
  });

  app.post('/internal/transfers', async (req, res) => {
    const { customerId, fromAccount, toAccount, amount, memo } = req.body || {};
    const amt = Number(amount);
    if (!Number.isInteger(customerId) || !ACCOUNT_NO.test(fromAccount || '') || !ACCOUNT_NO.test(toAccount || '') ||
        !Number.isInteger(amt) || amt <= 0 || amt > 10_000_000 || (memo && (typeof memo !== 'string' || memo.length > 20))) {
      return res.status(400).json({ error: 'invalid_input' });
    }
    try {
      const r = await repo.transfer({ customerId, fromAccount, toAccount, amount: amt, memo: memo || '이체' });
      await repo.audit({ customerId, action: 'transfer', accountNo: fromAccount, clientIp: clientIp(req), result: 'ok' });
      res.json(r);
    } catch (e) {
      await repo.audit({ customerId, action: 'transfer', accountNo: fromAccount, clientIp: clientIp(req), result: e.message });
      res.status(e.status || 500).json({ error: e.status ? e.message : 'internal_error' });
    }
  });

  // 오류 내용(스택 등)은 응답에 넣지 않음
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    log({ event: 'error', message: err.message });
    res.status(500).json({ error: 'internal_error' });
  });

  return app;
}
