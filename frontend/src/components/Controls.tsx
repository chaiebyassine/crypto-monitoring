import type { Asset } from "../lib/api";

type Props = {
  assets: Asset[];
  symbol: string;
  compare: string;
  limit: number;
  showSMA: boolean;
  smaWin: number;
  showEMA: boolean;
  emaWin: number;
  normalize: boolean;
  loading: boolean;
  onChange: (patch: Partial<Omit<Props, "assets" | "loading">>) => void;
};

export default function Controls({
  assets, symbol, compare, limit,
  showSMA, smaWin, showEMA, emaWin,
  normalize, loading, onChange
}: Props) {
  return (
    <div className="controls">
      <div className="control-item">
        <label>Crypto</label>
        <select
          value={symbol}
          onChange={(e) => onChange({ symbol: e.target.value, compare: compare === e.target.value ? "" : compare })}
          disabled={loading}
        >
          {assets.map((a) => (
            <option key={a.id} value={a.symbol}>{a.symbol.toUpperCase()}</option>
          ))}
        </select>
      </div>

      <div className="control-item">
        <label>Comparer avec</label>
        <select
          value={compare}
          onChange={(e) => onChange({ compare: e.target.value })}
          disabled={loading}
        >
          <option value="">(aucun)</option>
          {assets.filter((a) => a.symbol !== symbol).map((a) => (
            <option key={a.id} value={a.symbol}>{a.symbol.toUpperCase()}</option>
          ))}
        </select>
      </div>

      <div className="control-item">
        <label>Période</label>
        <select
          value={limit}
          onChange={(e) => onChange({ limit: Number(e.target.value) })}
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
          onChange={(e) => onChange({ normalize: e.target.checked })}
          title="Compare les tendances (index 100)"
        />
      </div>

      <div className="control-item" style={{ opacity: normalize ? 0.5 : 1 }}>
        <label>SMA</label>
        <input
          type="checkbox"
          checked={!normalize && showSMA}
          onChange={(e) => onChange({ showSMA: e.target.checked })}
          disabled={normalize}
          style={{ marginRight: 8 }}
        />
        <input
          type="number" min={2} max={60} value={smaWin}
          onChange={(e) => onChange({ smaWin: Math.max(2, Number(e.target.value)) })}
          disabled={normalize} style={{ width: 64 }}
        />
      </div>

      <div className="control-item" style={{ opacity: normalize ? 0.5 : 1 }}>
        <label>EMA</label>
        <input
          type="checkbox"
          checked={!normalize && showEMA}
          onChange={(e) => onChange({ showEMA: e.target.checked })}
          disabled={normalize}
          style={{ marginRight: 8 }}
        />
        <input
          type="number" min={2} max={60} value={emaWin}
          onChange={(e) => onChange({ emaWin: Math.max(2, Number(e.target.value)) })}
          disabled={normalize} style={{ width: 64 }}
        />
      </div>
    </div>
  );
}
