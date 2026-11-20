import { loadConfig } from './config.js';
import { createCoreClient } from './core-client.js';
import { createApp } from './app.js';

const config = loadConfig();
const core = createCoreClient(config);
createApp({ config, core }).listen(config.port, () => {
  console.log(JSON.stringify({ svc: 'web', event: 'listening', port: config.port }));
});
