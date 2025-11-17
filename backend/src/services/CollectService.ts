import { prisma } from "../repos/prisma.js";
import { env } from "../config/env.js";
import { fetchFromCoinGecko } from "../providers/CoinGeckoProvider.js";

export async function runOnce() {
  const run = await prisma.collectRun.create({
    data: { status: "running", assetsCount: 0, insertedCount: 0 },
  });

  try {
    const ids = env.coins;

    const rows = await fetchFromCoinGecko(ids);

    let inserted = 0;
    for (const r of rows) {
      if (!Number.isFinite(r.priceUsd) || r.priceUsd <= 0) continue;

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
