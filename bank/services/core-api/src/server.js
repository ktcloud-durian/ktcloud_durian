import { loadConfig } from './config.js';
import { createPool } from './db.js';
import { createRepo } from './repo.js';
import { createApp } from './app.js';
import { seedIfEmpty } from './seed.js';

const cfg = loadConfig();
const pool = createPool(cfg.db);
const repo = createRepo(pool);

async function waitForDb(tries = 30) {
  for (let i = 1; i <= tries; i++) {
    try { await repo.ping(); return; } catch { await new Promise((r) => setTimeout(r, 2000)); }
  }
  throw new Error('DB 연결 실패');
}

await waitForDb();
if (cfg.seedDemo && (await seedIfEmpty(pool, cfg.demoPassword))) {
  console.log(JSON.stringify({ svc: 'core-api', event: 'seeded_demo_customers' }));
}
createApp({ repo, serviceToken: cfg.serviceToken }).listen(cfg.port, () => {
  console.log(JSON.stringify({ svc: 'core-api', event: 'listening', port: cfg.port }));
});
