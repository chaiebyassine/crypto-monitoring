import { Router } from "express";
import { authenticate } from "../middlewares/auth.js";
import {
  createPortfolio,
  getPortfoliosByUser,
  getPortfolio,
  deletePortfolio,
  getPortfolioPositions,
  getPortfolioPnL,
  getTradeHistory,
  executeTrade,
  type TradeSide,
} from "../services/PortfolioService.js";

const router = Router();

// Tous les endpoints portfolios nécessitent une authentification
router.use(authenticate);

/**
 * GET /portfolios
 * Liste les portfolios de l'utilisateur connecté
 */
router.get("/", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const portfolios = await getPortfoliosByUser(userId);
    res.json({ data: portfolios });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    res.status(500).json({ error: message });
  }
});

/**
 * GET /portfolios/:id
 * Récupère un portfolio par ID avec ses positions
 */
router.get("/:id", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: "Invalid portfolio ID" });
    }

    const portfolio = await getPortfolio(id);
    if (!portfolio || portfolio.userId !== userId) {
      return res.status(404).json({ error: "Portfolio not found" });
    }

    res.json({ data: portfolio });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    res.status(500).json({ error: message });
  }
});

/**
 * POST /portfolios
 * Crée un nouveau portfolio
 */
router.post("/", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const { name } = req.body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return res.status(400).json({ error: "name is required" });
    }

    const portfolio = await createPortfolio(name.trim(), userId);
    res.status(201).json({ data: portfolio });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    res.status(500).json({ error: message });
  }
});

/**
 * DELETE /portfolios/:id
 * Supprime un portfolio et toutes ses données associées
 */
router.delete("/:id", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: "Invalid portfolio ID" });
    }

    const existing = await getPortfolio(id);
    if (!existing || existing.userId !== userId) {
      return res.status(404).json({ error: "Portfolio not found" });
    }

    await deletePortfolio(id);
    res.json({ ok: true, message: "Portfolio deleted" });
  } catch (e: unknown) {
    const err = e as { code?: string; message?: string };
    if (err.code === "P2025") {
      return res.status(404).json({ error: "Portfolio not found" });
    }
    res.status(500).json({ error: err.message ?? String(e) });
  }
});

/**
 * GET /portfolios/:id/pnl
 * Calcule le PnL (Profit & Loss) du portfolio
 */
router.get("/:id/pnl", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: "Invalid portfolio ID" });
    }

    const portfolio = await getPortfolio(id);
    if (!portfolio || portfolio.userId !== userId) {
      return res.status(404).json({ error: "Portfolio not found" });
    }

    const pnl = await getPortfolioPnL(id);
    if (!pnl) {
      return res.status(404).json({ error: "Portfolio not found" });
    }

    res.json({ data: pnl });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    res.status(500).json({ error: message });
  }
});

/**
 * GET /portfolios/:id/positions
 * Liste les positions du portfolio
 */
router.get("/:id/positions", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: "Invalid portfolio ID" });
    }

    const portfolio = await getPortfolio(id);
    if (!portfolio || portfolio.userId !== userId) {
      return res.status(404).json({ error: "Portfolio not found" });
    }

    const positions = await getPortfolioPositions(id);
    res.json({ data: positions });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    res.status(500).json({ error: message });
  }
});

/**
 * GET /portfolios/:id/trades
 * Historique des trades du portfolio
 */
router.get("/:id/trades", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const id = Number(req.params.id);
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));

    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: "Invalid portfolio ID" });
    }

    const portfolio = await getPortfolio(id);
    if (!portfolio || portfolio.userId !== userId) {
      return res.status(404).json({ error: "Portfolio not found" });
    }

    const trades = await getTradeHistory(id, limit);
    res.json({ data: trades });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    res.status(500).json({ error: message });
  }
});

/**
 * POST /portfolios/:id/trades
 * Exécute un nouveau trade (achat ou vente)
 */
router.post("/:id/trades", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const portfolioId = Number(req.params.id);
    if (!Number.isFinite(portfolioId)) {
      return res.status(400).json({ error: "Invalid portfolio ID" });
    }

    const portfolio = await getPortfolio(portfolioId);
    if (!portfolio || portfolio.userId !== userId) {
      return res.status(404).json({ error: "Portfolio not found" });
    }

    const { assetId, side, quantity, priceUsd, notes } = req.body;

    if (!Number.isFinite(assetId)) {
      return res.status(400).json({ error: "assetId must be a number" });
    }

    const validSides: TradeSide[] = ["buy", "sell"];
    if (!validSides.includes(side)) {
      return res.status(400).json({ error: "side must be 'buy' or 'sell'" });
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      return res.status(400).json({ error: "quantity must be a positive number" });
    }

    if (!Number.isFinite(priceUsd) || priceUsd <= 0) {
      return res.status(400).json({ error: "priceUsd must be a positive number" });
    }

    const result = await executeTrade({
      portfolioId,
      assetId,
      side,
      quantity,
      priceUsd,
      notes: notes ?? undefined,
    });

    res.status(201).json({ data: result });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    if (message.includes("Insufficient position")) {
      return res.status(400).json({ error: message });
    }
    if (message.includes("not found")) {
      return res.status(404).json({ error: message });
    }
    res.status(500).json({ error: message });
  }
});

export default router;
