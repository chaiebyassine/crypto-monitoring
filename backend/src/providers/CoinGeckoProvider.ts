import { env } from "../config/env.js";

type CoinGeckoItem = {
  id: string;
  name: string;
  current_price: number;
  market_cap?: number;
  total_volume?: number;
  price_change_percentage_24h?: number;
};

let rateLimitedUntil: number | null = null;

export async function fetchFromCoinGecko(ids: string[]) {
  if (rateLimitedUntil && Date.now() < rateLimitedUntil) {
    const waitSecs = Math.ceil((rateLimitedUntil - Date.now()) / 1000);
    throw new Error(`Rate limited, retry in ${waitSecs}s`);
  }

  const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids.join(",")}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.httpTimeout);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { accept: "application/json" },
    });

    if (res.status === 429) {
      rateLimitedUntil = Date.now() + 60_000;
      throw new Error("Rate limited by CoinGecko, backing off for 60s");
    }

    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText}`);
    }

    rateLimitedUntil = null;
    const data = (await res.json()) as CoinGeckoItem[];

    return data.map((item) => ({
      providerId: item.id,
      source: "coingecko" as const,
      symbol: item.id,
      name: item.name,
      priceUsd: item.current_price,
      volume24hUsd: item.total_volume ?? null,
      marketCapUsd: item.market_cap ?? null,
      change24hPct:
        typeof item.price_change_percentage_24h === "number"
          ? item.price_change_percentage_24h
          : null,
    }));
  } finally {
    clearTimeout(timeout);
  }
}
