import { useEffect, useMemo, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { fetchAssets, fetchPrices, type Asset, type PricePoint } from "./lib/api";

export default function App() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [symbol, setSymbol] = useState("bitcoin");
  const [limit, setLimit] = useState(50);            // ✅ filtre de période
  const [data, setData] = useState<PricePoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Charger la liste des actifs une seule fois
  useEffect(() => {
    fetchAssets().then(setAssets).catch((e) => setErr(String(e)));
  }, []);

  // Charger les prix + auto-refresh toutes les 60s
  useEffect(() => {
    let timer: number | undefined;

    const load = () => {
      setLoading(true);
      setErr(null);
      fetchPrices(symbol, limit)
        .then(setData)
        .catch((e) => setErr(String(e)))
        .finally(() => setLoading(false));
    };

    load(); // 1er chargement immédiat
    timer = window.setInterval(load, 60000); // ✅ refresh 60s

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [symbol, limit]);

  // ✅ ordre chronologique croissant pour le graphe
  const chartData = useMemo(
    () =>
      [...data].sort((a, b) => new Date(a.t).getTime() - new Date(b.t).getTime()),
    [data]
  );

  const last = chartData.at(-1);
  const lastPrice = last?.priceUsd?.toLocaleString(undefined, { maximumFractionDigits: 6 });
  const lastTime = last ? new Date(last.t).toLocaleString() : "-";

  return (
    <div className="app">
      <div className="header">
        <h1>Crypto Dashboard</h1>
      </div>

      <div className="controls">
        <div className="control-item">
          <label>Crypto</label>
          <select value={symbol} onChange={(e) => setSymbol(e.target.value)} disabled={loading}>
            {assets.map((a) => (
              <option key={a.id} value={a.symbol}>
                {a.symbol.toUpperCase()}
              </option>
            ))}
          </select>
        </div>

        <div className="control-item">
          <label>Période</label>
          <select value={limit} onChange={(e) => setLimit(Number(e.target.value))} disabled={loading}>
            <option value={20}>20 points</option>
            <option value={50}>50 points</option>
            <option value={100}>100 points</option>
            <option value={200}>200 points</option>
          </select>
        </div>

        <div className="price-info">
          <span className="price-value">{lastPrice ?? "-"} USD</span>
          <span className="price-time">Mis à jour: {lastTime}</span>
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
              <YAxis 
                domain={["dataMin", "dataMax"]} 
                tickFormatter={(v) => v.toLocaleString()} 
                width={72}
                stroke="#a0aec0"
              />
              <Tooltip
                formatter={(v: number) => `${v.toLocaleString()} USD`}
                labelFormatter={(l) => new Date(l).toLocaleString()}
                contentStyle={{ 
                  background: '#1a1f2e',
                  border: '1px solid #2d3748',
                  color: '#ffffff'
                }}
              />
              <Line 
                type="monotone" 
                dataKey="priceUsd" 
                dot={false} 
                strokeWidth={2}
                stroke="#00ff87" 
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
