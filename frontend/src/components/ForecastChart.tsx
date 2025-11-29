import { useState, useEffect, useMemo } from "react";
import {
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
  Area,
  ComposedChart,
} from "recharts";
import {
  fetchForecast,
  fetchAssets,
  type Forecast,
  type ForecastMethod,
  type Asset,
} from "../lib/api";

const METHODS: { value: ForecastMethod; label: string; description: string }[] = [
  { value: "sma", label: "SMA", description: "Simple Moving Average" },
  { value: "ema", label: "EMA", description: "Exponential Moving Average" },
  { value: "linear", label: "Linear", description: "Linear Regression" },
];

export default function ForecastChart() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [symbol, setSymbol] = useState("bitcoin");
  const [method, setMethod] = useState<ForecastMethod>("ema");
  const [historyCount, setHistoryCount] = useState(50);
  const [stepsCount, setStepsCount] = useState(10);
  const [forecast, setForecast] = useState<Forecast | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAssets().then(setAssets).catch(console.error);
  }, []);

  useEffect(() => {
    loadForecast();
  }, [symbol, method, historyCount, stepsCount]);

  async function loadForecast() {
    try {
      setLoading(true);
      const data = await fetchForecast(symbol, method, historyCount, stepsCount);
      setForecast(data);
      setError(null);
    } catch (e: any) {
      setError(e.message);
      setForecast(null);
    } finally {
      setLoading(false);
    }
  }

  const chartData = useMemo(() => {
    if (!forecast) return [];

    const historical = forecast.historical.map((p) => ({
      t: new Date(p.t).getTime(),
      historical: p.price,
      predicted: null as number | null,
    }));

    const lastHistorical = historical[historical.length - 1];

    const predictions = forecast.predicted.map((p, i) => ({
      t: new Date(p.t).getTime(),
      historical: i === 0 ? lastHistorical?.historical : null,
      predicted: p.price,
    }));

    return [...historical, ...predictions];
  }, [forecast]);

  const domain = useMemo(() => {
    if (chartData.length === 0) return [0, 1];
    const prices = chartData
      .flatMap((d) => [d.historical, d.predicted])
      .filter((p): p is number => p !== null);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const pad = (max - min) * 0.1;
    return [min - pad, max + pad];
  }, [chartData]);

  const lastHistoricalTime = forecast?.historical[forecast.historical.length - 1]?.t;

  const formatPrice = (value: number) => {
    if (value >= 1000) {
      return `$${(value / 1000).toFixed(1)}k`;
    }
    return `$${value.toFixed(2)}`;
  };

  return (
    <div className="panel forecast-panel">
      <div className="panel-header">
        <h2 className="panel-title">
          <span className="panel-icon">📈</span>
          Price Forecast
        </h2>
      </div>

      {/* Controls */}
      <div className="forecast-controls">
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Asset</label>
            <select
              className="form-select"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
            >
              {assets.map((a) => (
                <option key={a.id} value={a.symbol}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Method</label>
            <select
              className="form-select"
              value={method}
              onChange={(e) => setMethod(e.target.value as ForecastMethod)}
            >
              {METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label} - {m.description}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">History Points</label>
            <select
              className="form-select"
              value={historyCount}
              onChange={(e) => setHistoryCount(Number(e.target.value))}
            >
              <option value={20}>20 points</option>
              <option value={50}>50 points</option>
              <option value={100}>100 points</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Prediction Steps</label>
            <select
              className="form-select"
              value={stepsCount}
              onChange={(e) => setStepsCount(Number(e.target.value))}
            >
              <option value={5}>5 steps</option>
              <option value={10}>10 steps</option>
              <option value={20}>20 steps</option>
            </select>
          </div>
        </div>
      </div>

      {error && <div className="panel-error">{error}</div>}

      {/* Metrics */}
      {forecast?.metrics && (
        <div className="forecast-metrics">
          <div className="metric-card">
            <span className="metric-label">Current Price</span>
            <span className="metric-value">
              ${(forecast.metrics.lastPrice ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="metric-card">
            <span className="metric-label">Predicted Price</span>
            <span className="metric-value">
              ${(forecast.metrics.predictedPrice ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="metric-card">
            <span className="metric-label">Predicted Change</span>
            <span className={`metric-value ${(forecast.metrics.predictedChange ?? 0) >= 0 ? "positive" : "negative"}`}>
              {(forecast.metrics.predictedChange ?? 0) >= 0 ? "+" : ""}
              ${Math.abs(forecast.metrics.predictedChange ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="metric-card">
            <span className="metric-label">Change %</span>
            <span className={`metric-value ${(forecast.metrics.predictedChangePct ?? 0) >= 0 ? "positive" : "negative"}`}>
              {(forecast.metrics.predictedChangePct ?? 0) >= 0 ? "+" : ""}
              {(forecast.metrics.predictedChangePct ?? 0).toFixed(2)}%
            </span>
          </div>
        </div>
      )}

      {/* Chart */}
      {loading ? (
        <div className="panel-loading">Loading forecast...</div>
      ) : chartData.length > 0 ? (
        <div className="forecast-chart" style={{ width: '100%', minHeight: 400 }}>
          <ResponsiveContainer width="100%" height={400}>
            <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
              <defs>
                <linearGradient id="historicalGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#60efff" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#60efff" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="predictedGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00ff87" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#00ff87" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="t"
                type="number"
                domain={["dataMin", "dataMax"]}
                tickFormatter={(ts) => new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                stroke="#64748b"
                fontSize={12}
                tickLine={false}
              />
              <YAxis
                domain={domain}
                tickFormatter={formatPrice}
                stroke="#64748b"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1a1f2e",
                  border: "1px solid #2d3748",
                  borderRadius: 8,
                  boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
                }}
                labelFormatter={(ts) => new Date(ts).toLocaleString()}
                formatter={(value: number, name: string) => [
                  `$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
                  name === "historical" ? "Historical" : "Predicted",
                ]}
              />
              <Legend
                wrapperStyle={{ paddingTop: 20 }}
                formatter={(value) => (value === "historical" ? "Historical" : "Predicted")}
              />
              {lastHistoricalTime && (
                <ReferenceLine
                  x={new Date(lastHistoricalTime).getTime()}
                  stroke="#64748b"
                  strokeDasharray="5 5"
                  label={{
                    value: "Now",
                    fill: "#64748b",
                    fontSize: 12,
                    position: "top",
                  }}
                />
              )}
              <Area
                type="monotone"
                dataKey="historical"
                stroke="#60efff"
                fill="url(#historicalGradient)"
                strokeWidth={2}
                dot={false}
                connectNulls
              />
              <Line
                type="monotone"
                dataKey="predicted"
                name="predicted"
                stroke="#00ff87"
                strokeWidth={2}
                strokeDasharray="8 4"
                dot={{ fill: "#00ff87", r: 3 }}
                connectNulls
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      ) : !loading && !error ? (
        <div className="panel-empty">No forecast data available</div>
      ) : null}
    </div>
  );
}
