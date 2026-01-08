import { prisma } from "../repos/prisma.js";
import { AssetService } from "./AssetService.js";

/**
 * Service pour la gestion des prix et snapshots de marché
 */
export const PriceService = {
  /**
   * Récupère les derniers prix et variations pour tous les assets
   */
  async getChanges() {
    const assets = await AssetService.getAll();

    return Promise.all(
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
  },

  /**
   * Récupère l'historique des prix pour un asset
   */
  async getPriceHistory(symbol: string, limit: number = 20) {
    const asset = await AssetService.getBySymbol(symbol);
    if (!asset) return { symbol, data: [] };

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

    return { symbol, data };
  },

  /**
   * Récupère les données OHLC pour les graphiques en chandelier
   */
  async getOHLC(symbol: string, granularity: string = "1h") {
    const asset = await AssetService.getBySymbol(symbol);
    if (!asset) return { symbol, granularity, data: [] };

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

    return { symbol, granularity, data: candles };
  },
};
