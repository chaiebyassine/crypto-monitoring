import { useState, useEffect } from "react";
import {
  fetchPortfolios,
  createPortfolio,
  deletePortfolio,
  fetchPortfolioPnL,
  fetchTrades,
  fetchAssets,
  fetchChanges,
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
  const [assetPrices, setAssetPrices] = useState<Record<string, number>>({});
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

  // Solde initial pour chaque utilisateur
  const SOLDE_INITIAL = 100000;

  // Calcul du total
  const tradeTotal = (Number(tradeQuantity) || 0) * (Number(tradePrice) || 0);

  // Calcul du solde disponible = Solde initial - Total investi + Gains réalisés
  const soldeDisponible = SOLDE_INITIAL - (pnlData?.totals.totalCost || 0) + (pnlData?.totals.realizedPnl || 0);

  // Trouver la position actuelle pour l'asset sélectionné (pour SELL)
  const currentPosition = pnlData?.positions.find((p) => p.assetId === tradeAssetId);
  const availableQuantity = currentPosition?.quantity || 0;

  // Handler pour changement d'asset - auto-remplir le prix
  function handleAssetChange(assetId: number | "") {
    setTradeAssetId(assetId);
    if (assetId !== "") {
      const asset = assets.find((a) => a.id === assetId);
      if (asset) {
        const currentPrice = assetPrices[asset.symbol.toLowerCase()];
        if (currentPrice !== undefined) {
          setTradePrice(currentPrice.toString());
        }
      }
    }
  }

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
      const [portfoliosData, assetsData, changesData] = await Promise.all([
        fetchPortfolios(),
        fetchAssets(),
        fetchChanges(),
      ]);
      setPortfolios(portfoliosData);
      setAssets(assetsData);
      
      // Créer un map symbol -> prix actuel
      const priceMap: Record<string, number> = {};
      changesData.forEach((c) => {
        if (c.last !== null) {
          priceMap[c.symbol.toLowerCase()] = c.last;
        }
      });
      setAssetPrices(priceMap);
      
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
    if (!confirm("Supprimer ce portfolio et toutes ses données ?")) return;

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
        <div className="panel-loading">Chargement du portfolio...</div>
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

      {/* Sélection & Création de Portfolio */}
      <div className="portfolio-header">
        <div className="portfolio-selector">
          <div className="form-group">
            <label className="form-label">Sélectionner Portfolio</label>
            <div className="selector-row">
              <select
                className="form-select"
                value={selectedPortfolioId ?? ""}
                onChange={(e) => setSelectedPortfolioId(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">Choisir un portfolio...</option>
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
                  title="Supprimer le portfolio"
                >
                  🗑️
                </button>
              )}
            </div>
          </div>
        </div>

        <form className="portfolio-create" onSubmit={handleCreatePortfolio}>
          <div className="form-group">
            <label className="form-label">Nouveau Portfolio</label>
            <div className="create-row">
              <input
                type="text"
                className="form-input"
                placeholder="Nom du portfolio..."
                value={newPortfolioName}
                onChange={(e) => setNewPortfolioName(e.target.value)}
              />
              <button type="submit" className="btn btn-success" disabled={creatingPortfolio}>
                {creatingPortfolio ? "..." : "Créer"}
              </button>
            </div>
          </div>
        </form>
      </div>

      {selectedPortfolioId && pnlData && (
        <>
          {/* Résumé du Portfolio */}
          <div className="portfolio-summary">
            <div className="summary-card highlight">
              <span className="summary-label">🏦 Solde Disponible</span>
              <span className="summary-value">{formatCurrency(soldeDisponible)}</span>
            </div>
            <div className="summary-card">
              <span className="summary-label">💰 Total Investi</span>
              <span className="summary-value">{formatCurrency(pnlData.totals.totalCost)}</span>
            </div>
            <div className="summary-card">
              <span className="summary-label">📈 Valeur Actuelle</span>
              <span className="summary-value">{formatCurrency(pnlData.totals.totalValue)}</span>
            </div>
            <div className="summary-card">
              <span className="summary-label">
                {pnlData.totals.unrealizedPnl >= 0 ? "✅ Gain Potentiel" : "❌ Perte Potentielle"}
              </span>
              <span className={`summary-value ${pnlData.totals.unrealizedPnl >= 0 ? "positive" : "negative"}`}>
                {formatPnL(pnlData.totals.unrealizedPnl)}
                <small className="summary-pct">{formatPct(pnlData.totals.unrealizedPnlPct)}</small>
              </span>
            </div>
            <div className="summary-card">
              <span className="summary-label">
                {pnlData.totals.realizedPnl >= 0 ? "💵 Gain Réalisé" : "💸 Perte Réalisée"}
              </span>
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
            {showTradeForm ? "Annuler" : "📊 Nouveau Trade"}
          </button>

          {/* Formulaire Trade */}
          {showTradeForm && (
            <form className="trade-form" onSubmit={handleExecuteTrade}>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Crypto</label>
                  <select
                    className="form-select"
                    value={tradeAssetId}
                    onChange={(e) => handleAssetChange(e.target.value ? Number(e.target.value) : "")}
                    required
                  >
                    <option value="">Choisir une crypto...</option>
                    {assets.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.symbol.toUpperCase()})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Type</label>
                  <div className="toggle-buttons">
                    <button
                      type="button"
                      className={`toggle-btn ${tradeSide === "buy" ? "active buy" : ""}`}
                      onClick={() => setTradeSide("buy")}
                    >
                      ACHETER
                    </button>
                    <button
                      type="button"
                      className={`toggle-btn ${tradeSide === "sell" ? "active sell" : ""}`}
                      onClick={() => setTradeSide("sell")}
                    >
                      VENDRE
                    </button>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Quantité
                    {tradeSide === "sell" && tradeAssetId !== "" && (
                      <span className="available-qty">
                        (Disponible: {availableQuantity.toLocaleString(undefined, { maximumFractionDigits: 8 })})
                      </span>
                    )}
                  </label>
                  <div className="quantity-input-wrapper">
                    <input
                      type="number"
                      className="form-input"
                      placeholder="0.00"
                      value={tradeQuantity}
                      onChange={(e) => setTradeQuantity(e.target.value)}
                      step="any"
                      min="0"
                      max={tradeSide === "sell" ? availableQuantity : undefined}
                      required
                    />
                    {tradeSide === "sell" && availableQuantity > 0 && (
                      <button
                        type="button"
                        className="btn-max"
                        onClick={() => setTradeQuantity(availableQuantity.toString())}
                      >
                        MAX
                      </button>
                    )}
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Prix (USD)</label>
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

              {/* Total Display */}
              {tradeTotal > 0 && (
                <div className="trade-total">
                  <span className="trade-total-label">Total:</span>
                  <span className={`trade-total-value ${tradeSide === "buy" ? "buy" : "sell"}`}>
                    {formatCurrency(tradeTotal)}
                  </span>
                </div>
              )}

              <div className="form-row">
                <div className="form-group flex-grow">
                  <label className="form-label">Notes (optionnel)</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Ajouter des notes..."
                    value={tradeNotes}
                    onChange={(e) => setTradeNotes(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">&nbsp;</label>
                  <button
                    type="submit"
                    className={`btn ${tradeSide === "buy" ? "btn-success" : "btn-danger"}`}
                    disabled={executingTrade || (tradeSide === "buy" && tradeTotal > soldeDisponible)}
                  >
                    {executingTrade ? "En cours..." : tradeSide === "buy" ? "ACHETER" : "VENDRE"}
                  </button>
                </div>
              </div>
              {tradeSide === "buy" && tradeTotal > soldeDisponible && (
                <div className="trade-warning">⚠️ Solde insuffisant !</div>
              )}
            </form>
          )}

          {/* Positions */}
          <div className="section">
            <h3 className="section-title">📊 Mes Positions</h3>
            {pnlData.positions.length === 0 ? (
              <div className="empty-state">
                <span className="empty-icon">📭</span>
                <p>Aucune position. Effectuez un trade pour commencer !</p>
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
                        <span className="position-label">Quantité</span>
                        <span className="position-value">{pos.quantity.toFixed(6)}</span>
                      </div>
                      <div className="position-row">
                        <span className="position-label">Prix moyen</span>
                        <span className="position-value">{formatCurrency(pos.avgCost)}</span>
                      </div>
                      <div className="position-row">
                        <span className="position-label">Prix actuel</span>
                        <span className="position-value">{formatCurrency(pos.currentPrice)}</span>
                      </div>
                      <div className="position-row">
                        <span className="position-label">Valeur</span>
                        <span className="position-value">{formatCurrency(pos.currentValue)}</span>
                      </div>
                    </div>
                    <div className="position-footer">
                      <span className="position-label">Gain/Perte</span>
                      <span className={`position-pnl ${pos.unrealizedPnl >= 0 ? "positive" : "negative"}`}>
                        {formatPnL(pos.unrealizedPnl)} ({formatPct(pos.unrealizedPnlPct)})
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Historique des Trades */}
          <div className="section">
            <h3 className="section-title">📜 Historique des Trades</h3>
            {trades.length === 0 ? (
              <div className="empty-state">
                <span className="empty-icon">📋</span>
                <p>Aucun trade pour le moment.</p>
              </div>
            ) : (
              <div className="trades-table">
                <div className="trades-header">
                  <span>Type</span>
                  <span>Crypto</span>
                  <span>Quantité</span>
                  <span>Prix</span>
                  <span>Total</span>
                  <span>Date</span>
                </div>
                {trades.map((trade) => (
                  <div key={trade.id} className={`trades-row ${trade.side}`}>
                    <span className={`trade-side ${trade.side}`}>
                      {trade.side === "buy" ? "ACHAT" : "VENTE"}
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
          <p>Aucun portfolio. Créez-en un pour suivre vos investissements !</p>
        </div>
      )}
    </div>
  );
}
