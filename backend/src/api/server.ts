import express from "express";
import cors from "cors";
import { prisma } from "../repos/prisma.js";
import { runOnce } from "../services/CollectService.js";
import { AuthService } from "../services/AuthService.js";
import { authenticate, authorize } from "../middlewares/auth.js";
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

  
  app.post("/auth/register", async (req, res) => {
    try {
      const { email, password, name } = req.body;

      if (!email || typeof email !== "string") {
        return res.status(400).json({ error: "Email requis" });
      }
      if (!password || typeof password !== "string" || password.length < 6) {
        return res.status(400).json({ error: "Mot de passe requis (min 6 caractères)" });
      }

      const result = await AuthService.register(email, password, name);
      res.status(201).json({ data: result });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      if (message.includes("existe déjà")) {
        return res.status(409).json({ error: message });
      }
      res.status(500).json({ error: message });
    }
  });

  
  app.post("/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || typeof email !== "string") {
        return res.status(400).json({ error: "Email requis" });
      }
      if (!password || typeof password !== "string") {
        return res.status(400).json({ error: "Mot de passe requis" });
      }

      const result = await AuthService.login(email, password);
      res.json({ data: result });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      res.status(401).json({ error: message });
    }
  });

  
  app.get("/auth/me", authenticate, async (req, res) => {
    try {
      const user = await AuthService.getUserById(req.user!.userId);
      res.json({ data: user });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      res.status(404).json({ error: message });
    }
  });

  app.patch("/auth/password", authenticate, async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || typeof currentPassword !== "string") {
        return res.status(400).json({ error: "Mot de passe actuel requis" });
      }
      if (!newPassword || typeof newPassword !== "string" || newPassword.length < 6) {
        return res.status(400).json({ error: "Nouveau mot de passe requis (min 6 caractères)" });
      }

      await AuthService.updatePassword(req.user!.userId, currentPassword, newPassword);
      res.json({ ok: true, message: "Mot de passe mis à jour" });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      res.status(400).json({ error: message });
    }
  });


  app.get("/auth/users", authenticate, authorize("ADMIN"), async (_req, res) => {
    try {
      const users = await prisma.user.findMany({
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      });
      res.json({ data: users });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      res.status(500).json({ error: message });
    }
  });


  app.get("/", (_req, res) => {
    res.type("text").send("Backend OK. Try /health, POST /collect, GET /assets, GET /prices");
  });

  app.get("/health", async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ status: "ok", db: "connected" });
    } catch {
      res.status(500).json({ status: "error", db: "disconnected" });
    }
  });

  app.post("/collect", async (_req, res) => {
    try {
      const summary = await runOnce();
      res.json({ ok: true, summary });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      res.status(500).json({ ok: false, error: message });
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

    const out = await Promise.all(
      assets.map(async (a) => {
        const last = await prisma.marketSnapshot.findFirst({
          where: { assetId: a.id },
          orderBy: { ingestedAt: "desc" },
          select: { priceUsd: true, change24hPct: true },
        });

        return {
          symbol: a.symbol,
          name: a.name,
          last: last?.priceUsd ?? null,
          change24hPct: last?.change24hPct ?? null,
        };
      })
    );

    res.json({ data: out });
  });

  app.get("/prices", async (req, res) => {
    const symbol = String(req.query.symbol ?? "").trim().toLowerCase();
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 20));

    if (!symbol) {
      return res.status(400).json({ error: "symbol required" });
    }

    const asset = await prisma.asset.findFirst({ where: { symbol } });
    if (!asset) {
      return res.json({ symbol, data: [] });
    }

    const snapshots = await prisma.marketSnapshot.findMany({
      where: { assetId: asset.id },
      orderBy: { ingestedAt: "desc" },
      take: limit,
    });

    const data = snapshots
      .map((s) => ({
        t: s.ingestedAt,
        priceUsd: s.priceUsd,
        volume24hUsd: s.volume24hUsd,
        marketCapUsd: s.marketCapUsd,
        change24hPct: s.change24hPct,
      }))
      .reverse();

    res.set("Cache-Control", "no-store");
    res.json({ symbol, data });
  });

  app.get("/prices/ohlc", async (req, res) => {
    const symbol = String(req.query.symbol ?? "").trim().toLowerCase();
    const granularity = String(req.query.granularity ?? "1h");

    if (!symbol) {
      return res.status(400).json({ error: "symbol required" });
    }

    const asset = await prisma.asset.findFirst({ where: { symbol } });
    if (!asset) {
      return res.json({ symbol, granularity, data: [] });
    }

    const bucketMs =
      granularity === "24h"
        ? 24 * 60 * 60 * 1000
        : granularity === "6h"
          ? 6 * 60 * 60 * 1000
          : 60 * 60 * 1000;

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
        if (currentCandle) candles.push(currentCandle);

        currentBucketStart = bucketStart;
        currentCandle = {
          t: new Date(bucketStart),
          open: s.priceUsd,
          high: s.priceUsd,
          low: s.priceUsd,
          close: s.priceUsd,
        };
      } else if (currentCandle) {
        if (s.priceUsd > currentCandle.high) currentCandle.high = s.priceUsd;
        if (s.priceUsd < currentCandle.low) currentCandle.low = s.priceUsd;
        currentCandle.close = s.priceUsd;
      }
    }

    if (currentCandle) candles.push(currentCandle);

    res.json({ symbol, granularity, data: candles });
  });



  app.get("/alerts", authenticate, async (req, res) => {
    try {
      const userId = req.user!.userId;
      const assetId = req.query.assetId ? Number(req.query.assetId) : null;
      const activeOnly = req.query.active === "true";

      const where: { userId: number; assetId?: number; isActive?: boolean } = { userId };
      if (assetId) where.assetId = assetId;
      if (activeOnly) where.isActive = true;

      const alerts = await prisma.alert.findMany({
        where,
        include: { asset: true },
        orderBy: { createdAt: "desc" },
      });

      res.json({ data: alerts });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      res.status(500).json({ error: message });
    }
  });

  app.get("/alerts/:id", authenticate, async (req, res) => {
    try {
      const userId = req.user!.userId;
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) {
        return res.status(400).json({ error: "Invalid alert ID" });
      }

      const alert = await prisma.alert.findUnique({
        where: { id },
        include: {
          asset: true,
          notifications: { take: 10, orderBy: { sentAt: "desc" } },
        },
      });

      if (!alert || alert.userId !== userId) {
        return res.status(404).json({ error: "Alert not found" });
      }

      res.json({ data: alert });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      res.status(500).json({ error: message });
    }
  });

  app.post("/alerts", authenticate, async (req, res) => {
    try {
      const userId = req.user!.userId;
      const { assetId, type, threshold } = req.body;

      if (!Number.isFinite(assetId)) {
        return res.status(400).json({ error: "assetId must be a number" });
      }

      const validTypes: AlertType[] = ["price_above", "price_below", "change_above", "change_below"];
      if (!validTypes.includes(type)) {
        return res.status(400).json({ error: `type must be one of: ${validTypes.join(", ")}` });
      }

      if (!Number.isFinite(threshold)) {
        return res.status(400).json({ error: "threshold must be a number" });
      }

      const asset = await prisma.asset.findUnique({ where: { id: assetId } });
      if (!asset) {
        return res.status(404).json({ error: "Asset not found" });
      }

      const alert = await prisma.alert.create({
        data: { assetId, userId, type, threshold },
        include: { asset: true },
      });
      res.status(201).json({ data: alert });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      res.status(500).json({ error: message });
    }
  });

  app.patch("/alerts/:id/activate", authenticate, async (req, res) => {
    try {
      const userId = req.user!.userId;
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) {
        return res.status(400).json({ error: "Invalid alert ID" });
      }

      // Vérifier ownership
      const existing = await prisma.alert.findUnique({ where: { id } });
      if (!existing || existing.userId !== userId) {
        return res.status(404).json({ error: "Alert not found" });
      }

      const alert = await prisma.alert.update({
        where: { id },
        data: { isActive: true },
        include: { asset: true },
      });

      res.json({ data: alert });
    } catch (e: unknown) {
      const err = e as { code?: string; message?: string };
      if (err.code === "P2025") {
        return res.status(404).json({ error: "Alert not found" });
      }
      res.status(500).json({ error: err.message ?? String(e) });
    }
  });

  app.patch("/alerts/:id/deactivate", authenticate, async (req, res) => {
    try {
      const userId = req.user!.userId;
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) {
        return res.status(400).json({ error: "Invalid alert ID" });
      }

      // Vérifier ownership
      const existing = await prisma.alert.findUnique({ where: { id } });
      if (!existing || existing.userId !== userId) {
        return res.status(404).json({ error: "Alert not found" });
      }

      const alert = await deactivateAlert(id);
      res.json({ data: alert });
    } catch (e: unknown) {
      const err = e as { code?: string; message?: string };
      if (err.code === "P2025") {
        return res.status(404).json({ error: "Alert not found" });
      }
      res.status(500).json({ error: err.message ?? String(e) });
    }
  });

  app.delete("/alerts/:id", authenticate, async (req, res) => {
    try {
      const userId = req.user!.userId;
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) {
        return res.status(400).json({ error: "Invalid alert ID" });
      }

      // Vérifier ownership
      const existing = await prisma.alert.findUnique({ where: { id } });
      if (!existing || existing.userId !== userId) {
        return res.status(404).json({ error: "Alert not found" });
      }

      await prisma.notificationLog.deleteMany({ where: { alertId: id } });
      await prisma.alert.delete({ where: { id } });

      res.json({ ok: true, message: "Alert deleted" });
    } catch (e: unknown) {
      const err = e as { code?: string; message?: string };
      if (err.code === "P2025") {
        return res.status(404).json({ error: "Alert not found" });
      }
      res.status(500).json({ error: err.message ?? String(e) });
    }
  });


  app.get("/forecast", async (req, res) => {
    try {
      const symbol = String(req.query.symbol ?? "").trim().toLowerCase();
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



  app.get("/portfolios", authenticate, async (req, res) => {
    try {
      const userId = req.user!.userId;
      const portfolios = await prisma.portfolio.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
      });
      res.json({ data: portfolios });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      res.status(500).json({ error: message });
    }
  });

  app.get("/portfolios/:id", authenticate, async (req, res) => {
    try {
      const userId = req.user!.userId;
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) {
        return res.status(400).json({ error: "Invalid portfolio ID" });
      }

      const portfolio = await prisma.portfolio.findUnique({
        where: { id },
        include: { positions: { include: { asset: true } } },
      });
      if (!portfolio || portfolio.userId !== userId) {
        return res.status(404).json({ error: "Portfolio not found" });
      }

      res.json({ data: portfolio });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      res.status(500).json({ error: message });
    }
  });

  app.post("/portfolios", authenticate, async (req, res) => {
    try {
      const userId = req.user!.userId;
      const { name } = req.body;

      if (!name || typeof name !== "string" || name.trim().length === 0) {
        return res.status(400).json({ error: "name is required" });
      }

      const portfolio = await prisma.portfolio.create({
        data: { name: name.trim(), userId },
      });
      res.status(201).json({ data: portfolio });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      res.status(500).json({ error: message });
    }
  });

  app.delete("/portfolios/:id", authenticate, async (req, res) => {
    try {
      const userId = req.user!.userId;
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) {
        return res.status(400).json({ error: "Invalid portfolio ID" });
      }

      const existing = await prisma.portfolio.findUnique({ where: { id } });
      if (!existing || existing.userId !== userId) {
        return res.status(404).json({ error: "Portfolio not found" });
      }

      await prisma.trade.deleteMany({ where: { portfolioId: id } });
      await prisma.position.deleteMany({ where: { portfolioId: id } });
      await prisma.portfolio.delete({ where: { id } });

      res.json({ ok: true, message: "Portfolio deleted" });
    } catch (e: unknown) {
      const err = e as { code?: string; message?: string };
      if (err.code === "P2025") {
        return res.status(404).json({ error: "Portfolio not found" });
      }
      res.status(500).json({ error: err.message ?? String(e) });
    }
  });

  app.get("/portfolios/:id/pnl", authenticate, async (req, res) => {
    try {
      const userId = req.user!.userId;
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) {
        return res.status(400).json({ error: "Invalid portfolio ID" });
      }

      const portfolio = await prisma.portfolio.findUnique({ where: { id } });
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

  app.get("/portfolios/:id/positions", authenticate, async (req, res) => {
    try {
      const userId = req.user!.userId;
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) {
        return res.status(400).json({ error: "Invalid portfolio ID" });
      }

      const portfolio = await prisma.portfolio.findUnique({ where: { id } });
      if (!portfolio || portfolio.userId !== userId) {
        return res.status(404).json({ error: "Portfolio not found" });
      }

      const positions = await prisma.position.findMany({
        where: { portfolioId: id },
        include: { asset: true },
        orderBy: { updatedAt: "desc" },
      });

      res.json({ data: positions });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      res.status(500).json({ error: message });
    }
  });

  app.get("/portfolios/:id/trades", authenticate, async (req, res) => {
    try {
      const userId = req.user!.userId;
      const id = Number(req.params.id);
      const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));

      if (!Number.isFinite(id)) {
        return res.status(400).json({ error: "Invalid portfolio ID" });
      }

      const portfolio = await prisma.portfolio.findUnique({ where: { id } });
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

  app.post("/portfolios/:id/trades", authenticate, async (req, res) => {
    try {
      const userId = req.user!.userId;
      const portfolioId = Number(req.params.id);
      if (!Number.isFinite(portfolioId)) {
        return res.status(400).json({ error: "Invalid portfolio ID" });
      }

      // Vérifier ownership
      const portfolio = await prisma.portfolio.findUnique({ where: { id: portfolioId } });
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

  return app;
}
