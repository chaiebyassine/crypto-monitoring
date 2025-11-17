
import cron from "node-cron";
import { runOnce } from "../services/CollectService.js";

let running = false;

export function startScheduler(everySeconds: number) {
  const step = Math.max(1, Math.min(59, everySeconds));

  const spec = `*/${step} * * * * *`;

  cron.schedule(spec, async () => {
    if (running) return;
    running = true;

    const started = Date.now();
    try {
      const sum = await runOnce();
      console.log(
        `[collect] ok in ${Date.now() - started}ms -> ${sum.inserted}/${sum.total}`
      );
    } catch (e) {
      console.error(`[collect] failed in ${Date.now() - started}ms`, e);
    } finally {
      running = false;
    }
  });

  console.log(`[scheduler] started: ${spec}`);
}
