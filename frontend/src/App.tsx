import { useEffect, useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  fetchAssets,
  fetchPrices,
  type Asset,
  type PricePoint,
} from "./lib/api";

function sma(series: PricePoint[], window: number) {
  const out: Array<{ t: string; SMA: number }> = [];
  let sum = 0;
  for (let i = 0; i < series.length; i++) {
    sum += series[i].priceUsd;
    if (i >= window) sum -= series[i - window].priceUsd;
    if (i >= window - 1) out.push({ t: series[i].t, SMA: sum / window });
  }
  return out;
}
function ema(series: PricePoint[], window: number) {
  const out: Array<{ t: string; EMA: number }> = [];
  const k = 2 / (window + 1);
  let prev: number | null = null;
  for (let i = 0; i < series.length; i++) {
    const p = series[i].priceUsd;
    prev = prev == null ? p : p * k + prev * (1 - k);
    out.push({ t: series[i].t, EMA: prev });
  }
  return out.slice(window - 1);
}

function minmax(nums: number[]) {
  const arr = nums.filter((n) => Number.isFinite(n)) as number[];
  if (arr.length === 0) return [0, 0] as const;
  return [Math.min(...arr), Math.max(...arr)] as const;
}
function paddedDomain(min: number, max: number) {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 1] as const;
  if (min === max) {
    const pad = Math.max(0.01, Math.abs(min) * 0.001);
    return [min - pad, max + pad] as const;
  }
  const pad = (max - min) * 0.05;
  return [min - pad, max + pad] as const;
}


