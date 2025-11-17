
/**
 * Mini API HTTP avec Express.
 *  - GET /           : message d'accueil
 *  - GET /health     : ping (pour savoir si le service tourne)
 *  - POST /collect   : déclenche manuellement un run (appel runOnce)
 *  - GET /prices     : lit l'historique d'un symbole (ex: ?symbol=bitcoin&limit=5)
 */

import express from "express";
import { runOnce } from "../services/CollectService.js";
import { prisma } from "../repos/prisma.js";

export function createServer() {
  const app = express();

  // Accueil : utile pour vérifier vite si l'API répond
  app.get("/", (_req, res) => {
    res.type("text").send("Backend OK. Essayez /health, POST /collect, GET /prices");
  });

  // Ping de santé
  app.get("/health", (_req, res) => res.json({ status: "ok" }));

  // Déclenche un run à la demande (pratique pour tester depuis Postman/curl)
  app.post("/collect", async (_req, res) => {
    try {
      const summary = await runOnce();
      res.json({ ok: true, summary });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: String(e?.message ?? e) });
    }
  });

  // Lecture de l'historique : dernières N valeurs pour un symbole donné
  app.get("/prices", async (req, res) => {
    const symbol = String(req.query.symbol ?? "").trim().toLowerCase();
    const limit = Math.min(200, Math.max(1, Number(req.query.limit ?? 20)));

    if (!symbol) return res.status(400).json({ error: "symbol manquant" });

    // On cherche l'asset correspondant
    const asset = await prisma.asset.findFirst({ where: { symbol } });
    if (!asset) return res.json({ data: [] });

    // On récupère les derniers snapshots (ordre décroissant)
    const snapshots = await prisma.marketSnapshot.findMany({
      where: { assetId: asset.id },
      orderBy: { ingestedAt: "desc" },
      take: limit,
    });

    // On renvoie un format simple pour le front
    res.json({
      symbol,
      data: snapshots.map((s) => ({
        t: s.ingestedAt,
        priceUsd: s.priceUsd,
        volume24hUsd: s.volume24hUsd,
        marketCapUsd: s.marketCapUsd,
        change24hPct: s.change24hPct,
      })),
    });
  });

  return app;
}
