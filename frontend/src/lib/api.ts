const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3001";
export type User = {
  id: number;
  email: string;
  name: string | null;
  role: "USER" | "ADMIN";
};

export type AuthResponse = {
  user: User;
  token: string;
};


let authToken: string | null = localStorage.getItem("token");

export function getToken(): string | null {
  return authToken;
}

export function setToken(token: string | null): void {
  authToken = token;
  if (token) {
    localStorage.setItem("token", token);
  } else {
    localStorage.removeItem("token");
  }
}

export function getStoredUser(): User | null {
  const stored = localStorage.getItem("user");
  return stored ? JSON.parse(stored) : null;
}

export function setStoredUser(user: User | null): void {
  if (user) {
    localStorage.setItem("user", JSON.stringify(user));
  } else {
    localStorage.removeItem("user");
  }
}

function authHeaders(): HeadersInit {
  const headers: HeadersInit = { "Content-Type": "application/json" };
  if (authToken) {
    headers["Authorization"] = `Bearer ${authToken}`;
  }
  return headers;
}

export async function register(email: string, password: string, name?: string): Promise<AuthResponse> {
  const r = await fetch(`${BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, name }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || "Erreur d'inscription");
  setToken(j.data.token);
  setStoredUser(j.data.user);
  return j.data;
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const r = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || "Email ou mot de passe incorrect");
  setToken(j.data.token);
  setStoredUser(j.data.user);
  return j.data;
}

export async function fetchMe(): Promise<User> {
  const r = await fetch(`${BASE}/auth/me`, { headers: authHeaders() });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || "Non authentifié");
  return j.data;
}

export function logout(): void {
  setToken(null);
  setStoredUser(null);
}


export type Asset = { id: number; symbol: string; name: string };
export type PricePoint = { t: string; priceUsd: number };

export type AlertType = "price_above" | "price_below" | "change_above" | "change_below";

export type Alert = {
  id: number;
  assetId: number;
  type: AlertType;
  threshold: number;
  isActive: boolean;
  lastTriggered: string | null;
  createdAt: string;
  asset?: Asset;
};

export type ForecastMethod = "sma" | "ema" | "linear";

export type ForecastPoint = { t: string; price: number };

export type Forecast = {
  symbol: string;
  method: ForecastMethod;
  historical: ForecastPoint[];
  predicted: ForecastPoint[];
  metrics: {
    lastPrice: number;
    predictedPrice: number;
    predictedChange: number;
    predictedChangePct: number;
  };
};

export type Portfolio = {
  id: number;
  name: string;
  createdAt: string;
};

export type Position = {
  id: number;
  portfolioId: number;
  assetId: number;
  quantity: number;
  avgCost: number;
  asset?: Asset;
};

export type Trade = {
  id: number;
  portfolioId: number;
  assetId: number;
  side: "buy" | "sell";
  quantity: number;
  priceUsd: number;
  totalUsd: number;
  notes?: string;
  executedAt: string;
  asset?: Asset;
};

export type PositionPnL = {
  id: number;
  assetId: number;
  name: string;
  symbol: string;
  quantity: number;
  avgCost: number;
  currentPrice: number;
  currentValue: number;
  unrealizedPnl: number;
  unrealizedPnlPct: number;
};

export type PortfolioPnL = {
  portfolioId: number;
  positions: PositionPnL[];
  totals: {
    totalCost: number;
    totalValue: number;
    unrealizedPnl: number;
    unrealizedPnlPct: number;
    realizedPnl: number;
  };
};

export async function fetchAssets(): Promise<Asset[]> {
  const r = await fetch(`${BASE}/assets`);
  if (!r.ok) throw new Error("Failed /assets");
  const j = await r.json();
  return j.data ?? [];
}

export async function fetchPrices(symbol: string, limit = 50): Promise<PricePoint[]> {
  const r = await fetch(`${BASE}/prices?symbol=${encodeURIComponent(symbol)}&limit=${limit}`);
  if (!r.ok) throw new Error("Failed /prices");
  const j = await r.json();
  return (j.data ?? []).map((d: any) => ({ t: d.t, priceUsd: d.priceUsd }));
}

export async function fetchChanges(): Promise<{symbol: string; name: string; last: number | null; change24hPct: number | null}[]> {
  const r = await fetch(`${BASE}/changes`);
  const j = await r.json();
  return j.data ?? [];
}

export async function fetchAlerts(): Promise<Alert[]> {
  const r = await fetch(`${BASE}/alerts`);
  if (!r.ok) throw new Error("Failed /alerts");
  const j = await r.json();
  return j.data ?? [];
}

export async function createAlert(assetId: number, type: AlertType, threshold: number): Promise<Alert> {
  const r = await fetch(`${BASE}/alerts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ assetId, type, threshold }),
  });
  if (!r.ok) throw new Error("Failed to create alert");
  const j = await r.json();
  return j.data;
}

