#  Documentation Technique Complète - CryptoTracker

> Application de suivi de portefeuille crypto avec alertes et prévisions

---

## Table des matières

1. [Vue d'ensemble](#1-vue-densemble)
2. [Architecture](#2-architecture)
3. [Backend](#3-backend)
4. [Frontend](#4-frontend)
5. [Base de données](#5-base-de-données)
6. [API Reference](#6-api-reference)
7. [Services](#7-services)
8. [Authentification & Sécurité](#8-authentification--sécurité)
9. [Tests](#9-tests)
10. [Déploiement](#10-déploiement)
11. [Configuration](#11-configuration)

---

## 1. Vue d'ensemble

### 1.1 Description du projet

CryptoTracker est une application full-stack de suivi de crypto-monnaies comprenant :

- **Backend** : API REST Node.js/Express/TypeScript avec PostgreSQL
- **Frontend** : Application React/TypeScript avec Vite
- **Collecte** : Intégration CoinGecko API avec scheduler automatique
- **Notifications** : Système d'alertes avec webhooks Discord

### 1.2 Stack technique

| Composant | Technologies |
|-----------|--------------|
| Backend | Node.js 20+, Express 5, TypeScript 5.6 |
| ORM | Prisma 6.x |
| Base de données | PostgreSQL 15+ |
| Frontend | React 19, Vite 6, TypeScript |
| Graphiques | Recharts, SVG natif |
| Auth | JWT, bcryptjs |
| Tests | Vitest, Supertest |
| Containerisation | Docker, Docker Compose |
| Orchestration | Kubernetes (K8s) |

### 1.3 Structure du projet

```
gla/
├── backend/                 # API Node.js
│   ├── src/
│   │   ├── api/            # Serveur Express
│   │   ├── config/         # Configuration
│   │   ├── jobs/           # Scheduler (cron)
│   │   ├── middlewares/    # Auth middleware
│   │   ├── providers/      # CoinGecko API
│   │   ├── repos/          # Prisma client
│   │   ├── routes/         # Routes Express
│   │   ├── services/       # Business logic
│   │   └── tests/          # Tests unitaires
│   ├── prisma/             # Schéma & migrations
│   └── k8s/                # Manifestes Kubernetes
├── frontend/               # Application React
│   ├── src/
│   │   ├── components/     # Composants UI
│   │   ├── contexts/       # React contexts
│   │   ├── hooks/          # Custom hooks
│   │   ├── lib/            # API client
│   │   └── utils/          # Fonctions utilitaires
└── docs/                   # Documentation
```

---

## 2. Architecture

### 2.1 Architecture globale

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│   Frontend      │────▶│   Backend API   │────▶│   PostgreSQL    │
│   (React)       │     │   (Express)     │     │   (Prisma)      │
│                 │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                               │
                               │ Scheduler
                               ▼
                        ┌─────────────────┐
                        │                 │
                        │   CoinGecko     │
                        │   API           │
                        │                 │
                        └─────────────────┘
```

### 2.2 Architecture Backend (Layered)

```
┌─────────────────────────────────────────────────────────────┐
│                        Routes Layer                          │
│  (auth.routes, admin.routes, alert.routes, portfolio.routes) │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Services Layer                          │
│   (AuthService, AdminService, AlertService, ForecastService) │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Repository Layer                          │
│                   (Prisma Client)                            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      PostgreSQL                              │
└─────────────────────────────────────────────────────────────┘
```

### 2.3 Flux de données

#### Collecte automatique
1. **Scheduler** (node-cron) déclenche la collecte toutes les 5 minutes
2. **CollectService** appelle le provider CoinGecko
3. **CoinGeckoProvider** récupère les données des markets
4. **CollectService** persiste les `MarketSnapshot` via Prisma
5. **AlertService.evaluateAll()** vérifie les alertes actives
6. **NotifierService** envoie les notifications Discord si déclenchées

#### Requête utilisateur
1. **Frontend** envoie requête HTTP avec JWT
2. **Middleware auth** vérifie le token
3. **Route** valide les paramètres et appelle le service
4. **Service** exécute la logique métier
5. **Prisma** interroge PostgreSQL
6. **Réponse JSON** retournée au frontend

---

## 3. Backend

### 3.1 Point d'entrée

```typescript
// src/index.ts
import "dotenv/config";
import { app } from "./api/server.js";
import { initScheduler } from "./jobs/scheduler.js";
import { prisma } from "./repos/prisma.js";

const PORT = Number(process.env.PORT) || 4000;

async function main() {
  await prisma.$connect();
  initScheduler();
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

main();
```

### 3.2 Configuration serveur Express

```typescript
// src/api/server.ts
import express from "express";
import cors from "cors";
import morgan from "morgan";

// Import des routes
import healthRoutes from "../routes/health.routes.js";
import authRoutes from "../routes/auth.routes.js";
import adminRoutes from "../routes/admin.routes.js";
import assetRoutes from "../routes/asset.routes.js";
import priceRoutes from "../routes/price.routes.js";
import alertRoutes from "../routes/alert.routes.js";
import portfolioRoutes from "../routes/portfolio.routes.js";
import forecastRoutes from "../routes/forecast.routes.js";

export const app = express();

// Middlewares globaux
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

// Montage des routes
app.use("/health", healthRoutes);
app.use("/auth", authRoutes);
app.use("/admin", adminRoutes);
app.use("/assets", assetRoutes);
app.use("/prices", priceRoutes);
app.use("/alerts", alertRoutes);
app.use("/portfolios", portfolioRoutes);
app.use("/forecast", forecastRoutes);
```

### 3.3 Structure des routes

Chaque module de route suit le pattern :

```typescript
// src/routes/<module>.routes.ts
import { Router } from "express";
import { authenticate, authorize } from "../middlewares/auth.js";
import { SomeService } from "../services/SomeService.js";

const router = Router();

// Middleware d'authentification si nécessaire
router.use(authenticate);

// GET /endpoint
router.get("/", async (req, res) => {
  try {
    const data = await SomeService.getData();
    res.json({ data });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
```

---

## 4. Frontend

### 4.1 Structure des composants

```
src/
├── App.tsx              # Composant principal + navigation par onglets
├── main.tsx             # Point d'entrée React
├── components/
│   ├── Controls.tsx     # Sélecteurs (crypto, période, options)
│   ├── CryptoChart.tsx  # Graphique en ligne (Recharts)
│   ├── CandlestickChart.tsx  # Graphique en chandeliers
│   ├── PriceBadges.tsx  # Affichage prix et variations
│   ├── AlertsPanel.tsx  # Gestion des alertes
│   ├── ForecastChart.tsx # Graphique de prévisions
│   ├── PortfolioPanel.tsx # Gestion portfolio
│   ├── AdminDashboard.tsx # Panel admin
│   └── LoginPage.tsx    # Page de connexion
├── contexts/
│   └── AuthContext.tsx  # Context d'authentification
├── hooks/
│   └── useMarketData.ts # Hook de récupération des données
├── lib/
│   └── api.ts          # Client HTTP (fetch)
└── utils/
    ├── series.ts       # Construction des séries de données
    ├── percent.ts      # Calculs de pourcentages
    └── domains.ts      # Calculs des domaines Y
```

### 4.2 Context d'authentification

```typescript
// src/contexts/AuthContext.tsx
export interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => void;
}
```

### 4.3 Hook useMarketData

```typescript
// src/hooks/useMarketData.ts
export function useMarketData(symbol: string, compare: string, limit: number) {
  // Charge les assets, prix principal, prix comparaison
  // Auto-refresh toutes les 60 secondes
  return { assets, dataPrimary, dataCompare, loading, err };
}
```

### 4.4 Client API

```typescript
// src/lib/api.ts
const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

// Fonctions d'appel API
fetchAssets(): Promise<Asset[]>
fetchPrices(symbol, limit): Promise<Price[]>
fetchOhlc(symbol, granularity): Promise<OhlcPoint[]>
fetchForecast(symbol, method, history, steps): Promise<Forecast>
fetchAlerts(): Promise<Alert[]>
fetchPortfolios(): Promise<Portfolio[]>
// ... etc
```

---

## 5. Base de données

### 5.1 Schéma Prisma

```prisma
// prisma/schema.prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

enum Role {
  USER
  ADMIN
}
```

### 5.2 Modèles de données

#### User (Utilisateurs)
```prisma
model User {
  id        Int      @id @default(autoincrement())
  email     String   @unique
  password  String   
  name      String?
  role      Role     @default(USER)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  portfolios Portfolio[]
  alerts     Alert[]
}
```

#### Asset (Crypto-monnaies)
```prisma
model Asset {
  id         Int              @id @default(autoincrement())
  providerId String           @unique   // ex: "bitcoin"
  source     String                      // ex: "coingecko"
  symbol     String                      // ex: "btc"
  name       String                      // ex: "Bitcoin"
  createdAt  DateTime         @default(now())
  
  snapshots  MarketSnapshot[]
  alerts     Alert[]
  positions  Position[]
  trades     Trade[]
}
```

#### MarketSnapshot (Prix historiques)
```prisma
model MarketSnapshot {
  id           Int       @id @default(autoincrement())
  assetId      Int
  ingestedAt   DateTime  @default(now())
  providerTs   DateTime?
  priceUsd     Float
  volume24hUsd Float?
  marketCapUsd Float?
  change24hPct Float?

  asset Asset @relation(fields: [assetId], references: [id])
  @@index([assetId, ingestedAt(sort: Desc)])
}
```

#### Alert (Alertes)
```prisma
model Alert {
  id            Int               @id @default(autoincrement())
  assetId       Int
  userId        Int?
  type          String            // price_above, price_below, change_above, change_below
  threshold     Float
  isActive      Boolean           @default(true)
  createdAt     DateTime          @default(now())
  lastTriggered DateTime?
  
  notifications NotificationLog[]
  asset         Asset  @relation(...)
  user          User?  @relation(...)
}
```

#### Portfolio, Position, Trade
```prisma
model Portfolio {
  id        Int        @id @default(autoincrement())
  userId    Int?
  name      String
  positions Position[]
  trades    Trade[]
}

model Position {
  id          Int   @id @default(autoincrement())
  portfolioId Int
  assetId     Int
  quantity    Float
  avgCost     Float
  @@unique([portfolioId, assetId])
}

model Trade {
  id          Int      @id @default(autoincrement())
  portfolioId Int
  assetId     Int
  side        String   // "buy" | "sell"
  quantity    Float
  priceUsd    Float
  totalUsd    Float
  executedAt  DateTime @default(now())
}
```

### 5.3 Diagramme ERD

```
┌────────────────┐       ┌────────────────┐       ┌────────────────┐
│     User       │       │     Asset      │       │ MarketSnapshot │
├────────────────┤       ├────────────────┤       ├────────────────┤
│ id (PK)        │       │ id (PK)        │◀──────│ assetId (FK)   │
│ email          │       │ providerId     │       │ priceUsd       │
│ password       │       │ symbol         │       │ volume24hUsd   │
│ role           │       │ name           │       │ change24hPct   │
│ name           │       │ source         │       │ ingestedAt     │
└────────────────┘       └────────────────┘       └────────────────┘
        │                        │
        │                        │
        ▼                        ▼
┌────────────────┐       ┌────────────────┐
│   Portfolio    │       │     Alert      │
├────────────────┤       ├────────────────┤
│ id (PK)        │       │ id (PK)        │
│ userId (FK)    │       │ assetId (FK)   │
│ name           │       │ userId (FK)    │
└────────────────┘       │ type           │
        │                │ threshold      │
        │                │ isActive       │
        ▼                └────────────────┘
┌────────────────┐
│   Position     │       ┌────────────────┐
├────────────────┤       │     Trade      │
│ portfolioId    │       ├────────────────┤
│ assetId (FK)   │       │ portfolioId    │
│ quantity       │       │ assetId (FK)   │
│ avgCost        │       │ side           │
└────────────────┘       │ quantity       │
                         │ priceUsd       │
                         └────────────────┘
```

---

## 6. API Reference

### 6.1 Authentification

| Méthode | Endpoint | Description | Auth |
|---------|----------|-------------|------|
| POST | `/auth/register` | Inscription |  |
| POST | `/auth/login` | Connexion |  |
| GET | `/auth/me` | Profil utilisateur | |
| PATCH | `/auth/password` | Modifier mot de passe |  |

#### POST /auth/register
```json
// Request
{ "email": "user@example.com", "password": "secret123", "name": "John" }

// Response 201
{ "data": { "user": { "id": 1, "email": "...", "role": "USER" }, "token": "eyJ..." } }
```

#### POST /auth/login
```json
// Request
{ "email": "user@example.com", "password": "secret123" }

// Response 200
{ "data": { "user": { "id": 1, "email": "..." }, "token": "eyJ..." } }
```

### 6.2 Assets

| Méthode | Endpoint | Description | Auth |
|---------|----------|-------------|------|
| GET | `/assets` | Liste des actifs |  |
| GET | `/assets/:symbol` | Détails d'un actif |  |

### 6.3 Prix

| Méthode | Endpoint | Description | Auth |
|---------|----------|-------------|------|
| GET | `/prices` | Prix historiques |  |
| GET | `/prices/ohlc` | Données OHLC |  |
| GET | `/prices/changes` | Variations 24h |  |

#### GET /prices
```
GET /prices?symbol=bitcoin&limit=50

Response:
{ "data": [{ "t": "2025-01-01T00:00:00Z", "priceUsd": 95000, ... }] }
```

#### GET /prices/ohlc
```
GET /prices/ohlc?symbol=bitcoin&granularity=1h

Response:
{ "symbol": "bitcoin", "granularity": "1h", "data": [
  { "t": "...", "open": 95000, "high": 95500, "low": 94800, "close": 95200 }
]}
```

### 6.4 Alertes

| Méthode | Endpoint | Description | Auth |
|---------|----------|-------------|------|
| GET | `/alerts` | Liste des alertes |  |
| GET | `/alerts/:id` | Détails d'une alerte |  |
| POST | `/alerts` | Créer une alerte |  |
| PATCH | `/alerts/:id/activate` | Activer | |
| PATCH | `/alerts/:id/deactivate` | Désactiver |  |
| DELETE | `/alerts/:id` | Supprimer |  |

#### POST /alerts
```json
// Request
{ "assetId": 1, "type": "price_above", "threshold": 100000 }

// Response 201
{ "data": { "id": 1, "assetId": 1, "type": "price_above", "threshold": 100000, "isActive": true } }
```

### 6.5 Portfolios

| Méthode | Endpoint | Description | Auth |
|---------|----------|-------------|------|
| GET | `/portfolios` | Liste des portfolios |  |
| GET | `/portfolios/:id` | Détails portfolio |  |
| POST | `/portfolios` | Créer portfolio |  |
| DELETE | `/portfolios/:id` | Supprimer portfolio |  |
| GET | `/portfolios/:id/positions` | Positions |  |
| GET | `/portfolios/:id/pnl` | Calcul PnL |  |
| GET | `/portfolios/:id/trades` | Historique trades |  |
| POST | `/portfolios/:id/trades` | Exécuter trade |  |

#### POST /portfolios/:id/trades
```json
// Request
{ "assetId": 1, "side": "buy", "quantity": 0.5, "priceUsd": 95000, "notes": "Achat BTC" }

// Response 201
{ "data": { "id": 1, "side": "buy", "quantity": 0.5, "totalUsd": 47500 } }
```

### 6.6 Prévisions

| Méthode | Endpoint | Description | Auth |
|---------|----------|-------------|------|
| GET | `/forecast` | Générer prévision |  |

#### GET /forecast
```
GET /forecast?symbol=bitcoin&method=ema&history=50&steps=10

Response:
{
  "data": {
    "symbol": "bitcoin",
    "method": "ema",
    "historical": [{ "t": "...", "price": 95000 }],
    "predicted": [{ "t": "...", "price": 96000 }],
    "metrics": {
      "lastPrice": 95000,
      "predictedPrice": 96000,
      "predictedChange": 1000,
      "predictedChangePct": 1.05
    }
  }
}
```

### 6.7 Administration

| Méthode | Endpoint | Description | Auth |
|---------|----------|-------------|------|
| GET | `/admin/stats` | Statistiques globales |  ADMIN |
| GET | `/admin/users` | Liste utilisateurs |  ADMIN |
| GET | `/admin/users/:id` | Détails utilisateur |  ADMIN |
| POST | `/admin/users` | Créer utilisateur |  ADMIN |
| PATCH | `/admin/users/:id` | Modifier utilisateur |  ADMIN |
| DELETE | `/admin/users/:id` | Supprimer utilisateur |  ADMIN |

### 6.8 Santé

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/health` | Status de l'API |
| GET | `/health/db` | Status base de données |

---

## 7. Services

### 7.1 AuthService

Gestion de l'authentification et des utilisateurs.

```typescript
// src/services/AuthService.ts
export class AuthService {
  static async register(email: string, password: string, name?: string)
  static async login(email: string, password: string)
  static async getUserById(id: number)
  static async updatePassword(userId: number, current: string, newPass: string)
}
```

### 7.2 AlertService

Gestion des alertes et évaluation automatique.

```typescript
// src/services/AlertService.ts
export async function createAlert(userId: number, assetId: number, type: AlertType, threshold: number)
export async function getUserAlerts(userId: number, options?: { assetId?: number; activeOnly?: boolean })
export async function activateAlert(id: number)
export async function deactivateAlert(id: number)
export async function deleteAlert(id: number)
export async function evaluateAll()  // Appelé par le scheduler
```

**Types d'alertes supportés :**
- `price_above` : Prix > seuil
- `price_below` : Prix < seuil
- `change_above` : Variation 24h > seuil %
- `change_below` : Variation 24h < seuil %

### 7.3 PortfolioService

Gestion des portfolios, positions et trades.

```typescript
// src/services/PortfolioService.ts
export async function createPortfolio(name: string, userId?: number)
export async function getPortfoliosByUser(userId: number)
export async function getPortfolio(id: number)
export async function deletePortfolio(id: number)
export async function getPortfolioPositions(portfolioId: number)
export async function getPortfolioPnL(portfolioId: number)
export async function getTradeHistory(portfolioId: number, limit?: number)
export async function executeTrade(portfolioId: number, assetId: number, side: TradeSide, quantity: number, priceUsd: number, notes?: string)
```

**Calcul du PnL :**
```typescript
const currentValue = position.quantity * currentPrice;
const totalCost = position.quantity * position.avgCost;
const unrealizedPnl = currentValue - totalCost;
const unrealizedPnlPct = (unrealizedPnl / totalCost) * 100;
```

### 7.4 ForecastService

Génération de prévisions de prix.

```typescript
// src/services/ForecastService.ts
export type ForecastMethod = "sma" | "ema" | "linear";

export async function generateForecast(
  symbol: string,
  method: ForecastMethod,
  history: number,
  steps: number
)
```

**Algorithmes :**

| Méthode | Formule |
|---------|---------|
| SMA | `SMA = (P₁ + P₂ + ... + Pₙ) / n` |
| EMA | `EMAₜ = α × Pₜ + (1 - α) × EMAₜ₋₁` où `α = 2/(n+1)` |
| Linear | Régression linéaire `y = mx + b` |

### 7.5 CollectService

Collecte automatique des données de marché.

```typescript
// src/services/CollectService.ts
export async function runCollect()
// 1. Appelle CoinGeckoProvider.fetchMarkets()
// 2. Upsert des assets
// 3. Insert des MarketSnapshots
// 4. Crée un CollectRun log
// 5. Appelle AlertService.evaluateAll()
```

### 7.6 NotifierService

Envoi de notifications.

```typescript
// src/services/NotifierService.ts
export async function sendNotification(alert: Alert, currentPrice: number)
// Envoie un webhook Discord si DISCORD_WEBHOOK_URL est configuré
```

---

## 8. Authentification & Sécurité

### 8.1 JWT (JSON Web Token)

**Configuration :**
```env
JWT_SECRET=votre_secret_jwt_très_long
JWT_EXPIRES_IN=7d
```

**Structure du token :**
```json
{
  "userId": 1,
  "email": "user@example.com",
  "role": "USER",
  "iat": 1234567890,
  "exp": 1234567890
}
```

### 8.2 Middleware d'authentification

```typescript
// src/middlewares/auth.ts
export const authenticate = async (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Token required" });
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
};

export const authorize = (...roles: Role[]) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ error: "Forbidden" });
  }
  next();
};
```

### 8.3 Hashage des mots de passe

```typescript
import bcrypt from "bcryptjs";

// Hash à l'inscription
const hash = await bcrypt.hash(password, 12);

// Vérification à la connexion
const valid = await bcrypt.compare(password, user.password);
```

### 8.4 Bonnes pratiques

-  Mots de passe hashés avec bcrypt (cost factor 12)
-  Tokens JWT avec expiration
- Middleware d'authentification sur routes protégées
-  Middleware d'autorisation pour les routes admin
-  Validation des entrées utilisateur
-  Gestion des erreurs sans fuite d'information

---

## 9. Tests

### 9.1 Configuration Vitest

```typescript
// vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
    },
  },
});
```

### 9.2 Structure des tests

```
src/tests/
├── services/
│   ├── AuthService.test.ts
│   ├── AlertService.test.ts
│   ├── PortfolioService.test.ts
│   └── ForecastService.test.ts
├── middlewares/
│   └── auth.test.ts
└── integration/
    └── api.integration.test.ts
```

### 9.3 Exécution des tests

```bash
# Tous les tests
npm test

# Avec couverture
npm run test:coverage

# Mode watch
npm run test:watch
```

### 9.4 Exemple de test

```typescript
import { describe, it, expect, vi } from "vitest";
import { AuthService } from "../services/AuthService";

describe("AuthService", () => {
  it("should register a new user", async () => {
    const result = await AuthService.register("test@example.com", "password123");
    expect(result.user.email).toBe("test@example.com");
    expect(result.token).toBeDefined();
  });
});
```

---

## 10. Déploiement

### 10.1 Docker

#### Backend Dockerfile
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
RUN npx prisma generate
EXPOSE 4000
CMD ["node", "dist/index.js"]
```

#### Docker Compose
```yaml
version: "3.8"
services:
  backend:
    build: ./backend
    ports:
      - "4000:4000"
    environment:
      - DATABASE_URL=postgresql://user:pass@postgres:5432/crypto
    depends_on:
      - postgres
      
  frontend:
    build: ./frontend
    ports:
      - "3000:80"
      
  postgres:
    image: postgres:15
    environment:
      POSTGRES_USER: user
      POSTGRES_PASSWORD: pass
      POSTGRES_DB: crypto
    volumes:
      - postgres_data:/var/lib/postgresql/data
```

### 10.2 Kubernetes

Les manifestes K8s sont dans `backend/k8s/` :

```
k8s/
├── namespace.yaml
├── configmap.yaml
├── secrets.yaml
├── postgres-deployment.yaml
├── postgres-service.yaml
├── backend-deployment.yaml
├── backend-service.yaml
├── frontend-deployment.yaml
├── frontend-service.yaml
├── ingress.yaml
├── hpa.yaml (Horizontal Pod Autoscaler)
└── kustomization.yaml
```

#### Déploiement
```bash
kubectl apply -k backend/k8s/
```

### 10.3 Migrations Prisma

```bash
# Créer une migration
npx prisma migrate dev --name migration_name

# Appliquer en production
npx prisma migrate deploy

# Générer le client
npx prisma generate
```

---

## 11. Configuration

### 11.1 Variables d'environnement Backend

| Variable | Description | Défaut |
|----------|-------------|--------|
| `PORT` | Port du serveur | `4000` |
| `DATABASE_URL` | URL PostgreSQL | - |
| `JWT_SECRET` | Secret JWT | - |
| `JWT_EXPIRES_IN` | Expiration JWT | `7d` |
| `COINGECKO_API_URL` | URL API CoinGecko | `https://api.coingecko.com/api/v3` |
| `DISCORD_WEBHOOK_URL` | Webhook Discord | - |
| `CRON_SCHEDULE` | Fréquence collecte | `*/5 * * * *` |

### 11.2 Variables d'environnement Frontend

| Variable | Description | Défaut |
|----------|-------------|--------|
| `VITE_API_URL` | URL du backend | `http://localhost:4000` |

### 11.3 Exemple .env Backend

```env
# Server
PORT=4000

# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/cryptotracker

# JWT
JWT_SECRET=super_secret_key_change_this_in_production
JWT_EXPIRES_IN=7d

# CoinGecko
COINGECKO_API_URL=https://api.coingecko.com/api/v3

# Notifications
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/xxx/yyy

# Scheduler
CRON_SCHEDULE=*/5 * * * *
```

### 11.4 Installation locale

```bash
# Clone du projet
git clone <repo_url>
cd gla

# Backend
cd backend
npm install
cp .env.example .env  # Configurer les variables
npx prisma migrate dev
npm run dev

# Frontend (nouveau terminal)
cd frontend
npm install
npm run dev
```

---

## Annexes

### A. Scripts npm Backend

```json
{
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "lint": "eslint src/",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev"
  }
}
```

### B. Codes d'erreur HTTP

| Code | Description |
|------|-------------|
| 200 | Succès |
| 201 | Créé |
| 400 | Bad Request (validation) |
| 401 | Non authentifié |
| 403 | Non autorisé |
| 404 | Non trouvé |
| 409 | Conflit (email existe déjà) |
| 500 | Erreur serveur |

### C. Format de réponse API

```json
// Succès
{ "data": { ... } }

// Succès avec message
{ "ok": true, "message": "Action completed" }

// Erreur
{ "error": "Description de l'erreur" }
```

---

*Documentation technique v2.0 - CryptoTracker*
