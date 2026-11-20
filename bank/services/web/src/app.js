import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { COOKIE, createAuth, requireLogin } from './auth.js';
import { maskName, maskPhone } from './mask.js';

const PUBLIC_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const ACCOUNT_NO = /^\d{3}-\d{4}-\d{4}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function log(entry) {
  console.log(JSON.stringify({ t: new Date().toISOString(), svc: 'web', ...entry }));
}

export function createApp({ config, core }) {
  const auth = createAuth(config);
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1); // ALB 뒤에서 실제 접속 IP를 씀
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        'default-src': ["'self'"],
        'img-src': ["'self'", 'data:'],
        'font-src': ["'self'"], // 글꼴도 우리 서버에서만 (외부 CDN 안 씀)
        'style-src': ["'self'", "'unsafe-inline'"], // React의 style 속성용
        'connect-src': ["'self'"],
        'upgrade-insecure-requests': config.cookieSecure ? [] : null, // 로컬 http 시연에서는 끔
      },
    },
  }));
  app.use(express.json({ limit: '10kb' }));
  app.use(cookieParser());

  const ip = (req) => req.ip;
  const cookieOpts = { httpOnly: true, sameSite: 'strict', secure: config.cookieSecure, path: '/', maxAge: config.jwtTtlMin * 60_000 };

  app.get('/health', (_req, res) => res.json({ status: 'ok' }));

  app.get('/api/config', (_req, res) => {
    res.json({ showBreachBanner: config.showBreachBanner, servedFrom: config.servedFrom });
  });

  // 로그인 시도 제한: IP당 1분에 10번 (계정별 5회 잠금은 core-api가 DB로 관리)
  const loginLimiter = rateLimit({ windowMs: 60_000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false,
    message: { error: 'too_many_requests' } });

  app.post('/api/login', loginLimiter, async (req, res) => {
    const { username, password } = req.body || {};
    if (typeof username !== 'string' || typeof password !== 'string') return res.status(400).json({ error: 'invalid_input' });
    const r = await core.login(username, password, ip(req));
    if (r.status === 423) return res.status(423).json({ error: 'locked', message: '로그인 5회 실패로 15분간 이용이 제한됩니다.' });
    if (r.status !== 200) {
      log({ event: 'login_failed', ip: ip(req) });
      return res.status(401).json({ error: 'invalid_credentials', message: '아이디 또는 비밀번호가 올바르지 않습니다.' });
    }
    res.cookie(COOKIE, auth.sign(r.data), cookieOpts);
    log({ event: 'login_ok', customerId: r.data.customerId });
    res.json({ name: r.data.name });
  });

  app.post('/api/logout', (_req, res) => {
    res.clearCookie(COOKIE, { ...cookieOpts, maxAge: undefined });
    res.json({ ok: true });
  });

  const login = requireLogin(auth);

  app.get('/api/me', login, async (req, res) => {
    const r = await core.summary(req.customerId);
    if (r.status !== 200) return res.status(r.status === 404 ? 401 : 502).json({ error: 'unavailable' });
    res.json({
      name: r.data.name,
      phone: maskPhone(r.data.phone),
      sessionExpiresAt: req.sessionExp,
      accounts: r.data.accounts.map((a) => ({ ...a, balance: Number(a.balance) })),
    });
  });

  // 자동로그아웃 '연장' 버튼: 유효한 토큰일 때만 같은 사용자로 새 토큰 발급
  app.post('/api/session/extend', login, (req, res) => {
    res.cookie(COOKIE, auth.sign({ customerId: req.customerId, name: req.customerName }), cookieOpts);
    res.json({ sessionExpiresAt: Date.now() + config.jwtTtlMin * 60_000 });
  });

  app.get('/api/accounts/:accountNo/transactions', login, async (req, res) => {
    const { accountNo } = req.params;
    const q = {};
    if (typeof req.query.from === 'string' && DATE.test(req.query.from)) q.from = req.query.from;
    if (typeof req.query.to === 'string' && DATE.test(req.query.to)) q.to = req.query.to;
    if (['all', 'deposit', 'withdraw'].includes(req.query.type)) q.type = req.query.type;
    if (!ACCOUNT_NO.test(accountNo)) return res.status(400).json({ error: 'invalid_input' });

    // 토큰 주인의 계좌만 조회 (쿠팡 사례: 이 확인이 없으면 남의 계좌가 보임)
    const r = await core.transactions(accountNo, req.customerId, q, ip(req));
    if (r.status === 403) {
      log({ event: 'forbidden_account_access', customerId: req.customerId });
      return res.status(403).json({ error: 'forbidden', message: '본인 명의 계좌만 조회할 수 있습니다.' });
    }
    if (r.status !== 200) return res.status(502).json({ error: 'unavailable' });
    res.json(r.data);
  });

  app.post('/api/transfer', login, async (req, res) => {
    const { fromAccount, toAccount, amount, memo } = req.body || {};
    const r = await core.transfer({ customerId: req.customerId, fromAccount, toAccount, amount: Number(amount), memo }, ip(req));
    if (r.status === 200) return res.json(r.data);
    const messages = {
      forbidden: '본인 명의 계좌에서만 이체할 수 있습니다.',
      to_account_not_found: '받는 계좌를 찾을 수 없습니다.',
      insufficient_balance: '잔액이 부족합니다.',
      same_account: '같은 계좌로는 이체할 수 없습니다.',
      invalid_input: '입력값을 확인해 주세요.',
    };
    const code = r.data?.error;
    res.status([400, 403, 404].includes(r.status) ? r.status : 502).json({ error: code || 'unavailable', message: messages[code] || '잠시 후 다시 시도해 주세요.' });
  });

  // 개발자 확인용이 아니라 고객이 보는 정보만: 응답 서버 표시용 (이름은 가림)
  app.get('/api/whoami', login, (req, res) => res.json({ name: maskName(req.customerName) }));

  // 화면(정적 파일) + SPA 새로고침 대응
  app.use(express.static(PUBLIC_DIR, { index: 'index.html', maxAge: '1h' }));
  app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(path.join(PUBLIC_DIR, 'index.html')));

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    log({ event: 'error', message: err.message });
    res.status(500).json({ error: 'internal_error' });
  });

  return app;
}
