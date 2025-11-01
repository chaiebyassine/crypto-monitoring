import { createServer } from './api/server.js';
import { env } from './config/env.js';

async function main() {
  const app = createServer();
  app.listen(env.port, () => {
    console.log(`[api] listening on http://localhost:${env.port}`);
  });
}

main().catch((err) => {
  console.error('[fatal]', err);
  process.exit(1);
});
