import { Router } from "express";
import { prisma } from "../repos/prisma.js";
import { register } from "../metrics/prometheus.js";
import { runOnce } from "../services/CollectService.js";

const router = Router();

/**
 * GET /
 * Page d'accueil - Infos de base
 */
router.get("/", (_req, res) => {
  res.type("text").send("Backend OK. Try /health, POST /collect, GET /assets, GET /prices");
});

/**
 * GET /health
 * Vérifie l'état du serveur et de la base de données
 */
router.get("/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  } catch (_err) {
    res.status(503).json({
      status: "unhealthy",
      timestamp: new Date().toISOString(),
      error: "Database connection failed",
    });
  }
});

/**
 * GET /metrics
 * Expose les métriques Prometheus
 */
router.get("/metrics", async (_req, res) => {
  try {
    res.set("Content-Type", register.contentType);
    res.end(await register.metrics());
  } catch (_err) {
    res.status(500).end();
  }
});

/**
 * POST /collect
 * Déclenche manuellement la collecte des prix
 */
router.post("/collect", async (_req, res) => {
  try {
    const summary = await runOnce();
    res.json({ ok: true, summary });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    res.status(500).json({ ok: false, error: message });
  }
});

export default router;
