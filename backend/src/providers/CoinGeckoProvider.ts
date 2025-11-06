// backend/src/providers/CoinGeckoProvider.ts
import { env } from "../config/env.js";

type CGResp = Record<string, {
  usd: number; usd_market_cap?: number; usd_24h_change?: number
}>;

export async function fetchFromCoinGecko(ids: string[]) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), env.httpTimeout);

  const base = "https://api.coingecko.com/api/v3/simple/price";
  const qs = new URLSearchParams({
    ids: ids.join(","),
    vs_currencies: "usd",
    include_24hr_change: "true",
    include_market_cap: "true",
    precision: "full",
  });

  const res = await fetch(`${base}?${qs.toString()}`, {
    signal: ac.signal,
    headers: { accept: "application/json" },
  });
  clearTimeout(t);

  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);

  const json = (await res.json()) as CGResp;
  return ids.filter((id) => json[id]).map((id) => ({
    providerId: id,
    source: "coingecko" as const,
    symbol: id,
    name: id,
    priceUsd: json[id].usd,
    volume24hUsd: null,
    marketCapUsd: json[id].usd_market_cap ?? null,
    change24hPct: json[id].usd_24h_change ?? null,
  }));
}
