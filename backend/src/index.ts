import { createServer } from "./api/server.js";
import { env } from "./config/env.js";
import { startScheduler } from "./jobs/scheduler.js";
import { runOnce } from "./services/CollectService.js";

async function main() {
  const app = createServer();

  app.listen(env.port, () => {
    console.log(`[api] http://localhost:${env.port}`);
  });

  runOnce().catch(() => {});

  startScheduler(env.intervalSeconds);
}

main().catch((err) => {
  console.error("[fatal]", err);
  process.exit(1);
});
