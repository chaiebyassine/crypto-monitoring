import { useEffect, useState } from "react";

import { useMarketData } from "./hooks/useMarketData";
import { buildChartData } from "./utils/series";
import { minmax, paddedDomain } from "./utils/domains";
import { normalizeSeries, pctChange, pctFromNormalized } from "./utils/percent";
import Controls from "./components/Controls";
import PriceBadges from "./components/PriceBadges";
import CryptoChart from "./components/CryptoChart";
 
import AlertsPanel from "./components/AlertsPanel";
import ForecastChart from "./components/ForecastChart";
import PortfolioPanel from "./components/PortfolioPanel";
import "./App.css";
import CandlestickChart from "./components/CandlestickChart";
import { fetchOhlc, type OhlcPoint } from "./lib/api";
import { useAuth } from "./contexts/AuthContext";
import LoginPage from "./components/LoginPage";
type Tab = "dashboard" | "forecast" | "alerts" | "portfolio";

export default function App() {
  const { user, loading: authLoading, logout } = useAuth();
  
  const [ohlcData, setOhlcData] = useState<OhlcPoint[]>([]);
  const [ohlcLoading, setOhlcLoading] = useState(false);
  const [ohlcError, setOhlcError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");

  

  const [symbol, setSymbol] = useState("bitcoin");
  const [compare, setCompare] = useState<string>("");
  const [limit, setLimit] = useState(50);

  const [showSMA, setShowSMA] = useState(true);
  const [smaWin, setSmaWin] = useState(10);
  const [showEMA, setShowEMA] = useState(false);
  const [emaWin, setEmaWin] = useState(20);
  const [chartMode, setChartMode] = useState<"line" | "ohlc">("line");

  const [normalize, setNormalize] = useState(false);

  useEffect(() => {
    if (chartMode !== "ohlc") return;
    setOhlcLoading(true);
    setOhlcError(null);
    fetchOhlc(symbol, "1h")
      .then((d) => setOhlcData(d))
      .catch((e) => setOhlcError(String(e)))
      .finally(() => setOhlcLoading(false));
  }, [chartMode, symbol]);

  const { assets, dataPrimary, dataCompare, loading, err } =
    useMarketData(symbol, compare, limit);

  const chartData = buildChartData({
    symbol, compare, dataPrimary, dataCompare,
    normalize, showSMA, showEMA, smaWin, emaWin, normalizeSeries
  });

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

  // Afficher un loader pendant la vérification de l'auth
  if (authLoading) {
    return (
      <div className="app">
        <div className="loading" style={{ marginTop: "20vh", textAlign: "center" }}>
          Chargement...
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">Crypto Dashboard</h1>
        <nav className="nav-tabs">
          <button
            className={`nav-tab ${activeTab === "dashboard" ? "active" : ""}`}
            onClick={() => setActiveTab("dashboard")}
          >
            <span className="nav-icon">📊</span>
            Dashboard
          </button>
          <button
            className={`nav-tab ${activeTab === "forecast" ? "active" : ""}`}
            onClick={() => setActiveTab("forecast")}
          >
            <span className="nav-icon">📈</span>
            Forecast
          </button>
          <button
            className={`nav-tab ${activeTab === "alerts" ? "active" : ""}`}
            onClick={() => setActiveTab("alerts")}
          >
            <span className="nav-icon">🔔</span>
            Alerts
          </button>
          <button
            className={`nav-tab ${activeTab === "portfolio" ? "active" : ""}`}
            onClick={() => setActiveTab("portfolio")}
          >
            <span className="nav-icon">💼</span>
            Portfolio
          </button>
        </nav>
        <div className="user-info">
          <span className="user-name">👤 {user.name || user.email}</span>
          <button className="logout-btn" onClick={logout}>
            Déconnexion
          </button>
        </div>
      </header>

      <main className="app-content">
        {activeTab === "dashboard" && (
          <div className="dashboard-view">
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
              chartMode={chartMode}
              onChange={(p) => {
                if (p.symbol !== undefined) setSymbol(p.symbol);
                if (p.compare !== undefined) setCompare(p.compare);
                if (p.limit !== undefined) setLimit(p.limit);
                if (p.showSMA !== undefined) setShowSMA(p.showSMA);
                if (p.smaWin !== undefined) setSmaWin(p.smaWin);
                if (p.showEMA !== undefined) setShowEMA(p.showEMA);
                if (p.emaWin !== undefined) setEmaWin(p.emaWin);
                if (p.normalize !== undefined) setNormalize(p.normalize);
                if (p.chartMode !== undefined) setChartMode(p.chartMode);
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

            {err && <div className="error-message">Error: {err}</div>}
            {loading && <div className="loading">Loading data...</div>}

            {/* Mode Courbe classique */}
            {!loading && !err && chartData.length > 0 && chartMode === "line" && (
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

            {/* Mode Chandeliers (OHLC) */}
            {chartMode === "ohlc" && (
              <div className="chart-container">
                {ohlcError && <div className="error-message">Erreur : {ohlcError}</div>}
                {ohlcLoading && <div className="loading">Chargement OHLC...</div>}
                {!ohlcLoading && !ohlcError && ohlcData.length > 0 && (
                  <CandlestickChart data={ohlcData} />
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === "forecast" && <ForecastChart />}
        {activeTab === "alerts" && <AlertsPanel />}
        {activeTab === "portfolio" && <PortfolioPanel />}
      </main>
    </div>
  );
}
