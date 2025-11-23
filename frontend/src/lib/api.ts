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

