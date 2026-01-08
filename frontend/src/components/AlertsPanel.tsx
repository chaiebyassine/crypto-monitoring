import { useState, useEffect } from "react";
import {
  fetchAlerts,
  fetchAssets,
  createAlert,
  activateAlert,
  deactivateAlert,
  deleteAlert,
  type Alert,
  type AlertType,
  type Asset,
} from "../lib/api";

const ALERT_TYPES: { value: AlertType; label: string; icon: string }[] = [
  { value: "price_above", label: "Prix supérieur à", icon: "" },
  { value: "price_below", label: "Prix inférieur à", icon: "" },
  { value: "change_above", label: "Variation 24h supérieure à", icon: "" },
  { value: "change_below", label: "Variation 24h inférieure à", icon: "" },
];

export default function AlertsPanel() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [selectedAssetId, setSelectedAssetId] = useState<number | "">("");
  const [alertType, setAlertType] = useState<AlertType>("price_above");
  const [threshold, setThreshold] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const [alertsData, assetsData] = await Promise.all([
        fetchAlerts(),
        fetchAssets(),
      ]);
      setAlerts(alertsData);
      setAssets(assetsData);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (selectedAssetId === "" || !threshold) return;

    try {
      setCreating(true);
      const newAlert = await createAlert(
        Number(selectedAssetId),
        alertType,
        Number(threshold)
      );
      const asset = assets.find((a) => a.id === Number(selectedAssetId));
      setAlerts([{ ...newAlert, asset }, ...alerts]);
      setThreshold("");
      setSelectedAssetId("");
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setCreating(false);
    }
  }

  async function handleToggle(alert: Alert) {
    try {
      const updated = alert.isActive
        ? await deactivateAlert(alert.id)
        : await activateAlert(alert.id);
      setAlerts(alerts.map((a) => (a.id === alert.id ? { ...a, ...updated } : a)));
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Supprimer cette alerte ?")) return;
    try {
      await deleteAlert(id);
      setAlerts(alerts.filter((a) => a.id !== id));
    } catch (e: any) {
      setError(e.message);
    }
  }

  const formatThreshold = (alert: Alert) => {
    if (alert.type.includes("price")) {
      return `$${alert.threshold.toLocaleString()}`;
    }
    return `${alert.threshold}%`;
  };

  const getAlertTypeInfo = (type: AlertType) => {
    return ALERT_TYPES.find((t) => t.value === type) || ALERT_TYPES[0];
  };

  if (loading) {
    return (
      <div className="panel">
        <div className="panel-loading">Chargement des alertes...</div>
      </div>
    );
  }

  return (
    <div className="panel alerts-panel">
      <div className="panel-header">
        <h2 className="panel-title">
          Alertes de Prix
        </h2>
        <span className="panel-badge">{alerts.length} alertes</span>
      </div>

      {error && <div className="panel-error">{error}</div>}

      {/* Formulaire Nouvelle Alerte */}
      <form className="alert-form" onSubmit={handleCreate}>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Crypto</label>
            <select
              className="form-select"
              value={selectedAssetId}
              onChange={(e) => setSelectedAssetId(e.target.value ? Number(e.target.value) : "")}
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
            <label className="form-label">Condition</label>
            <select
              className="form-select"
              value={alertType}
              onChange={(e) => setAlertType(e.target.value as AlertType)}
            >
              {ALERT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.icon} {t.label}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">
              {alertType.includes("price") ? "Prix (USD)" : "Pourcentage"}
            </label>
            <input
              type="number"
              className="form-input"
              placeholder={alertType.includes("price") ? "ex: 50000" : "ex: 5"}
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              step="any"
              required
            />
          </div>

          <div className="form-group form-group-btn">
            <button type="submit" className="btn btn-primary" disabled={creating}>
              {creating ? "Création..." : "Créer Alerte"}
            </button>
          </div>
        </div>
      </form>

      {/* Liste des Alertes */}
      <div className="alerts-list">
        {alerts.length === 0 ? (
          <div className="empty-state">
            
            <p>Aucune alerte. Créez-en une pour commencer !</p>
          </div>
        ) : (
          alerts.map((alert) => {
            const typeInfo = getAlertTypeInfo(alert.type);
            return (
              <div
                key={alert.id}
                className={`alert-card ${alert.isActive ? "active" : "inactive"}`}
              >
                <div className="alert-card-main">
                  <div className="alert-card-icon">{typeInfo.icon}</div>
                  <div className="alert-card-content">
                    <div className="alert-card-title">
                      {alert.asset?.name ?? `Asset #${alert.assetId}`}
                    </div>
                    <div className="alert-card-condition">
                      {typeInfo.label}: <strong>{formatThreshold(alert)}</strong>
                    </div>
                    {alert.lastTriggered && (
                      <div className="alert-card-meta">
                        Dernière alerte : {new Date(alert.lastTriggered).toLocaleString()}
                      </div>
                    )}
                  </div>
                </div>

                <div className="alert-card-actions">
                  <button
                    className={`btn-toggle ${alert.isActive ? "on" : "off"}`}
                    onClick={() => handleToggle(alert)}
                    title={alert.isActive ? "Désactiver" : "Activer"}
                  >
                    {alert.isActive ? "ON" : "OFF"}
                  </button>
                  <button
                    className="btn-icon btn-danger"
                    onClick={() => handleDelete(alert.id)}
                    title="Supprimer l'alerte"
                  >
                    Supprimer
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
