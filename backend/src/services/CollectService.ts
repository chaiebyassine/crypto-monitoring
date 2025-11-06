// backend/src/services/CollectService.ts
/**
 * Un run de collecte :
 * - trace le run dans CollectRun
 * - récupère les données chez le provider (CoinCap ou CoinGecko)
 * - upsert Asset + insère MarketSnapshot
 * - met à jour CollectRun (success/fail)
 */

import { prisma } from "../repos/prisma.js";
import { env } from "../config/env.js";
import { fetchFromCoinCap } from "../providers/CoinCapProvider.js";
import { fetchFromCoinGecko } from "../providers/CoinGeckoProvider.js";

// --- Optionnel : mode mock pour avancer sans Internet (USE_MOCK=1 dans .env)
function mockRows(ids: string[]) {
  return ids.map((id) => ({
    providerId: id,
    source: "mock" as const,
    symbol: id,
    name: id,
    priceUsd: 100 + Math.random() * 1000,
    volume24hUsd: Math.random() * 1_000_000,
    marketCapUsd: Math.random() * 10_000_000,
    change24hPct: (Math.random() - 0.5) * 10,
  }));
}

export async function runOnce() {
  // 1) début de run
  const run = await prisma.collectRun.create({
    data: { status: "running", assetsCount: 0, insertedCount: 0 },
  });

  try {
    // 2) Sélection du provider (UNE SEULE fois)
    const rows =
      process.env.USE_MOCK === "1"
        ? mockRows(env.coins)
        : env.provider === "coincap"
        ? await fetchFromCoinCap(env.coins)
        : env.provider === "coingecko"
        ? await fetchFromCoinGecko(env.coins)
        : (() => {
            throw new Error(`Provider non géré: ${env.provider}`);
          })();

    let inserted = 0;

    // 3) pipeline par enregistrement
    for (const r of rows) {
      // validation simple
      if (!Number.isFinite(r.priceUsd) || r.priceUsd <= 0) continue;

      // upsert de l'asset
      const asset = await prisma.asset.upsert({
        where: { providerId: r.providerId },
        update: {},
        create: {
          providerId: r.providerId,
          source: r.source,
          symbol: r.symbol,
          name: r.name,
        },
      });

      // insertion du snapshot
      await prisma.marketSnapshot.create({
        data: {
          assetId: asset.id,
          priceUsd: r.priceUsd,
          volume24hUsd: r.volume24hUsd,
          marketCapUsd: r.marketCapUsd,
          change24hPct: r.change24hPct,
        },
      });

      inserted++;
    }

    // 4) fin de run (succès)
    await prisma.collectRun.update({
      where: { id: run.id },
      data: {
        status: "success",
        assetsCount: rows.length,
        insertedCount: inserted,
        endedAt: new Date(),
      },
    });

    return { inserted, total: rows.length };
  } catch (err: any) {
    // 5) fin de run (échec)
    await prisma.collectRun.update({
      where: { id: run.id },
      data: {
        status: "fail",
        errorMessage: String(err?.message ?? err),
        endedAt: new Date(),
      },
    });
    throw err;
  }
}
