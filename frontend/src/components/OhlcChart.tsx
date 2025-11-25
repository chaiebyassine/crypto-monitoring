import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import type { OhlcPoint } from "../lib/api";

type Props = {
  data: OhlcPoint[];
  symbol: string;
};

function formatDateLabel(value: string) {
  const d = new Date(value);
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload || payload.length === 0) return null;
  const p = payload[0].payload as OhlcPoint;

  return (
    <div className="chart-tooltip">
      <div>{new Date(label).toLocaleString()}</div>
      <div>Open : {p.open.toLocaleString()}</div>
      <div>High : {p.high.toLocaleString()}</div>
      <div>Low  : {p.low.toLocaleString()}</div>
      <div>Close: {p.close.toLocaleString()}</div>
    </div>
  );
}

export default function OhlcChart({ data, symbol }: Props) {
  if (!data.length) {
    return <div className="chart-empty">Pas encore de données OHLC.</div>;
  }

  const lows = data.map((d) => d.low);
  const highs = data.map((d) => d.high);
  const min = Math.min(...lows);
  const max = Math.max(...highs);
  const padding = (max - min) * 0.05 || 1;

  return (
    <div className="chart-container">
      <ResponsiveContainer width="100%" height={420}>
        <LineChart data={data} margin={{ top: 20, right: 40, left: 0, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
          <XAxis dataKey="t" tickFormatter={formatDateLabel} />
          <YAxis domain={[min - padding, max + padding]} />
          <Tooltip content={<CustomTooltip />} />
          {/* on trace la courbe des "close" pour la tendance */}
          <Line
            type="monotone"
            dataKey="close"
            name={symbol.toUpperCase() + " (Close)"}
            dot={false}
            strokeWidth={2}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
