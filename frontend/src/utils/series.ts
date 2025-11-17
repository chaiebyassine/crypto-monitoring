// src/utils/series.ts
import type { PricePoint } from "../lib/api";
import { sma, ema } from "./indicators";

export type ChartRow = Record<string, any> & { t: string };

export function alignByIndex<T extends { t: string }>(
  a: T[], b: T[],
  map: (ax: T, bx: T) => ChartRow
) {
  const minLen = Math.min(a.length, b.length);
  const sa = a.length - minLen;
  const sb = b.length - minLen;
  return Array.from({ length: minLen }, (_, k) => map(a[sa + k], b[sb + k]));
}

export function buildChartData(params: {
  symbol: string;
  compare?: string;
  dataPrimary: PricePoint[];
  dataCompare: PricePoint[];
  normalize: boolean;
  showSMA: boolean;
  showEMA: boolean;
  smaWin: number;
  emaWin: number;
  normalizeSeries: (s: PricePoint[]) => Array<{ t: string; v: number }>;
}) {
  const {
    symbol, compare, dataPrimary, dataCompare,
    normalize, showSMA, showEMA, smaWin, emaWin, normalizeSeries
  } = params;

  if (dataPrimary.length === 0) return [] as ChartRow[];

  // Mode variation %
  if (normalize) {
    if (!compare || dataCompare.length === 0) {
      const prim = normalizeSeries(dataPrimary);
      return prim.map((d) => ({ t: d.t, [symbol]: d.v }));
    }
    const aN = normalizeSeries(dataPrimary);
    const bN = normalizeSeries(dataCompare);
    return alignByIndex(aN, bN, (a, b) => ({ t: a.t, [symbol]: a.v, [compare]: b.v }));
  }

  // Mode USD
  if (!compare || dataCompare.length === 0) {
    const base: ChartRow[] = dataPrimary.map((d) => ({ t: d.t, [symbol]: d.priceUsd }));
    if (showSMA) {
      for (const { t, SMA } of sma(dataPrimary, Math.max(2, smaWin))) {
        const row = base.find((r) => r.t === t);
        if (row) row.SMA = SMA;
      }
    }
    if (showEMA) {
      for (const { t, EMA } of ema(dataPrimary, Math.max(2, emaWin))) {
        const row = base.find((r) => r.t === t);
        if (row) row.EMA = EMA;
      }
    }
    return base;
  }

  const base = alignByIndex(
    dataPrimary,
    dataCompare,
    (a, b) => ({ t: a.t, [symbol]: a.priceUsd, [compare]: b.priceUsd })
  );

  if (showSMA) {
    const s = sma(dataPrimary, Math.max(2, smaWin));
    for (const { t, SMA } of s) {
      let idx = base.length - 1;
      while (idx >= 0 && base[idx].t > t) idx--;
      if (idx >= 0) base[idx].SMA = SMA;
    }
  }
  if (showEMA) {
    const e = ema(dataPrimary, Math.max(2, emaWin));
    for (const { t, EMA } of e) {
      let idx = base.length - 1;
      while (idx >= 0 && base[idx].t > t) idx--;
      if (idx >= 0) base[idx].EMA = EMA;
    }
  }
  return base;
}
