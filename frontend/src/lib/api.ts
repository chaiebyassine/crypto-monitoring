const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

export type Asset = { id: number; symbol: string; name: string };
export type PricePoint = { t: string; priceUsd: number };

export async function fetchAssets(): Promise<Asset[]> {
  const r = await fetch(`${BASE}/assets`);
  if (!r.ok) throw new Error("Failed /assets");
  const j = await r.json();
  return j.data ?? [];
}

export async function fetchPrices(symbol: string, limit = 50): Promise<PricePoint[]> {
  const r = await fetch(`${BASE}/prices?symbol=${encodeURIComponent(symbol)}&limit=${limit}`);
  if (!r.ok) throw new Error("Failed /prices");
  const j = await r.json();
  return (j.data ?? []).map((d: any) => ({ t: d.t, priceUsd: d.priceUsd }));
}
export async function fetchChanges(): Promise<{symbol:string;name:string;last:number|null;change24hPct:number|null}[]> {
  const r = await fetch(`${BASE}/changes`);
  const j = await r.json();
  return j.data ?? [];
}
export type OhlcPoint = {
  t: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number | null;
};

export async function fetchOhlc(
  symbol: string,
  granularity: string = "1h"
): Promise<OhlcPoint[]> {
  const r = await fetch(
    `${BASE}/prices/ohlc?symbol=${encodeURIComponent(
      symbol
    )}&granularity=${encodeURIComponent(granularity)}`
  );
  if (!r.ok) {
    throw new Error("Failed /prices/ohlc");
  }
  const j = await r.json();
  return (j.data ?? []).map((d: any) => ({
    t: d.t,
    open: d.open,
    high: d.high,
    low: d.low,
    close: d.close,
    volume: d.volume ?? d.volumeUsd ?? null,
  }));
}


