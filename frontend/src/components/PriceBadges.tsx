type Props = {
  lastPrice?: string;
  lastTime: string;
  symbol: string;
  compare?: string;
  pctPrimary: number | null;
  pctCompareVal: number | null;
};

export default function PriceBadges({
  lastPrice, lastTime, symbol, compare, pctPrimary, pctCompareVal
}: Props) {
  return (
    <div className="price-info">
      <span className="price-value">{lastPrice ?? "-"} USD</span>
      <span className="price-time">Mis à jour: {lastTime}</span>

      {pctPrimary != null && (
        <span
          style={{
            marginLeft: 8, padding: "2px 8px", borderRadius: 6, fontWeight: 600,
            background: pctPrimary >= 0 ? "rgba(0, 255, 135, 0.12)" : "rgba(220, 20, 60, 0.12)",
            color: pctPrimary >= 0 ? "#00ff87" : "crimson",
            border: `1px solid ${pctPrimary >= 0 ? "#00ff87" : "crimson"}`
          }}
          title={`Variation ${symbol.toUpperCase()} sur la période`}
        >
          {symbol.toUpperCase()} {pctPrimary >= 0 ? "+" : ""}{pctPrimary.toFixed(2)}%
        </span>
      )}

      {pctCompareVal != null && compare && (
        <span
          style={{
            marginLeft: 6, padding: "2px 8px", borderRadius: 6, fontWeight: 600,
            background: pctCompareVal >= 0 ? "rgba(79, 209, 197, 0.12)" : "rgba(220, 20, 60, 0.12)",
            color: pctCompareVal >= 0 ? "#4fd1c5" : "crimson",
            border: `1px solid ${pctCompareVal >= 0 ? "#4fd1c5" : "crimson"}`
          }}
          title={`Variation ${compare.toUpperCase()} sur la période`}
        >
          {compare.toUpperCase()} {pctCompareVal >= 0 ? "+" : ""}{pctCompareVal.toFixed(2)}%
        </span>
      )}
    </div>
  );
}
