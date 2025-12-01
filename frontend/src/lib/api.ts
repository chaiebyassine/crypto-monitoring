const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

const USE_MOCK_AUTH = false;
const USE_MOCK_DATA = false; 
const FALLBACK_TO_MOCK = true; 


const MOCK_ASSETS: Asset[] = [
  { id: 1, symbol: "bitcoin", name: "Bitcoin" },
  { id: 2, symbol: "ethereum", name: "Ethereum" },
  { id: 3, symbol: "cardano", name: "Cardano" },
  { id: 4, symbol: "solana", name: "Solana" },
  { id: 5, symbol: "polkadot", name: "Polkadot" },
];

function generateMockPrices(symbol: string, count: number): PricePoint[] {
  const basePrices: Record<string, number> = {
    bitcoin: 95000,
    ethereum: 3500,
    cardano: 0.95,
    solana: 230,
    polkadot: 8.5,
  };
  const base = basePrices[symbol] || 100;
  const now = Date.now();
  return Array.from({ length: count }, (_, i) => ({
    t: new Date(now - (count - i) * 3600000).toISOString(),
    priceUsd: base * (1 + (Math.random() - 0.5) * 0.1),
  }));
}

function generateMockChanges() {
  return MOCK_ASSETS.map(a => ({
    symbol: a.symbol,
    name: a.name,
    last: a.symbol === "bitcoin" ? 95000 : a.symbol === "ethereum" ? 3500 : Math.random() * 100,
    change24hPct: (Math.random() - 0.5) * 10,
  }));
}

function generateMockOhlc(symbol: string): OhlcPoint[] {
  const basePrices: Record<string, number> = {
    bitcoin: 95000,
    ethereum: 3500,
    cardano: 0.95,
    solana: 230,
    polkadot: 8.5,
  };
  const base = basePrices[symbol] || 100;
  const now = Date.now();
  return Array.from({ length: 24 }, (_, i) => {
    const open = base * (1 + (Math.random() - 0.5) * 0.05);
    const close = base * (1 + (Math.random() - 0.5) * 0.05);
    const high = Math.max(open, close) * (1 + Math.random() * 0.02);
    const low = Math.min(open, close) * (1 - Math.random() * 0.02);
    return {
      t: new Date(now - (24 - i) * 3600000).toISOString(),
      open, high, low, close,
      volume: Math.random() * 1000000,
    };
  });
}

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

function getMockUsers(): Array<{ email: string; password: string; name: string | null }> {
  const stored = localStorage.getItem("mockUsers");
  return stored ? JSON.parse(stored) : [];
}

function saveMockUser(email: string, password: string, name: string | null): void {
  const users = getMockUsers();
  users.push({ email, password, name });
  localStorage.setItem("mockUsers", JSON.stringify(users));
}

export async function register(email: string, password: string, name?: string): Promise<AuthResponse> {
  if (USE_MOCK_AUTH) {
    const users = getMockUsers();
    if (users.find(u => u.email === email)) {
      throw new Error("Cet email est déjà utilisé");
    }
    
    const user: User = {
      id: Date.now(),
      email,
      name: name || null,
      role: "USER",
    };
    const token = `mock-token-${Date.now()}`;
    
    saveMockUser(email, password, name || null);
    setToken(token);
    setStoredUser(user);
    
    return { user, token };
  }

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
  if (USE_MOCK_AUTH) {
    const users = getMockUsers();
    const found = users.find(u => u.email === email && u.password === password);
    
    if (!found) {
      throw new Error("Email ou mot de passe incorrect");
    }
    
    const user: User = {
      id: Date.now(),
      email: found.email,
      name: found.name,
      role: "USER",
    };
    const token = `mock-token-${Date.now()}`;
    
    setToken(token);
    setStoredUser(user);
    
    return { user, token };
  }

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
  if (USE_MOCK_AUTH) {
    const user = getStoredUser();
    if (!user || !getToken()) {
      throw new Error("Non authentifié");
    }
    return user;
  }

  const r = await fetch(`${BASE}/auth/me`, { headers: authHeaders() });
  const j = await r.json();
  if (!r.ok) {
    setToken(null);
    setStoredUser(null);
    throw new Error(j.error || "Non authentifié");
  }
  return j.data;
}

export function logout(): void {
  setToken(null);
  setStoredUser(null);
}

// ===== Data Types =====
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

export type OhlcPoint = {
  t: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number | null;
};

// ===== API Functions =====
export async function fetchAssets(): Promise<Asset[]> {
  if (USE_MOCK_DATA) {
    console.log("[MOCK] fetchAssets");
    return MOCK_ASSETS;
  }
  try {
    const r = await fetch(`${BASE}/assets`);
    if (!r.ok) throw new Error("Failed /assets");
    const j = await r.json();
    return j.data ?? [];
  } catch (e) {
    if (FALLBACK_TO_MOCK) {
      console.warn("[FALLBACK] fetchAssets - using mock data:", e);
      return MOCK_ASSETS;
    }
    throw e;
  }
}

