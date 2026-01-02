import client from "prom-client";

// Créer un registre pour les métriques
const register = new client.Registry();

// Ajouter les métriques par défaut (CPU, mémoire, etc.)
client.collectDefaultMetrics({ register });

// Compteur de requêtes HTTP
export const httpRequestsTotal = new client.Counter({
  name: "http_requests_total",
  help: "Nombre total de requêtes HTTP",
  labelNames: ["method", "route", "status"],
  registers: [register],
});

// Histogramme de durée des requêtes
export const httpRequestDuration = new client.Histogram({
  name: "http_request_duration_seconds",
  help: "Durée des requêtes HTTP en secondes",
  labelNames: ["method", "route", "status"],
  buckets: [0.001, 0.005, 0.015, 0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 1, 2, 5],
  registers: [register],
});

// Gauge pour les connexions actives
export const activeConnections = new client.Gauge({
  name: "http_active_connections",
  help: "Nombre de connexions HTTP actives",
  registers: [register],
});

// Compteur d'erreurs
export const errorsTotal = new client.Counter({
  name: "errors_total",
  help: "Nombre total d'erreurs",
  labelNames: ["type"],
  registers: [register],
});

// Métriques métier - Crypto
export const priceCollections = new client.Counter({
  name: "crypto_price_collections_total",
  help: "Nombre de collectes de prix effectuées",
  registers: [register],
});

export const alertsTriggered = new client.Counter({
  name: "crypto_alerts_triggered_total",
  help: "Nombre d'alertes déclenchées",
  labelNames: ["type", "asset"],
  registers: [register],
});

export const tradesExecuted = new client.Counter({
  name: "crypto_trades_executed_total",
  help: "Nombre de trades exécutés",
  labelNames: ["side", "asset"],
  registers: [register],
});

// Gauge pour le nombre d'utilisateurs actifs
export const activeUsers = new client.Gauge({
  name: "active_users",
  help: "Nombre d'utilisateurs avec sessions actives",
  registers: [register],
});

// Exporter le registre
export { register };
