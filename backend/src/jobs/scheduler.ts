
import cron from "node-cron";
import { runOnce } from "../services/CollectService.js";

let running = false;

export function startScheduler(everySeconds: number) {
  
  let spec: string;
  
  if (everySeconds >= 60) {
    const minutes = Math.max(1, Math.min(59, Math.floor(everySeconds / 60)));
    spec = `*/${minutes} * * * *`; 
  } else {
    const step = Math.max(10, Math.min(59, everySeconds));
    spec = `*/${step} * * * * *`; 
  }

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
