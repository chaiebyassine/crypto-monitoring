/**
 * Point d'entrée du service :
 *  - démarre l'API HTTP
 *  - lance un run de collecte au démarrage (non bloquant)
 *  - démarre le scheduler régulier
 */

import { createServer } from "./api/server.js";
import { env } from "./config/env.js";
import { startScheduler } from "./jobs/scheduler.js";
import { runOnce } from "./services/CollectService.js";

async function main() {
  // 1) API HTTP
  const app = createServer();
  app.listen(env.port, () => {
    console.log(`[api] http://localhost:${env.port}`);
  });

  // 2) Premier run dès le démarrage (si ça échoue, on ignore pour ne pas bloquer l'API)
  runOnce().catch(() => {});

  // 3) Lancement du scheduler (toutes les N secondes)
  startScheduler(env.intervalSeconds);
}

main().catch((err) => {
  console.error("[fatal]", err);
  process.exit(1);
});