export async function fetchPrices(symbol: string, limit = 50): Promise<PricePoint[]> {
  if (USE_MOCK_DATA) {
    console.log("[MOCK] fetchPrices:", symbol);
    return generateMockPrices(symbol, limit);
  }
  try {
    const r = await fetch(`${BASE}/prices?symbol=${encodeURIComponent(symbol)}&limit=${limit}`);
    if (!r.ok) throw new Error("Failed /prices");
    const j = await r.json();
    return (j.data ?? []).map((d: any) => ({ t: d.t, priceUsd: d.priceUsd }));
  } catch (e) {
    if (FALLBACK_TO_MOCK) {
      console.warn("[FALLBACK] fetchPrices - using mock data:", e);
      return generateMockPrices(symbol, limit);
    }
    throw e;
  }
}

export async function fetchChanges(): Promise<{symbol: string; name: string; last: number | null; change24hPct: number | null}[]> {
  if (USE_MOCK_DATA) {
    console.log("[MOCK] fetchChanges");
    return generateMockChanges();
  }
  try {
    const r = await fetch(`${BASE}/changes`);
    const j = await r.json();
    return j.data ?? [];
  } catch (e) {
    if (FALLBACK_TO_MOCK) {
      console.warn("[FALLBACK] fetchChanges - using mock data:", e);
      return generateMockChanges();
    }
    throw e;
  }
}

export async function fetchAlerts(): Promise<Alert[]> {
  const r = await fetch(`${BASE}/alerts`, { headers: authHeaders() });
  if (!r.ok) throw new Error("Failed /alerts");
  const j = await r.json();
  return j.data ?? [];
}

export async function createAlert(assetId: number, type: AlertType, threshold: number): Promise<Alert> {
  const r = await fetch(`${BASE}/alerts`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ assetId, type, threshold }),
  });
  if (!r.ok) throw new Error("Failed to create alert");
  const j = await r.json();
  return j.data;
}

export async function activateAlert(id: number): Promise<Alert> {
  const r = await fetch(`${BASE}/alerts/${id}/activate`, { method: "PUT", headers: authHeaders() });
  if (!r.ok) throw new Error("Failed to activate alert");
  const j = await r.json();
  return j.data;
}

export async function deactivateAlert(id: number): Promise<Alert> {
  const r = await fetch(`${BASE}/alerts/${id}/deactivate`, { method: "PUT", headers: authHeaders() });
  if (!r.ok) throw new Error("Failed to deactivate alert");
  const j = await r.json();
  return j.data;
}

export async function deleteAlert(id: number): Promise<void> {
  const r = await fetch(`${BASE}/alerts/${id}`, { method: "DELETE", headers: authHeaders() });
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
  const r = await fetch(`${BASE}/portfolios`, { headers: authHeaders() });
  if (!r.ok) throw new Error("Failed /portfolios");
  const j = await r.json();
  return j.data ?? [];
}

export async function createPortfolio(name: string): Promise<Portfolio> {
  const r = await fetch(`${BASE}/portfolios`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ name }),
  });
  if (!r.ok) throw new Error("Failed to create portfolio");
  const j = await r.json();
  return j.data;
}

export async function deletePortfolio(id: number): Promise<void> {
  const r = await fetch(`${BASE}/portfolios/${id}`, { method: "DELETE", headers: authHeaders() });
  if (!r.ok) throw new Error("Failed to delete portfolio");
}

export async function fetchPortfolioPnL(portfolioId: number): Promise<PortfolioPnL> {
  const r = await fetch(`${BASE}/portfolios/${portfolioId}/pnl`, { headers: authHeaders() });
  if (!r.ok) throw new Error("Failed to fetch portfolio PnL");
  const j = await r.json();
  return j.data;
}

export async function fetchPositions(portfolioId: number): Promise<Position[]> {
  const r = await fetch(`${BASE}/portfolios/${portfolioId}/positions`, { headers: authHeaders() });
  if (!r.ok) throw new Error("Failed /positions");
  const j = await r.json();
  return j.data ?? [];
}

export async function fetchOhlc(
  symbol: string,
  granularity: string = "1h"
): Promise<OhlcPoint[]> {
  if (USE_MOCK_DATA) {
    console.log("[MOCK] fetchOhlc:", symbol);
    return generateMockOhlc(symbol);
  }
  try {
    const r = await fetch(
      `${BASE}/prices/ohlc?symbol=${encodeURIComponent(symbol)}&granularity=${encodeURIComponent(granularity)}`
    );
    if (!r.ok) throw new Error("Failed /prices/ohlc");
    const j = await r.json();
    return (j.data ?? []).map((d: any) => ({
      t: d.t,
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
      volume: d.volume ?? d.volumeUsd ?? null,
    }));
  } catch (e) {
    if (FALLBACK_TO_MOCK) {
      console.warn("[FALLBACK] fetchOhlc - using mock data:", e);
      return generateMockOhlc(symbol);
    }
    throw e;
  }
}

export async function fetchTrades(portfolioId: number, limit = 20): Promise<Trade[]> {
  const r = await fetch(`${BASE}/portfolios/${portfolioId}/trades?limit=${limit}`, { headers: authHeaders() });
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
    headers: authHeaders(),
    body: JSON.stringify({ assetId, side, quantity, priceUsd, notes }),
  });
  if (!r.ok) throw new Error("Failed to execute trade");
  const j = await r.json();
  return j.data;
}

