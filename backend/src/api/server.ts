
import express from "express";
import cors from "cors";
import { runOnce } from "../services/CollectService.js";
import { prisma } from "../repos/prisma.js";
import {
  createAlert,
  deactivateAlert,
  getActiveAlerts,
  getAlertsByAsset,
  type AlertType,
} from "../services/AlertService.js";
import {
  generateForecast,
  type ForecastMethod,
} from "../services/ForecastService.js";
import {
  createPortfolio,
  getPortfolios,
  getPortfolio,
  executeTrade,
  getPortfolioPnL,
  getTradeHistory,
  type TradeSide,
} from "../services/PortfolioService.js";

export function createServer() {
  const app = express();

  app.use(cors({ origin: true }));
  app.use(express.json());

  
  app.get("/", (_req, res) => {
    res
      .type("text")
      .send("Backend OK. Essayez /health, POST /collect, GET /assets, GET /prices, GET /changes");
  });

  app.get("/health", async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ status: "ok", db: "connected" });
    } catch (err) {
      res.status(500).json({ status: "error", db: "disconnected" });
    }
  });

  app.post("/collect", async (_req, res) => {
    try {
      const summary = await runOnce();
      res.json({ ok: true, summary });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: String(e?.message ?? e) });
    }
  });

  app.get("/assets", async (_req, res) => {
    const assets = await prisma.asset.findMany({
      orderBy: { symbol: "asc" },
      select: { id: true, symbol: true, name: true },
    });
    res.set("Cache-Control", "public, max-age=10");
    res.json({ data: assets });
  });

  app.get("/changes", async (_req, res) => {
    const assets = await prisma.asset.findMany({
      select: { id: true, symbol: true, name: true },
    });

    const out: Array<{
      symbol: string;
      name: string;
      last: number | null;
      change24hPct: number | null;
    }> = [];

    for (const a of assets) {
      const last = await prisma.marketSnapshot.findFirst({
        where: { assetId: a.id },
        orderBy: { ingestedAt: "desc" },
        select: { priceUsd: true, change24hPct: true },
      });

      out.push({
        symbol: a.symbol,
        name: a.name,
        last: last?.priceUsd ?? null,
        change24hPct: last?.change24hPct ?? null,
      });
    }

    res.json({ data: out });
  });

  app.get("/prices", async (req, res) => {
    const symbol = String(req.query.symbol ?? "").trim().toLowerCase();
    const limit = Number.isFinite(Number(req.query.limit))
      ? Math.min(200, Math.max(1, Number(req.query.limit)))
      : 20;

    if (!symbol) {
      return res.status(400).json({ error: "symbol manquant" });
    }

    const asset = await prisma.asset.findFirst({ where: { symbol } });
    if (!asset) return res.json({ symbol, data: [] });

    const snapshots = await prisma.marketSnapshot.findMany({
      where: { assetId: asset.id },
      orderBy: { ingestedAt: "desc" },
      take: limit,
    });

    const dataDesc = snapshots.map((s) => ({
      t: s.ingestedAt,
      priceUsd: s.priceUsd,
      volume24hUsd: s.volume24hUsd,
      marketCapUsd: s.marketCapUsd,
      change24hPct: s.change24hPct,
    }));

    const dataAsc = dataDesc.reverse();

    res.set("Cache-Control", "no-store");
    res.json({ symbol, data: dataAsc });
  });
    app.get("/prices/ohlc", async (req, res) => {
    const symbol = String(req.query.symbol ?? "").trim().toLowerCase();
    const gran = String(req.query.granularity ?? "1h"); 

    if (!symbol) {
      return res.status(400).json({ error: "symbol manquant" });
    }

    const asset = await prisma.asset.findFirst({ where: { symbol } });
    if (!asset) {
      return res.json({ symbol, granularity: gran, data: [] });
    }

    let bucketMs: number;
    if (gran === "24h") {
      bucketMs = 24 * 60 * 60 * 1000;
    } else if (gran === "6h") {
      bucketMs = 6 * 60 * 60 * 1000;
    } else {
      bucketMs = 60 * 60 * 1000; 
    }

    const snapshots = await prisma.marketSnapshot.findMany({
      where: { assetId: asset.id },
      orderBy: { ingestedAt: "asc" },
      select: { ingestedAt: true, priceUsd: true },
      take: 5000, 
    });

    type Candle = { t: Date; open: number; high: number; low: number; close: number };

    const candles: Candle[] = [];

    let currentBucketStart: number | null = null;
    let currentCandle: Candle | null = null;

    for (const s of snapshots) {
      if (s.priceUsd == null) continue;

      const ts = s.ingestedAt.getTime();
      const bucketStart = Math.floor(ts / bucketMs) * bucketMs; 

     
      if (currentBucketStart === null || bucketStart !== currentBucketStart) {
        if (currentCandle) {
          candles.push(currentCandle);
        }

        currentBucketStart = bucketStart;
        currentCandle = {
          t: new Date(bucketStart),
          open: s.priceUsd,
          high: s.priceUsd,
          low: s.priceUsd,
          close: s.priceUsd,
        };
      } else {
        if (!currentCandle) continue;
        if (s.priceUsd > currentCandle.high) currentCandle.high = s.priceUsd;
        if (s.priceUsd < currentCandle.low) currentCandle.low = s.priceUsd;
        currentCandle.close = s.priceUsd;
      }
    }

    if (currentCandle) {
      candles.push(currentCandle);
    }

    res.json({ symbol, granularity: gran, data: candles });
  });

  
  app.get("/alerts", async (req, res) => {
    try {
      const assetId = req.query.assetId ? Number(req.query.assetId) : null;
      const activeOnly = req.query.active === "true";

      let alerts;
      if (assetId) {
        alerts = await getAlertsByAsset(assetId);
        if (activeOnly) {
          alerts = alerts.filter((a) => a.isActive);
        }
      } else if (activeOnly) {
        alerts = await getActiveAlerts();
      } else {
        alerts = await prisma.alert.findMany({
          include: { asset: true },
          orderBy: { createdAt: "desc" },
        });
      }

      res.json({ data: alerts });
    } catch (e: any) {
      res.status(500).json({ error: String(e?.message ?? e) });
    }
  });

  app.get("/alerts/:id", async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) {
        return res.status(400).json({ error: "Invalid alert ID" });
      }

      const alert = await prisma.alert.findUnique({
        where: { id },
        include: { asset: true, notifications: { take: 10, orderBy: { sentAt: "desc" } } },
      });

      if (!alert) {
        return res.status(404).json({ error: "Alert not found" });
      }

      res.json({ data: alert });
    } catch (e: any) {
      res.status(500).json({ error: String(e?.message ?? e) });
    }
  });

  app.post("/alerts", async (req, res) => {
    try {
      const { assetId, type, threshold } = req.body;

      if (!Number.isFinite(assetId)) {
        return res.status(400).json({ error: "assetId must be a number" });
      }

      if (!["price_above", "price_below", "change_above", "change_below"].includes(type)) {
        return res.status(400).json({
          error: `type must be one of: price_above, price_below, change_above, change_below`,
        });
      }
      const validTypes: AlertType[] = ["price_above", "price_below", "change_above", "change_below"];
      if (!validTypes.includes(type)) {
        return res.status(400).json({
          error: `type must be one of: ${validTypes.join(", ")}`,
        });
      }

      if (!Number.isFinite(threshold)) {
        return res.status(400).json({ error: "threshold must be a number" });
      }

      
      const asset = await prisma.asset.findUnique({ where: { id: assetId } });
      if (!asset) {
        return res.status(404).json({ error: "Asset not found" });
      }

      const alert = await createAlert(assetId, type, threshold);
      res.status(201).json({ data: alert });
    } catch (e: any) {
      res.status(500).json({ error: String(e?.message ?? e) });
    }
  });

  
  app.patch("/alerts/:id/activate", async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) {
        return res.status(400).json({ error: "Invalid alert ID" });
      }

      const alert = await prisma.alert.update({
        where: { id },
        data: { isActive: true },
        include: { asset: true },
      });

      res.json({ data: alert });
    } catch (e: any) {
      if (e?.code === "P2025") {
        return res.status(404).json({ error: "Alert not found" });
      }
      res.status(500).json({ error: String(e?.message ?? e) });
    }
  });

  
  app.patch("/alerts/:id/deactivate", async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) {
        return res.status(400).json({ error: "Invalid alert ID" });
      }

      const alert = await deactivateAlert(id);
      res.json({ data: alert });
    } catch (e: any) {
      if (e?.code === "P2025") {
        return res.status(404).json({ error: "Alert not found" });
      }
      res.status(500).json({ error: String(e?.message ?? e) });
    }
  });

  
  app.delete("/alerts/:id", async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) {
        return res.status(400).json({ error: "Invalid alert ID" });
      }

      
      await prisma.notificationLog.deleteMany({ where: { alertId: id } });

      
      await prisma.alert.delete({ where: { id } });

      res.json({ ok: true, message: "Alert deleted" });
    } catch (e: any) {
      if (e?.code === "P2025") {
        return res.status(404).json({ error: "Alert not found" });
      }
      res.status(500).json({ error: String(e?.message ?? e) });
    }
  });


  app.get("/forecast", async (req, res) => {
    try {
      const symbol = String(req.query.symbol ?? "").trim().toLowerCase();
      const method = (req.query.method ?? "ema") as ForecastMethod;
      const history = Number(req.query.history) || 50;
      const steps = Number(req.query.steps) || 10;

      if (!symbol) {
        return res.status(400).json({ error: "symbol is required" });
      }

      const validMethods: ForecastMethod[] = ["sma", "ema", "linear"];
      if (!validMethods.includes(method)) {
        return res.status(400).json({
          error: `method must be one of: ${validMethods.join(", ")}`,
        });
      }

      const clampedHistory = Math.max(10, Math.min(200, history));
      const clampedSteps = Math.max(1, Math.min(50, steps));

      const forecast = await generateForecast(
        symbol,
        method,
        clampedHistory,
        clampedSteps
      );

      if (!forecast) {
        return res.status(404).json({
          error: "Asset not found or insufficient data for forecast",
        });
      }

      res.json({ data: forecast });
    } catch (e: any) {
      res.status(500).json({ error: String(e?.message ?? e) });
    }
  });

  // ==================== PORTFOLIO ROUTES ====================

  // List all portfolios
  app.get("/portfolios", async (_req, res) => {
    try {
      const portfolios = await getPortfolios();
      res.json({ data: portfolios });
    } catch (e: any) {
      res.status(500).json({ error: String(e?.message ?? e) });
    }
  });

  // Get portfolio by ID (with positions and recent trades)
  app.get("/portfolios/:id", async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) {
        return res.status(400).json({ error: "Invalid portfolio ID" });
      }

      const portfolio = await getPortfolio(id);
      if (!portfolio) {
        return res.status(404).json({ error: "Portfolio not found" });
      }

      res.json({ data: portfolio });
    } catch (e: any) {
      res.status(500).json({ error: String(e?.message ?? e) });
    }
  });

  // Create a new portfolio
  app.post("/portfolios", async (req, res) => {
    try {
      const { name } = req.body;

      if (!name || typeof name !== "string" || name.trim().length === 0) {
        return res.status(400).json({ error: "name is required" });
      }

      const portfolio = await createPortfolio(name.trim());
      res.status(201).json({ data: portfolio });
    } catch (e: any) {
      res.status(500).json({ error: String(e?.message ?? e) });
    }
  });

  // Delete a portfolio
  app.delete("/portfolios/:id", async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) {
        return res.status(400).json({ error: "Invalid portfolio ID" });
      }

      // Delete related records first
      await prisma.trade.deleteMany({ where: { portfolioId: id } });
      await prisma.position.deleteMany({ where: { portfolioId: id } });
      await prisma.portfolio.delete({ where: { id } });

      res.json({ ok: true, message: "Portfolio deleted" });
    } catch (e: any) {
      if (e?.code === "P2025") {
        return res.status(404).json({ error: "Portfolio not found" });
      }
      res.status(500).json({ error: String(e?.message ?? e) });
    }
  });

  // Get portfolio PnL (positions with current prices and unrealized/realized PnL)
  app.get("/portfolios/:id/pnl", async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) {
        return res.status(400).json({ error: "Invalid portfolio ID" });
      }

      const pnl = await getPortfolioPnL(id);
      if (!pnl) {
        return res.status(404).json({ error: "Portfolio not found" });
      }

      res.json({ data: pnl });
    } catch (e: any) {
      res.status(500).json({ error: String(e?.message ?? e) });
    }
  });

  // Get portfolio positions
  app.get("/portfolios/:id/positions", async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) {
        return res.status(400).json({ error: "Invalid portfolio ID" });
      }

      const positions = await prisma.position.findMany({
        where: { portfolioId: id },
        include: { asset: true },
        orderBy: { updatedAt: "desc" },
      });

      res.json({ data: positions });
    } catch (e: any) {
      res.status(500).json({ error: String(e?.message ?? e) });
    }
  });

  // Get portfolio trade history
  app.get("/portfolios/:id/trades", async (req, res) => {
    try {
      const id = Number(req.params.id);
      const limit = Number(req.query.limit) || 50;

      if (!Number.isFinite(id)) {
        return res.status(400).json({ error: "Invalid portfolio ID" });
      }

      const trades = await getTradeHistory(id, Math.min(200, Math.max(1, limit)));
      res.json({ data: trades });
    } catch (e: any) {
      res.status(500).json({ error: String(e?.message ?? e) });
    }
  });

  // Execute a trade (BUY or SELL)
  app.post("/portfolios/:id/trades", async (req, res) => {
    try {
      const portfolioId = Number(req.params.id);
      if (!Number.isFinite(portfolioId)) {
        return res.status(400).json({ error: "Invalid portfolio ID" });
      }

      const { assetId, side, quantity, priceUsd, notes } = req.body;

      // Validate assetId
      if (!Number.isFinite(assetId)) {
        return res.status(400).json({ error: "assetId must be a number" });
      }

      // Validate side
      const validSides: TradeSide[] = ["buy", "sell"];
      if (!validSides.includes(side)) {
        return res.status(400).json({
          error: "side must be 'buy' or 'sell'",
        });
      }

      // Validate quantity
      if (!Number.isFinite(quantity) || quantity <= 0) {
        return res.status(400).json({ error: "quantity must be a positive number" });
      }

      // Validate price
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
    } catch (e: any) {
      // Handle specific errors
      if (e?.message?.includes("Insufficient position")) {
        return res.status(400).json({ error: e.message });
      }
      if (e?.message?.includes("not found")) {
        return res.status(404).json({ error: e.message });
      }
      res.status(500).json({ error: String(e?.message ?? e) });
    }
  });


  return app;
}