export async function activateAlert(id: number): Promise<Alert> {
  const r = await fetch(`${BASE}/alerts/${id}/activate`, { method: "PUT" });
  if (!r.ok) throw new Error("Failed to activate alert");
  const j = await r.json();
  return j.data;
}

export async function deactivateAlert(id: number): Promise<Alert> {
  const r = await fetch(`${BASE}/alerts/${id}/deactivate`, { method: "PUT" });
  if (!r.ok) throw new Error("Failed to deactivate alert");
  const j = await r.json();
  return j.data;
}

export async function deleteAlert(id: number): Promise<void> {
  const r = await fetch(`${BASE}/alerts/${id}`, { method: "DELETE" });
  if (!r.ok) throw new Error("Failed to delete alert");
}

export async function fetchForecast(
  symbol: string,
  method: ForecastMethod = "ema",
  history: number = 50,
  steps: number = 10
): Promise<Forecast> {
  const params = new URLSearchParams({
    symbol,
    method,
    history: String(history),
    steps: String(steps),
  });
  const r = await fetch(`${BASE}/forecast?${params}`);
  if (!r.ok) throw new Error("Failed /forecast");
  const j = await r.json();
  return j.data;
}

export async function fetchPortfolios(): Promise<Portfolio[]> {
  const r = await fetch(`${BASE}/portfolios`);
  if (!r.ok) throw new Error("Failed /portfolios");
  const j = await r.json();
  return j.data ?? [];
}

export async function createPortfolio(name: string): Promise<Portfolio> {
  const r = await fetch(`${BASE}/portfolios`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!r.ok) throw new Error("Failed to create portfolio");
  const j = await r.json();
  return j.data;
}

export async function deletePortfolio(id: number): Promise<void> {
  const r = await fetch(`${BASE}/portfolios/${id}`, { method: "DELETE" });
  if (!r.ok) throw new Error("Failed to delete portfolio");
}

export async function fetchPortfolioPnL(portfolioId: number): Promise<PortfolioPnL> {
  const r = await fetch(`${BASE}/portfolios/${portfolioId}/pnl`);
  if (!r.ok) throw new Error("Failed to fetch portfolio PnL");
  const j = await r.json();
  return j.data;
}

export async function fetchPositions(portfolioId: number): Promise<Position[]> {
  const r = await fetch(`${BASE}/portfolios/${portfolioId}/positions`);
  if (!r.ok) throw new Error("Failed /positions");
  const j = await r.json();
  return j.data ?? [];
}

export type OhlcPoint = {
  t: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number | null;
};

export async function fetchOhlc(
  symbol: string,
  granularity: string = "1h"
): Promise<OhlcPoint[]> {
  const r = await fetch(
    `${BASE}/prices/ohlc?symbol=${encodeURIComponent(
      symbol
    )}&granularity=${encodeURIComponent(granularity)}`
  );
  if (!r.ok) {
    throw new Error("Failed /prices/ohlc");
  }
  const j = await r.json();
  return (j.data ?? []).map((d: any) => ({
    t: d.t,
    open: d.open,
    high: d.high,
    low: d.low,
    close: d.close,
    volume: d.volume ?? d.volumeUsd ?? null,
  }));
}


export async function fetchTrades(portfolioId: number, limit = 20): Promise<Trade[]> {
  const r = await fetch(`${BASE}/portfolios/${portfolioId}/trades?limit=${limit}`);
  if (!r.ok) throw new Error("Failed /trades");
  const j = await r.json();
  return j.data ?? [];
}

export async function executeTrade(
  portfolioId: number,
  assetId: number,
  side: "buy" | "sell",
  quantity: number,
  priceUsd: number,
  notes?: string
): Promise<Trade> {
  const r = await fetch(`${BASE}/portfolios/${portfolioId}/trades`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ assetId, side, quantity, priceUsd, notes }),
  });
  if (!r.ok) throw new Error("Failed to execute trade");
  const j = await r.json();
  return j.data;
}

