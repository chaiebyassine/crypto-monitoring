/**
 * Scheduler basé sur cron (node-cron).
 *  - Lance runOnce() toutes les N secondes (N = env.intervalSeconds)
 *  - Empêche le chevauchement des runs (flag "running")
 *  - Loggue un résumé (durée + nombre d'insertions)
 */

import cron from "node-cron";
import { runOnce } from "../services/CollectService.js";

let running = false;

export function startScheduler(everySeconds: number) {
  // On borne N entre 1 et 59 pour éviter des specs invalides
  const step = Math.max(1, Math.min(59, everySeconds));

  // Spécification cron : "*/N * * * * *" = toutes les N secondes
  const spec = `*/${step} * * * * *`;

  cron.schedule(spec, async () => {
    // Si un run est déjà en cours, on skip pour éviter la concurrence
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
