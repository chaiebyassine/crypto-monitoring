import type { Asset } from "../lib/api";

export type ChartMode = "line" | "ohlc";

export type ControlsChangePatch = {
  symbol?: string;
  compare?: string;
  limit?: number;
  showSMA?: boolean;
  smaWin?: number;
  showEMA?: boolean;
  emaWin?: number;
  normalize?: boolean;
  chartMode?: ChartMode;
};

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
  chartMode: ChartMode;
  onChange: (patch: ControlsChangePatch) => void;
};

export default function Controls({
  assets,
  symbol,
  compare,
  limit,
  showSMA,
  smaWin,
  showEMA,
  emaWin,
  normalize,
  loading,
  chartMode,
  onChange,
}: Props) {
  const handleSymbolChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange({ symbol: e.target.value, compare: "" });
  };

  const handleCompareChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange({ compare: e.target.value });
  };

  const handleLimitChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange({ limit: Number(e.target.value) });
  };

  return (
    <div className="controls">
      {/* Ligne 1 : choix des actifs et période */}
      <div className="controls-row">
        <div className="control-group">
          <label>Crypto</label>
          <select
            value={symbol}
            onChange={handleSymbolChange}
            disabled={loading}
          >
            {assets.map((a) => (
              <option key={a.id} value={a.symbol}>
                {a.name ?? a.symbol.toUpperCase()}
              </option>
            ))}
          </select>
        </div>

        <div className="control-group">
          <label>Comparer avec</label>
          <select
            value={compare}
            onChange={handleCompareChange}
            disabled={loading}
          >
            <option value="">(aucune)</option>
            {assets
              .filter((a) => a.symbol !== symbol)
              .map((a) => (
                <option key={a.id} value={a.symbol}>
                  {a.name ?? a.symbol.toUpperCase()}
                </option>
              ))}
          </select>
        </div>

        <div className="control-group">
          <label>Période</label>
          <select
            value={limit}
            onChange={handleLimitChange}
            disabled={loading}
          >
            <option value={20}>20 points</option>
            <option value={50}>50 points</option>
            <option value={100}>100 points</option>
            <option value={200}>200 points</option>
          </select>
        </div>
      </div>

      {/* Ligne 2 : type de graphique + options d’indicateurs */}
      <div className="controls-row">
        <div className="control-group">
          <label>Type de graphique</label>
          <div className="control-inline">
            <label>
              <input
                type="radio"
                name="chartMode"
                value="line"
                checked={chartMode === "line"}
                onChange={() => onChange({ chartMode: "line" })}
                disabled={loading}
              />
              Courbe
            </label>
            <label style={{ marginLeft: "0.75rem" }}>
              <input
                type="radio"
                name="chartMode"
                value="ohlc"
                checked={chartMode === "ohlc"}
                onChange={() => onChange({ chartMode: "ohlc" })}
                disabled={loading}
              />
              Chandeliers (OHLC)
            </label>
          </div>
        </div>

        <div className="control-group">
          <label>
            <input
              type="checkbox"
              checked={normalize}
              onChange={(e) => onChange({ normalize: e.target.checked })}
              disabled={loading}
            />{" "}
            Variation %
          </label>
        </div>

        <div className="control-group">
          <label>
            <input
              type="checkbox"
              checked={!normalize && showSMA}
              onChange={(e) => onChange({ showSMA: e.target.checked })}
              disabled={normalize || loading}
            />{" "}
            SMA
          </label>
          <input
            type="number"
            min={2}
            max={200}
            value={smaWin}
            onChange={(e) =>
              onChange({ smaWin: Math.max(2, Number(e.target.value)) })
            }
            disabled={normalize || !showSMA || loading}
            style={{ width: 64, marginLeft: 8 }}
          />
        </div>

        <div className="control-group">
          <label>
            <input
              type="checkbox"
              checked={!normalize && showEMA}
              onChange={(e) => onChange({ showEMA: e.target.checked })}
              disabled={normalize || loading}
            />{" "}
            EMA
          </label>
          <input
            type="number"
            min={2}
            max={200}
            value={emaWin}
            onChange={(e) =>
              onChange({ emaWin: Math.max(2, Number(e.target.value)) })
            }
            disabled={normalize || !showEMA || loading}
            style={{ width: 64, marginLeft: 8 }}
          />
        </div>
      </div>
    </div>
  );
}
