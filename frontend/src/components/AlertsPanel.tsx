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
  { value: "price_above", label: "Price Above", icon: "📈" },
  { value: "price_below", label: "Price Below", icon: "📉" },
  { value: "change_above", label: "24h Change Above", icon: "🚀" },
  { value: "change_below", label: "24h Change Below", icon: "⚠️" },
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
    if (!confirm("Delete this alert?")) return;
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
        <div className="panel-loading">Loading alerts...</div>
      </div>
    );
  }

  return (
    <div className="panel alerts-panel">
      <div className="panel-header">
        <h2 className="panel-title">
          <span className="panel-icon">🔔</span>
          Price Alerts
        </h2>
        <span className="panel-badge">{alerts.length} alerts</span>
      </div>

      {error && <div className="panel-error">{error}</div>}

      {/* Create Alert Form */}
      <form className="alert-form" onSubmit={handleCreate}>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Asset</label>
            <select
              className="form-select"
              value={selectedAssetId}
              onChange={(e) => setSelectedAssetId(e.target.value ? Number(e.target.value) : "")}
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
              {alertType.includes("price") ? "Price (USD)" : "Percentage"}
            </label>
            <input
              type="number"
              className="form-input"
              placeholder={alertType.includes("price") ? "e.g. 50000" : "e.g. 5"}
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              step="any"
              required
            />
          </div>

          <div className="form-group form-group-btn">
            <button type="submit" className="btn btn-primary" disabled={creating}>
              {creating ? "Creating..." : "Create Alert"}
            </button>
          </div>
        </div>
      </form>

      {/* Alerts List */}
      <div className="alerts-list">
        {alerts.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">🔕</span>
            <p>No alerts yet. Create one above to get started!</p>
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
                        Last triggered: {new Date(alert.lastTriggered).toLocaleString()}
                      </div>
                    )}
                  </div>
                </div>

                <div className="alert-card-actions">
                  <button
                    className={`btn-toggle ${alert.isActive ? "on" : "off"}`}
                    onClick={() => handleToggle(alert)}
                    title={alert.isActive ? "Deactivate" : "Activate"}
                  >
                    {alert.isActive ? "ON" : "OFF"}
                  </button>
                  <button
                    className="btn-icon btn-danger"
                    onClick={() => handleDelete(alert.id)}
                    title="Delete alert"
                  >
                    🗑️
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
