import { Router } from "express";
import { PriceService } from "../services/PriceService.js";

const router = Router();

/**
 * GET /changes
 * Récupère les derniers prix et variations pour tous les assets
 */
router.get("/changes", async (_req, res) => {
  const data = await PriceService.getChanges();
  res.json({ data });
});

/**
 * GET /prices
 * Récupère l'historique des prix pour un asset
 * Query params: symbol (requis), limit (optionnel, défaut 20, max 200)
 */
router.get("/", async (req, res) => {
  const symbol = String(req.query.symbol ?? "").trim().toLowerCase();
  const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 20));

  if (!symbol) {
    return res.status(400).json({ error: "symbol required" });
  }

  const result = await PriceService.getPriceHistory(symbol, limit);
  res.set("Cache-Control", "no-store");
  res.json(result);
});

/**
 * GET /prices/ohlc
 * Récupère les données OHLC (Open-High-Low-Close) pour les graphiques en chandelier
 * Query params: symbol (requis), granularity (1h, 6h, 24h)
 */
router.get("/ohlc", async (req, res) => {
  const symbol = String(req.query.symbol ?? "").trim().toLowerCase();
  const granularity = String(req.query.granularity ?? "1h");

  if (!symbol) {
    return res.status(400).json({ error: "symbol required" });
  }

  const result = await PriceService.getOHLC(symbol, granularity);
  res.json(result);
});

export default router;
