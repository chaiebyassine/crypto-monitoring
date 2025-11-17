import type { PricePoint } from "./api";

export function sma(series: PricePoint[], window: number): { t: string; sma: number }[] {
  const out: { t: string; sma: number }[] = [];
  let sum = 0;
  for (let i = 0; i < series.length; i++) {
    sum += series[i].priceUsd;
    if (i >= window) sum -= series[i - window].priceUsd;
    if (i >= window - 1) out.push({ t: series[i].t, sma: sum / window });
  }
  return out;
}

export function ema(series: PricePoint[], window: number): { t: string; ema: number }[] {
  const out: { t: string; ema: number }[] = [];
  const k = 2 / (window + 1);
  let prev: number | null = null;
  for (let i = 0; i < series.length; i++) {
    const p = series[i].priceUsd;
    prev = prev == null ? p : p * k + prev * (1 - k);
    out.push({ t: series[i].t, ema: prev });
  }
  return out.slice(window - 1); 
}
