import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from '../src/config.js';

const base = { CORE_API_URL: 'http://core-api:4000', SERVICE_TOKEN: 's'.repeat(32), JWT_SECRET: 'j'.repeat(32) };
function withEnv(extra, fn) {
  const saved = { ...process.env };
  Object.assign(process.env, base, extra);
  try { return fn(); } finally { process.env = saved; }
}

test('TRUST_PROXY_HOPS: 없으면 1 (로컬·ALB 직결)', () => {
  withEnv({ TRUST_PROXY_HOPS: '' }, () => assert.equal(loadConfig().trustProxyHops, 1));
});

test('TRUST_PROXY_HOPS: k3s(ALB → Traefik)는 2', () => {
  withEnv({ TRUST_PROXY_HOPS: '2' }, () => assert.equal(loadConfig().trustProxyHops, 2));
});

test('TRUST_PROXY_HOPS: 너무 크면 3으로 막음 (헤더로 IP 속이기 방지)', () => {
  withEnv({ TRUST_PROXY_HOPS: '99' }, () => assert.equal(loadConfig().trustProxyHops, 3));
});
