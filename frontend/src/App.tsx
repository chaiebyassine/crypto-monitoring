import { useMemo, useState } from "react";
import { useMarketData } from "./hooks/useMarketData";
import { buildChartData } from "./utils/series";
import { minmax, paddedDomain } from "./utils/domains";
import { normalizeSeries, pctChange, pctFromNormalized } from "./utils/percent";
import Controls from "./components/Controls";
import PriceBadges from "./components/PriceBadges";
import CryptoChart from "./components/CryptoChart";

export default function App() {
  const [symbol, setSymbol] = useState("bitcoin");
  const [compare, setCompare] = useState<string>("");
  const [limit, setLimit] = useState(50);

  const [showSMA, setShowSMA] = useState(true);
  const [smaWin, setSmaWin] = useState(10);
  const [showEMA, setShowEMA] = useState(false);
  const [emaWin, setEmaWin] = useState(20);

  const [normalize, setNormalize] = useState(false);

  const { assets, dataPrimary, dataCompare, loading, err } =
    useMarketData(symbol, compare, limit);

  const chartData = useMemo(
    () =>
      buildChartData({
        symbol, compare, dataPrimary, dataCompare,
        normalize, showSMA, showEMA, smaWin, emaWin, normalizeSeries
      }),
    [symbol, compare, dataPrimary, dataCompare, normalize, showSMA, showEMA, smaWin, emaWin]
  );

  const leftValues = chartData.map((r: any) => r[symbol]);
  const rightValues = compare ? chartData.map((r: any) => r[compare]) : [];
  const [leftMin, leftMax] = minmax(leftValues);
  const [rightMin, rightMax] = minmax(rightValues);
  const leftDomain = paddedDomain(leftMin, leftMax);
  const rightDomain = paddedDomain(rightMin, rightMax);

  const last = dataPrimary.at(-1);
  const lastPrice = last?.priceUsd?.toLocaleString(undefined, { maximumFractionDigits: 6 });
  const lastTime = last ? new Date(last.t).toLocaleString() : "-";

  const pctPrimary = normalize
    ? pctFromNormalized(chartData.at(-1)?.[symbol])
    : pctChange(dataPrimary);

  const pctCompareVal =
    compare
      ? normalize
        ? pctFromNormalized(chartData.at(-1)?.[compare])
        : pctChange(dataCompare)
      : null;

  return (
    <div className="app">
      <div className="header">
        <h1>Crypto Dashboard</h1>
      </div>

      <Controls
        assets={assets}
        symbol={symbol}
        compare={compare}
        limit={limit}
        showSMA={showSMA}
        smaWin={smaWin}
        showEMA={showEMA}
        emaWin={emaWin}
        normalize={normalize}
        loading={loading}
        onChange={(p) => {
          if (p.symbol !== undefined) setSymbol(p.symbol);
          if (p.compare !== undefined) setCompare(p.compare);
          if (p.limit !== undefined) setLimit(p.limit);
          if (p.showSMA !== undefined) setShowSMA(p.showSMA);
          if (p.smaWin !== undefined) setSmaWin(p.smaWin);
          if (p.showEMA !== undefined) setShowEMA(p.showEMA);
          if (p.emaWin !== undefined) setEmaWin(p.emaWin);
          if (p.normalize !== undefined) setNormalize(p.normalize);
        }}
      />

      <PriceBadges
        lastPrice={lastPrice}
        lastTime={lastTime}
        symbol={symbol}
        compare={compare || undefined}
        pctPrimary={pctPrimary}
        pctCompareVal={pctCompareVal}
      />

      {err && <div className="error-message">Erreur : {err}</div>}
      {loading && <div className="loading">Chargement...</div>}

      {!loading && !err && chartData.length > 0 && (
        <CryptoChart
          data={chartData}
          symbol={symbol}
          compare={compare || undefined}
          normalize={normalize}
          leftDomain={leftDomain}
          rightDomain={rightDomain}
          showSMA={showSMA}
          showEMA={showEMA}
        />
      )}
    </div>
  );
}
