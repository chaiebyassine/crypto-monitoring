import { useState, useEffect } from "react";
import {
  fetchPortfolios,
  createPortfolio,
  deletePortfolio,
  fetchPortfolioPnL,
  fetchTrades,
  fetchAssets,
  executeTrade,
  type Portfolio,
  type PortfolioPnL,
  type Trade,
  type Asset,
} from "../lib/api";

export default function PortfolioPanel() {
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<number | null>(null);
  const [pnlData, setPnlData] = useState<PortfolioPnL | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create portfolio form
  const [newPortfolioName, setNewPortfolioName] = useState("");
  const [creatingPortfolio, setCreatingPortfolio] = useState(false);

  // Trade form
  const [showTradeForm, setShowTradeForm] = useState(false);
  const [tradeAssetId, setTradeAssetId] = useState<number | "">("");
  const [tradeSide, setTradeSide] = useState<"buy" | "sell">("buy");
  const [tradeQuantity, setTradeQuantity] = useState("");
  const [tradePrice, setTradePrice] = useState("");
  const [tradeNotes, setTradeNotes] = useState("");
  const [executingTrade, setExecutingTrade] = useState(false);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (selectedPortfolioId) {
      loadPortfolioData(selectedPortfolioId);
    }
  }, [selectedPortfolioId]);

  async function loadInitialData() {
    try {
      setLoading(true);
      const [portfoliosData, assetsData] = await Promise.all([
        fetchPortfolios(),
        fetchAssets(),
      ]);
      setPortfolios(portfoliosData);
      setAssets(assetsData);
      if (portfoliosData.length > 0) {
        setSelectedPortfolioId(portfoliosData[0].id);
      }
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadPortfolioData(portfolioId: number) {
    try {
      const [pnl, tradesData] = await Promise.all([
        fetchPortfolioPnL(portfolioId),
        fetchTrades(portfolioId, 20),
      ]);
      setPnlData(pnl);
      setTrades(tradesData);
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function handleCreatePortfolio(e: React.FormEvent) {
    e.preventDefault();
    if (!newPortfolioName.trim()) return;

    try {
      setCreatingPortfolio(true);
      const portfolio = await createPortfolio(newPortfolioName.trim());
      setPortfolios([portfolio, ...portfolios]);
      setSelectedPortfolioId(portfolio.id);
      setNewPortfolioName("");
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setCreatingPortfolio(false);
    }
  }

  async function handleDeletePortfolio(id: number) {
    if (!confirm("Delete this portfolio and all its data?")) return;

    try {
      await deletePortfolio(id);
      const remaining = portfolios.filter((p) => p.id !== id);
      setPortfolios(remaining);
      if (selectedPortfolioId === id) {
        setSelectedPortfolioId(remaining[0]?.id ?? null);
        setPnlData(null);
        setTrades([]);
      }
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function handleExecuteTrade(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPortfolioId || tradeAssetId === "" || !tradeQuantity || !tradePrice) return;

    try {
      setExecutingTrade(true);
      await executeTrade(
        selectedPortfolioId,
        Number(tradeAssetId),
        tradeSide,
        Number(tradeQuantity),
        Number(tradePrice),
        tradeNotes || undefined
      );
      await loadPortfolioData(selectedPortfolioId);
      setTradeQuantity("");
      setTradePrice("");
      setTradeNotes("");
      setShowTradeForm(false);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setExecutingTrade(false);
    }
  }

  const formatCurrency = (value: number) =>
    `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const formatPnL = (value: number, showSign = true) => {
    const sign = showSign && value >= 0 ? "+" : "";
    return `${sign}${formatCurrency(value)}`;
  };

  const formatPct = (value: number) => {
    const sign = value >= 0 ? "+" : "";
    return `${sign}${value.toFixed(2)}%`;
  };

  if (loading) {
    return (
      <div className="panel">
        <div className="panel-loading">Loading portfolio...</div>
      </div>
    );
  }

  return (
    <div className="panel portfolio-panel">
      <div className="panel-header">
        <h2 className="panel-title">
          <span className="panel-icon">💼</span>
          Portfolio
        </h2>
      </div>

      {error && <div className="panel-error">{error}</div>}

      {/* Portfolio Selection & Creation */}
      <div className="portfolio-header">
        <div className="portfolio-selector">
          <div className="form-group">
            <label className="form-label">Select Portfolio</label>
            <div className="selector-row">
              <select
                className="form-select"
                value={selectedPortfolioId ?? ""}
                onChange={(e) => setSelectedPortfolioId(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">Select portfolio...</option>
                {portfolios.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              {selectedPortfolioId && (
                <button
                  className="btn-icon btn-danger"
                  onClick={() => handleDeletePortfolio(selectedPortfolioId)}
                  title="Delete portfolio"
                >
                  🗑️
                </button>
              )}
            </div>
          </div>
        </div>

        <form className="portfolio-create" onSubmit={handleCreatePortfolio}>
          <div className="form-group">
            <label className="form-label">New Portfolio</label>
            <div className="create-row">
              <input
                type="text"
                className="form-input"
                placeholder="Portfolio name..."
                value={newPortfolioName}
                onChange={(e) => setNewPortfolioName(e.target.value)}
              />
              <button type="submit" className="btn btn-success" disabled={creatingPortfolio}>
                {creatingPortfolio ? "..." : "Create"}
              </button>
            </div>
          </div>
        </form>
      </div>

      {selectedPortfolioId && pnlData && (
        <>
          {/* Portfolio Summary */}
          <div className="portfolio-summary">
            <div className="summary-card">
              <span className="summary-label">Total Value</span>
              <span className="summary-value">{formatCurrency(pnlData.totals.totalValue)}</span>
            </div>
            <div className="summary-card">
              <span className="summary-label">Total Cost</span>
              <span className="summary-value muted">{formatCurrency(pnlData.totals.totalCost)}</span>
            </div>
            <div className="summary-card">
              <span className="summary-label">Unrealized P&L</span>
              <span className={`summary-value ${pnlData.totals.unrealizedPnl >= 0 ? "positive" : "negative"}`}>
                {formatPnL(pnlData.totals.unrealizedPnl)}
                <small className="summary-pct">{formatPct(pnlData.totals.unrealizedPnlPct)}</small>
              </span>
            </div>
            <div className="summary-card">
              <span className="summary-label">Realized P&L</span>
              <span className={`summary-value ${pnlData.totals.realizedPnl >= 0 ? "positive" : "negative"}`}>
                {formatPnL(pnlData.totals.realizedPnl)}
              </span>
            </div>
          </div>

          {/* Trade Button */}
          <button
            className={`btn btn-trade ${showTradeForm ? "btn-secondary" : "btn-primary"}`}
            onClick={() => setShowTradeForm(!showTradeForm)}
          >
            {showTradeForm ? "Cancel" : "📊 New Trade"}
          </button>

          {/* Trade Form */}
          {showTradeForm && (
            <form className="trade-form" onSubmit={handleExecuteTrade}>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Asset</label>
                  <select
                    className="form-select"
                    value={tradeAssetId}
                    onChange={(e) => setTradeAssetId(e.target.value ? Number(e.target.value) : "")}
                    required
                  >
                    <option value="">Select asset...</option>
                    {assets.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.symbol.toUpperCase()})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Side</label>
                  <div className="toggle-buttons">
                    <button
                      type="button"
                      className={`toggle-btn ${tradeSide === "buy" ? "active buy" : ""}`}
                      onClick={() => setTradeSide("buy")}
                    >
                      BUY
                    </button>
                    <button
                      type="button"
                      className={`toggle-btn ${tradeSide === "sell" ? "active sell" : ""}`}
                      onClick={() => setTradeSide("sell")}
                    >
                      SELL
                    </button>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Quantity</label>
                  <input
                    type="number"
                    className="form-input"
                    placeholder="0.00"
                    value={tradeQuantity}
                    onChange={(e) => setTradeQuantity(e.target.value)}
                    step="any"
                    min="0"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Price (USD)</label>
                  <input
                    type="number"
                    className="form-input"
                    placeholder="0.00"
                    value={tradePrice}
                    onChange={(e) => setTradePrice(e.target.value)}
                    step="any"
                    min="0"
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group flex-grow">
                  <label className="form-label">Notes (optional)</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Add notes..."
                    value={tradeNotes}
                    onChange={(e) => setTradeNotes(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">&nbsp;</label>
                  <button
                    type="submit"
                    className={`btn ${tradeSide === "buy" ? "btn-success" : "btn-danger"}`}
                    disabled={executingTrade}
                  >
                    {executingTrade ? "Executing..." : `Execute ${tradeSide.toUpperCase()}`}
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* Positions */}
          <div className="section">
            <h3 className="section-title">Positions</h3>
            {pnlData.positions.length === 0 ? (
              <div className="empty-state">
                <span className="empty-icon">📭</span>
                <p>No positions yet. Execute a trade to get started!</p>
              </div>
            ) : (
              <div className="positions-grid">
                {pnlData.positions.map((pos) => (
                  <div key={pos.id} className="position-card">
                    <div className="position-header">
                      <span className="position-name">{pos.name}</span>
                      <span className="position-symbol">{pos.symbol.toUpperCase()}</span>
                    </div>
                    <div className="position-body">
                      <div className="position-row">
                        <span className="position-label">Quantity</span>
                        <span className="position-value">{pos.quantity.toFixed(6)}</span>
                      </div>
                      <div className="position-row">
                        <span className="position-label">Avg Cost</span>
                        <span className="position-value">{formatCurrency(pos.avgCost)}</span>
                      </div>
                      <div className="position-row">
                        <span className="position-label">Current</span>
                        <span className="position-value">{formatCurrency(pos.currentPrice)}</span>
                      </div>
                      <div className="position-row">
                        <span className="position-label">Value</span>
                        <span className="position-value">{formatCurrency(pos.currentValue)}</span>
                      </div>
                    </div>
                    <div className="position-footer">
                      <span className="position-label">P&L</span>
                      <span className={`position-pnl ${pos.unrealizedPnl >= 0 ? "positive" : "negative"}`}>
                        {formatPnL(pos.unrealizedPnl)} ({formatPct(pos.unrealizedPnlPct)})
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Trades */}
          <div className="section">
            <h3 className="section-title">Recent Trades</h3>
            {trades.length === 0 ? (
              <div className="empty-state">
                <span className="empty-icon">📋</span>
                <p>No trades yet.</p>
              </div>
            ) : (
              <div className="trades-table">
                <div className="trades-header">
                  <span>Side</span>
                  <span>Asset</span>
                  <span>Quantity</span>
                  <span>Price</span>
                  <span>Total</span>
                  <span>Date</span>
                </div>
                {trades.map((trade) => (
                  <div key={trade.id} className={`trades-row ${trade.side}`}>
                    <span className={`trade-side ${trade.side}`}>
                      {trade.side.toUpperCase()}
                    </span>
                    <span className="trade-asset">
                      {trade.asset?.symbol?.toUpperCase() ?? `#${trade.assetId}`}
                    </span>
                    <span>{trade.quantity.toFixed(6)}</span>
                    <span>{formatCurrency(trade.priceUsd)}</span>
                    <span>{formatCurrency(trade.totalUsd)}</span>
                    <span className="trade-date">
                      {new Date(trade.executedAt).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {!selectedPortfolioId && portfolios.length === 0 && (
        <div className="empty-state large">
          <span className="empty-icon">💼</span>
          <p>No portfolios yet. Create one to start tracking your investments!</p>
        </div>
      )}
    </div>
  );
}
