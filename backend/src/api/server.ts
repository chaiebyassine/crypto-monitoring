
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


  return app;
}
