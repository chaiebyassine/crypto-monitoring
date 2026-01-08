import { Router } from "express";
import { generateForecast, type ForecastMethod } from "../services/ForecastService.js";

const router = Router();

/**
 * GET /forecast
 * Génère une prédiction de prix pour un asset
 * Query params:
 *   - symbol (requis): symbole de l'asset (ex: btc, eth)
 *   - method (optionnel): sma, ema, linear (défaut: ema)
 *   - history (optionnel): nombre de points historiques (10-200, défaut: 50)
 *   - steps (optionnel): nombre de prédictions (1-50, défaut: 10)
 */
router.get("/", async (req, res) => {
  try {
    const symbol = String(req.query.symbol ?? "")
      .trim()
      .toLowerCase();
    const method = (req.query.method ?? "ema") as ForecastMethod;
    const history = Math.max(10, Math.min(200, Number(req.query.history) || 50));
    const steps = Math.max(1, Math.min(50, Number(req.query.steps) || 10));

    if (!symbol) {
      return res.status(400).json({ error: "symbol is required" });
    }

    const validMethods: ForecastMethod[] = ["sma", "ema", "linear"];
    if (!validMethods.includes(method)) {
      return res.status(400).json({ error: `method must be one of: ${validMethods.join(", ")}` });
    }

    const forecast = await generateForecast(symbol, method, history, steps);

    if (!forecast) {
      return res.status(404).json({ error: "Asset not found or insufficient data" });
    }

    res.json({ data: forecast });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    res.status(500).json({ error: message });
  }
});

export default router;
