import type { PricePoint } from "../lib/api";

export function normalizeSeries(series: PricePoint[]) {
  if (series.length === 0) return [] as Array<{ t: string; v: number }>;
  const base = series[0].priceUsd || 1;
  return series.map((d) => ({ t: d.t, v: (d.priceUsd / base) * 100 }));
}

export function pctChange(series: { priceUsd: number }[]) {
  if (!series || series.length < 2) return null;
  const first = series[0].priceUsd;
  const lastV = series[series.length - 1].priceUsd;
  if (!first || !Number.isFinite(first) || !Number.isFinite(lastV)) return null;
  return ((lastV - first) / first) * 100;
}

export function pctFromNormalized(lastValue: number | undefined) {
  if (!Number.isFinite(lastValue!)) return null;
  return lastValue! - 100;
}
