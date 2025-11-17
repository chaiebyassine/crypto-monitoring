
import express from "express";
import cors from "cors";
import { runOnce } from "../services/CollectService.js";
import { prisma } from "../repos/prisma.js";

export function createServer() {
  const app = express();

  app.use(cors({ origin: true }));

 
  app.get("/", (_req, res) => {
    res.type("text").send("Backend OK. Essayez /health, POST /collect, GET /assets, GET /prices");
  });

 
  app.get("/health", (_req, res) => res.json({ status: "ok" }));

  
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

  
  app.get("/prices", async (req, res) => {
    const symbol = String(req.query.symbol ?? "").trim().toLowerCase();
    const limit = Number.isFinite(Number(req.query.limit))
      ? Math.min(200, Math.max(1, Number(req.query.limit)))
      : 20;

    if (!symbol) return res.status(400).json({ error: "symbol manquant" });
    app.get("/changes", async (_req, res) => {
  const assets = await prisma.asset.findMany({ select: { id: true, symbol: true, name: true } });
  const out: Array<{symbol:string; name:string; last:number|null; change24hPct:number|null}> = [];

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

  return app;
}
