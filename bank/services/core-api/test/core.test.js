import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { createApp } from '../src/app.js';

const TOKEN = 'service-token-'.padEnd(40, 's');
const hash = bcrypt.hashSync('right-password', 4);
const state = { failed: 0, locked: false, audits: [] };

// DB 대신 메모리 저장소
const repo = {
  ping: async () => {},
  findCustomerByUsername: async (u) => (u === 'kimfake' ? { id: 1, password_hash: hash, name: '김가짜', is_locked: state.locked ? 1 : 0 } : null),
  recordLoginFailure: async () => { state.failed += 1; if (state.failed >= 5) state.locked = true; },
  recordLoginSuccess: async () => { state.failed = 0; },
  getCustomerSummary: async (id) => (id === 1 ? { id: 1, name: '김가짜', phone: '010-1111-2222', accounts: [] } : null),
  getAccountForCustomer: async (acc, id) => (acc === '101-2034-5678' && id === 1 ? { id: 10, accountNo: acc, product: 'p', holder: '김가짜', balance: 5 } : null),
  listTransactions: async () => [],
  transfer: async () => ({ balance: 1 }),
  audit: async (a) => state.audits.push(a),
};

let server, base;
before(async () => {
  server = createApp({ repo, serviceToken: TOKEN }).listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

const call = (path, { token = TOKEN, method = 'GET', body } = {}) =>
  fetch(base + path, { method, headers: { 'content-type': 'application/json', 'x-service-token': token }, body: body && JSON.stringify(body) });

test('서비스 토큰 없거나 틀리면 내부 API 거부', async () => {
  assert.equal((await call('/internal/customers/1/summary', { token: '' })).status, 401);
  assert.equal((await call('/internal/customers/1/summary', { token: 'wrong'.padEnd(40, 'w') })).status, 401);
  assert.equal((await call('/internal/customers/1/summary')).status, 200);
});

test('로그인 성공·실패, 없는 아이디도 같은 401', async () => {
  assert.equal((await call('/internal/auth/login', { method: 'POST', body: { username: 'kimfake', password: 'right-password' } })).status, 200);
  assert.equal((await call('/internal/auth/login', { method: 'POST', body: { username: 'nobody', password: 'x' } })).status, 401);
});

test('5회 실패하면 잠금(423), 맞는 비밀번호여도 잠금 유지', async () => {
  for (let i = 0; i < 5; i++) await call('/internal/auth/login', { method: 'POST', body: { username: 'kimfake', password: 'wrong' } });
  const r = await call('/internal/auth/login', { method: 'POST', body: { username: 'kimfake', password: 'right-password' } });
  assert.equal(r.status, 423);
  state.locked = false; state.failed = 0;
});

test('남의 계좌 거래내역 → 403 + 감사 기록', async () => {
  const r = await call('/internal/accounts/101-2034-6789/transactions?customerId=1');
  assert.equal(r.status, 403);
  assert.ok(state.audits.some((a) => a.action === 'view_transactions' && a.result === 'forbidden'));
});

test('입력값 검증: 계좌번호·날짜 형식, 이체 금액', async () => {
  assert.equal((await call('/internal/accounts/abc/transactions?customerId=1')).status, 400);
  assert.equal((await call('/internal/accounts/101-2034-5678/transactions?customerId=1&from=2026-01-01;DROP')).status, 400);
  assert.equal((await call('/internal/transfers', { method: 'POST', body: { customerId: 1, fromAccount: '101-2034-5678', toAccount: '101-2034-6789', amount: -5 } })).status, 400);
});

test('/health 는 인증 없이, 오류 응답에 스택 없음', async () => {
  assert.equal((await fetch(base + '/health')).status, 200);
});
