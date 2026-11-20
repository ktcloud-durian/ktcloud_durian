import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';

const SECRET = 'test-secret-'.padEnd(48, 'x');
const config = { jwtSecret: SECRET, jwtTtlMin: 10, cookieSecure: false, showBreachBanner: true, servedFrom: 'AWS 서울 리전' };
const ACCOUNTS = { 1: '101-2034-5678', 2: '101-2034-6789' };

// 온프렘 core-api 흉내: 본인 계좌가 아니면 403
const core = {
  login: async (u, p) => (u === 'kimfake' && p === 'right-password' ? { status: 200, data: { customerId: 1, name: '김가짜' } }
    : u === 'locked' ? { status: 423, data: {} } : { status: 401, data: {} }),
  summary: async (id) => ({ status: 200, data: { name: id === 1 ? '김가짜' : '이예시', phone: '010-1111-2222', accounts: [{ accountNo: ACCOUNTS[id], product: '입출금', balance: 3200000 }] } }),
  transactions: async (acc, id) => (ACCOUNTS[id] === acc ? { status: 200, data: { account: { accountNo: acc, balance: 1 }, items: [] } } : { status: 403, data: { error: 'forbidden' } }),
  transfer: async () => ({ status: 200, data: { balance: 1 } }),
};

let server, base;
before(async () => {
  server = createApp({ config, core }).listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

const req = (path, opts = {}) => fetch(base + path, { headers: { 'content-type': 'application/json', ...(opts.headers || {}) }, ...opts });
const sign = (payload, key = SECRET, extra = {}) => jwt.sign(payload, key, { algorithm: 'HS256', issuer: 'durian-web', audience: 'durian-bank', expiresIn: '5m', ...extra });

test('로그인 성공 → httpOnly·SameSite=Strict 쿠키 발급', async () => {
  const r = await req('/api/login', { method: 'POST', body: JSON.stringify({ username: 'kimfake', password: 'right-password' }) });
  assert.equal(r.status, 200);
  const c = r.headers.get('set-cookie');
  assert.match(c, /durian_session=/); assert.match(c, /HttpOnly/); assert.match(c, /SameSite=Strict/);
});

test('비밀번호 틀림 → 401, 잠긴 계정 → 423', async () => {
  assert.equal((await req('/api/login', { method: 'POST', body: JSON.stringify({ username: 'kimfake', password: 'x' }) })).status, 401);
  assert.equal((await req('/api/login', { method: 'POST', body: JSON.stringify({ username: 'locked', password: 'x' }) })).status, 423);
});

test('토큰 없음 → 401 (접근 거부 화면)', async () => {
  assert.equal((await req('/api/me')).status, 401);
});

test('본인 계좌 조회 → 200, 전화번호는 가려서', async () => {
  const t = sign({ sub: '1', name: '김가짜' });
  const me = await (await req('/api/me', { headers: { authorization: `Bearer ${t}` } })).json();
  assert.equal(me.phone, '010-****-2222');
  assert.equal((await req('/api/accounts/101-2034-5678/transactions', { headers: { authorization: `Bearer ${t}` } })).status, 200);
});

test('남의 계좌 조회 → 403 (본인 계좌만)', async () => {
  const t = sign({ sub: '1', name: '김가짜' });
  const r = await req('/api/accounts/101-2034-6789/transactions', { headers: { authorization: `Bearer ${t}` } });
  assert.equal(r.status, 403);
});

test('[쿠팡 장면] 다른 키로 위조한 토큰 → 401', async () => {
  const forged = sign({ sub: '2', name: '이예시' }, 'leaked-old-key'.padEnd(48, 'z'));
  assert.equal((await req('/api/me', { headers: { authorization: `Bearer ${forged}` } })).status, 401);
});

test('alg:none 토큰, 만료 토큰, 다른 발급자 토큰 → 401', async () => {
  const none = jwt.sign({ sub: '1' }, '', { algorithm: 'none', issuer: 'durian-web', audience: 'durian-bank' });
  const expired = sign({ sub: '1' }, SECRET, { expiresIn: -10 });
  const otherIss = jwt.sign({ sub: '1' }, SECRET, { algorithm: 'HS256', issuer: 'evil', audience: 'durian-bank' });
  for (const t of [none, expired, otherIss]) {
    assert.equal((await req('/api/me', { headers: { authorization: `Bearer ${t}` } })).status, 401);
  }
});

test('잘못된 계좌번호 형식 → 400', async () => {
  const t = sign({ sub: '1' });
  assert.equal((await req("/api/accounts/1' OR '1'='1/transactions", { headers: { authorization: `Bearer ${t}` } })).status, 400);
});

test('설정: 유출 안내 띠 켜기/끄기, 보안 헤더', async () => {
  const r = await req('/api/config');
  assert.equal((await r.json()).showBreachBanner, true);
  assert.ok(r.headers.get('content-security-policy'));
  assert.equal(r.headers.get('x-powered-by'), null);
});

test('세션 연장 → 새 쿠키, 로그인 안 했으면 401', async () => {
  assert.equal((await req('/api/session/extend', { method: 'POST' })).status, 401);
  const t = sign({ sub: '1', name: '김가짜' });
  const r = await req('/api/session/extend', { method: 'POST', headers: { authorization: `Bearer ${t}` } });
  assert.equal(r.status, 200);
  assert.match(r.headers.get('set-cookie'), /durian_session=/);
  const me = await (await req('/api/me', { headers: { authorization: `Bearer ${t}` } })).json();
  assert.ok(me.sessionExpiresAt > Date.now());
});