export default function App() {
  const [assets, setAssets] = useState<Asset[]>([]);

  const [symbol, setSymbol] = useState("bitcoin");
  const [compare, setCompare] = useState<string>("");
  const [limit, setLimit] = useState(50);

  const [dataPrimary, setDataPrimary] = useState<PricePoint[]>([]);
  const [dataCompare, setDataCompare] = useState<PricePoint[]>([]);

  const [showSMA, setShowSMA] = useState(true);
  const [smaWin, setSmaWin] = useState(10);
  const [showEMA, setShowEMA] = useState(false);
  const [emaWin, setEmaWin] = useState(20);

  const [normalize, setNormalize] = useState(false); // ✅ Variation %

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetchAssets().then(setAssets).catch((e) => setErr(String(e)));
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setErr(null);
      try {
        const p = await fetchPrices(symbol, limit);
        const pSorted = [...p].sort(
          (a, b) => new Date(a.t).getTime() - new Date(b.t).getTime()
        );
        setDataPrimary(pSorted);

        if (compare) {
          const c = await fetchPrices(compare, limit);
          const cSorted = [...c].sort(
            (a, b) => new Date(a.t).getTime() - new Date(b.t).getTime()
          );
          setDataCompare(cSorted);
        } else {
          setDataCompare([]);
        }
      } catch (e) {
        setErr(String(e));
      } finally {
        setLoading(false);
      }
    };

    load();
    const id = window.setInterval(load, 60000);
    return () => window.clearInterval(id);
  }, [symbol, compare, limit]);

  function normalizeSeries(series: PricePoint[]) {
    if (series.length === 0) return [] as Array<{ t: string; v: number }>;
    const base = series[0].priceUsd || 1;
    return series.map((d) => ({ t: d.t, v: (d.priceUsd / base) * 100 }));
  }

  /* --- Fusion/alignement + indicateurs --- */
  const chartData = useMemo(() => {
    if (dataPrimary.length === 0) return [];

    if (normalize) {
      if (!compare || dataCompare.length === 0) {
        const prim = normalizeSeries(dataPrimary);
        return prim.map((d) => ({ t: d.t, [symbol]: d.v }));
      }
      const aN = normalizeSeries(dataPrimary);
      const bN = normalizeSeries(dataCompare);
      const minLen = Math.min(aN.length, bN.length);
      const startA = aN.length - minLen;
      const startB = bN.length - minLen;

      return Array.from({ length: minLen }, (_, k) => {
        const a = aN[startA + k];
        const b = bN[startB + k];
        return { t: a.t, [symbol]: a.v, [compare]: b.v };
      });
    }

    if (!compare || dataCompare.length === 0) {
      const base = dataPrimary.map((d) => ({ t: d.t, [symbol]: d.priceUsd }));

      if (showSMA) {
        for (const { t, SMA } of sma(dataPrimary, Math.max(2, smaWin))) {
          const row = base.find((r) => r.t === t);
          if (row) (row as any).SMA = SMA;
        }
      }
      if (showEMA) {
        for (const { t, EMA } of ema(dataPrimary, Math.max(2, emaWin))) {
          const row = base.find((r) => r.t === t);
          if (row) (row as any).EMA = EMA;
        }
      }
      return base;
    }

    const minLen = Math.min(dataPrimary.length, dataCompare.length);
    const startA = dataPrimary.length - minLen;
    const startB = dataCompare.length - minLen;

    const base: Array<Record<string, any>> = Array.from(
      { length: minLen },
      (_, k) => {
        const a = dataPrimary[startA + k];
        const b = dataCompare[startB + k];
        return { t: a.t, [symbol]: a.priceUsd, [compare]: b.priceUsd };
      }
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
  }, [
    dataPrimary,
    dataCompare,
    symbol,
    compare,
    showSMA,
    showEMA,
    smaWin,
    emaWin,
    normalize,
  ]);

  const leftValues = chartData.map((r: any) => r[symbol]);
  const rightValues = compare ? chartData.map((r: any) => r[compare]) : [];
  const [leftMin, leftMax] = minmax(leftValues);
  const [rightMin, rightMax] = minmax(rightValues);
  const leftDomain = paddedDomain(leftMin, leftMax);
  const rightDomain = paddedDomain(rightMin, rightMax);

  const last = dataPrimary.at(-1);
  const lastPrice = last?.priceUsd?.toLocaleString(undefined, {
    maximumFractionDigits: 6,
  });
  const lastTime = last ? new Date(last.t).toLocaleString() : "-";

  function pctChange(series: { priceUsd: number }[]) {
    if (!series || series.length < 2) return null;
    const first = series[0].priceUsd;
    const lastV = series[series.length - 1].priceUsd;
    if (!first || !Number.isFinite(first) || !Number.isFinite(lastV)) return null;
    return ((lastV - first) / first) * 100;
  }
  function pctFromNormalized(lastValue: number | undefined) {
    if (!Number.isFinite(lastValue!)) return null;
    return lastValue! - 100;
  }

  const pctPrimary = (() => {
    if (normalize) {
      const lastNorm =
        chartData.length > 0 ? (chartData[chartData.length - 1] as any)[symbol] : undefined;
      return pctFromNormalized(lastNorm);
    }
    return pctChange(dataPrimary);
  })();

  const pctCompareVal = (() => {
    if (!compare) return null;
    if (normalize) {
      const lastNorm =
        chartData.length > 0 ? (chartData[chartData.length - 1] as any)[compare] : undefined;
      return pctFromNormalized(lastNorm);
    }
    return pctChange(dataCompare);
  })();

  return (
    <div className="app">
      <div className="header">
        <h1>Crypto Dashboard </h1>
      </div>

      <div className="controls">
        <div className="control-item">
          <label>Crypto</label>
          <select
            value={symbol}
            onChange={(e) => {
              const v = e.target.value;
              setSymbol(v);
              if (compare === v) setCompare("");
            }}
            disabled={loading}
          >
            {assets.map((a) => (
              <option key={a.id} value={a.symbol}>
                {a.symbol.toUpperCase()}
              </option>
            ))}
          </select>
        </div>

        <div className="control-item">
          <label>Comparer avec</label>
          <select
            value={compare}
            onChange={(e) => setCompare(e.target.value)}
            disabled={loading}
          >
            <option value="">(aucun)</option>
            {assets
              .filter((a) => a.symbol !== symbol)
              .map((a) => (
                <option key={a.id} value={a.symbol}>
                  {a.symbol.toUpperCase()}
                </option>
              ))}
          </select>
        </div>

        <div className="control-item">
          <label>Période</label>
          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            disabled={loading}
          >
            <option value={20}>20 points</option>
            <option value={50}>50 points</option>
            <option value={100}>100 points</option>
            <option value={200}>200 points</option>
          </select>
        </div>

        <div className="control-item">
          <label>Variation %</label>
          <input
            type="checkbox"
            checked={normalize}
            onChange={(e) => setNormalize(e.target.checked)}
            title="Compare les tendances (index 100)"
          />
        </div>

        <div className="control-item" style={{ opacity: normalize ? 0.5 : 1 }}>
          <label>SMA</label>
          <input
            type="checkbox"
            checked={!normalize && showSMA}
            onChange={(e) => setShowSMA(e.target.checked)}
            disabled={normalize}
            style={{ marginRight: 8 }}
          />
          <input
            type="number"
            min={2}
            max={60}
            value={smaWin}
            onChange={(e) => setSmaWin(Math.max(2, Number(e.target.value)))}
            disabled={normalize}
            style={{ width: 64 }}
          />
        </div>

        <div className="control-item" style={{ opacity: normalize ? 0.5 : 1 }}>
          <label>EMA</label>
          <input
            type="checkbox"
            checked={!normalize && showEMA}
            onChange={(e) => setShowEMA(e.target.checked)}
            disabled={normalize}
            style={{ marginRight: 8 }}
          />
          <input
            type="number"
            min={2}
            max={60}
            value={emaWin}
            onChange={(e) => setEmaWin(Math.max(2, Number(e.target.value)))}
            disabled={normalize}
            style={{ width: 64 }}
          />
        </div>

        <div className="price-info">
          <span className="price-value">{lastPrice ?? "-"} USD</span>
          <span className="price-time">Mis à jour: {lastTime}</span>

          {pctPrimary != null && (
            <span
              style={{
                marginLeft: 8,
                padding: "2px 8px",
                borderRadius: 6,
                fontWeight: 600,
                background:
                  pctPrimary >= 0 ? "rgba(0, 255, 135, 0.12)" : "rgba(220, 20, 60, 0.12)",
                color: pctPrimary >= 0 ? "#00ff87" : "crimson",
                border: `1px solid ${pctPrimary >= 0 ? "#00ff87" : "crimson"}`,
              }}
              title={`Variation ${symbol.toUpperCase()} sur la période`}
            >
              {symbol.toUpperCase()} {pctPrimary >= 0 ? "+" : ""}
              {pctPrimary.toFixed(2)}%
            </span>
          )}

          {pctCompareVal != null && compare && (
            <span
              style={{
                marginLeft: 6,
                padding: "2px 8px",
                borderRadius: 6,
                fontWeight: 600,
                background:
                  pctCompareVal >= 0
                    ? "rgba(79, 209, 197, 0.12)"
                    : "rgba(220, 20, 60, 0.12)",
                color: pctCompareVal >= 0 ? "#4fd1c5" : "crimson",
                border: `1px solid ${pctCompareVal >= 0 ? "#4fd1c5" : "crimson"}`,
              }}
              title={`Variation ${compare.toUpperCase()} sur la période`}
            >
              {compare.toUpperCase()} {pctCompareVal >= 0 ? "+" : ""}
              {pctCompareVal.toFixed(2)}%
            </span>
          )}
        </div>
      </div>

      {err && <div className="error-message">Erreur : {err}</div>}
      {loading && <div className="loading">Chargement...</div>}

      {!loading && !err && chartData.length > 0 && (
        <div className="chart-container">
          <ResponsiveContainer>
            <LineChart data={chartData}>
              <XAxis
                dataKey="t"
                tickFormatter={(v) => new Date(v).toLocaleTimeString()}
                minTickGap={32}
                stroke="#a0aec0"
              />

              {normalize ? (
                <YAxis
                  yAxisId="left"
                  domain={paddedDomain(95, 105)}
                  tickFormatter={(v) => `${v.toFixed(1)} %`}
                  width={72}
                  stroke="#a0aec0"
                />
              ) : (
                <>
                  <YAxis
                    yAxisId="left"
                    domain={leftDomain}
                    tickFormatter={(v) => v.toLocaleString()}
                    width={72}
                    stroke="#a0aec0"
                  />
                  <YAxis
                    yAxisId="right"
                    hide={!compare}
                    orientation="right"
                    domain={rightDomain}
                    tickFormatter={(v) => v.toLocaleString()}
                    width={72}
                    stroke="#a0aec0"
                  />
                </>
              )}

              <Tooltip
                formatter={(v: number, name: string) => [
                  normalize ? `${v.toFixed(2)} %` : `${v.toLocaleString()} USD`,
                  name,
                ]}
                labelFormatter={(l) => new Date(l).toLocaleString()}
                contentStyle={{
                  background: "#1a1f2e",
                  border: "1px solid #2d3748",
                  color: "#ffffff",
                }}
              />
              <Legend />

              <Line
                yAxisId="left"
                type="monotone"
                dataKey={symbol}
                name={symbol.toUpperCase()}
                dot={false}
                connectNulls
                isAnimationActive={false}
                strokeWidth={2}
                stroke="#00ff87"
              />
              {compare && (
                <Line
                  yAxisId={normalize ? "left" : "right"}
                  type="monotone"
                  dataKey={compare}
                  name={compare.toUpperCase()}
                  dot={false}
                  connectNulls
                  isAnimationActive={false}
                  strokeWidth={2}
                  stroke="#4fd1c5"
                />
              )}

              {!normalize && (
                <>
                  {showSMA && (
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="SMA"
                      dot={false}
                      strokeWidth={2}
                      stroke="#9f7aea"
                    />
                  )}
                  {showEMA && (
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="EMA"
                      dot={false}
                      strokeWidth={2}
                      stroke="#f6ad55"
                    />
                  )}
                </>
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
