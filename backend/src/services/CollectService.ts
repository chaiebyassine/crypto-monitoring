import { prisma } from "../repos/prisma.js";
import { env } from "../config/env.js";
import { fetchFromCoinGecko } from "../providers/CoinGeckoProvider.js";
import { fetchFromMock } from "../providers/MockProvider.js";
import { evaluateAlerts } from "./AlertService.js";

type ProviderRow = {
  providerId: string;
  source: string;
  symbol: string;
  name: string;
  priceUsd: number;
  volume24hUsd: number | null;
  marketCapUsd: number | null;
  change24hPct: number | null;
};


async function fetchPrices(ids: string[]): Promise<ProviderRow[]> {
  if (env.provider === "mock") {
    console.log("[collect] Using mock provider");
    return fetchFromMock(ids);
  }

  try {
    return await fetchFromCoinGecko(ids);
  } catch (err) {
    if (env.useMockFallback) {
      console.warn("[collect] CoinGecko failed, falling back to mock:", err);
      return fetchFromMock(ids);
    }
    throw err;
  }
}


export async function runOnce() {
  const run = await prisma.collectRun.create({
    data: { status: "running", assetsCount: 0, insertedCount: 0 },
  });

  try {
    const ids = env.coins;
    const rows = await fetchPrices(ids);

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

    const alertResult = await evaluateAlerts();
    console.log(`Alerts evaluated: ${alertResult.evaluated}, triggered: ${alertResult.triggered}`);

    return { inserted, total: rows.length, alerts: alertResult };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.collectRun.update({
      where: { id: run.id },
      data: {
        status: "fail",
        errorMessage: message,
        endedAt: new Date(),
      },
    });
    throw err;
  }
}
