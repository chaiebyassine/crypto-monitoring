// src/components/CryptoChart.tsx
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { paddedDomain } from "../utils/domains";

type Props = {
  data: Array<Record<string, any>>;
  symbol: string;
  compare?: string;
  normalize: boolean;
  leftDomain: readonly [number, number];
  rightDomain: readonly [number, number];
  showSMA: boolean;
  showEMA: boolean;
};

export default function CryptoChart({
  data, symbol, compare, normalize, leftDomain, rightDomain, showSMA, showEMA,
}: Props) {
  // Don't render chart if no data
  if (!data || data.length === 0) {
    return (
      <div className="chart-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: '#64748b' }}>No chart data available</span>
      </div>
    );
  }

  return (
    <div className="chart-container">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
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
              background: "#1a1f2e", border: "1px solid #2d3748", color: "#ffffff",
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
                <Line yAxisId="left" type="monotone" dataKey="SMA" dot={false} strokeWidth={2} stroke="#9f7aea" />
              )}
              {showEMA && (
                <Line yAxisId="left" type="monotone" dataKey="EMA" dot={false} strokeWidth={2} stroke="#f6ad55" />
              )}
            </>
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
