#  Sprint 1 : Collecte & Stockage

## 1. Architecture générale du backend 

L’objectif du Sprint 1 est de mettre en place un service de collecte autonome qui récupère périodiquement les données de plusieurs cryptomonnaies, les stocke dans une base PostgreSQL et trace chaque exécution de collecte.

Les composants principaux sont :

- **API backend (Express)** : expose des endpoints HTTP (`/health`, `/collect`, `/assets`, `/prices`, `/changes`).
- **Service de collecte (`CollectService`)** : contient la logique d’un run de collecte (`runOnce`).
- **Scheduler (`scheduler.ts`)** : lance `runOnce` automatiquement toutes les 60 secondes (cron).
- **Providers externes (CoinGecko)** : appel HTTP à l’API publique de CoinGecko pour récupérer les prix.
- **Accès base de données (Prisma)** : ORM utilisé pour lire/écrire dans PostgreSQL.
- **Base de données PostgreSQL (Docker)** : stocke les tables `Asset`, `MarketSnapshot` et `CollectRun`.

### 1.1 Schéma d’architecture (vue simple)
![schema_architecture](./images/architecture.png)
## 2. Modèle de données (PostgreSQL + Prisma)

Le modèle de données est défini avec Prisma et migré vers PostgreSQL. Il contient trois tables principales pour le Sprint 1 (asset,marketsnapshot,collectRun).
## 3. Déroulement d’un run de collecte (`runOnce`)

Un run de collecte complet se déroule en plusieurs étapes :

1. **Création d’un CollectRun**
   - Au début de `runOnce`, une nouvelle ligne est créée dans `CollectRun` avec `status = "running"`.

2. **Lecture de la configuration**
   - La liste des cryptos à suivre est lue dans la configuration .

3. **Appel au provider (CoinGecko)**
   - Le service appelle l’API CoinGecko avec un timeout HTTP.
   - Les données sont normalisées dans un format interne (providerId, priceUsd, volume24hUsd, etc.).

4. **Écriture en base**
   - Pour chaque enregistrement :
     - upsert de l’`Asset` (création si besoin),
     - insertion d’un `MarketSnapshot` lié à l’Asset.

5. **Mise à jour de CollectRun**
   - Si tout s’est bien passé : `status = "success"`, `assetsCount`, `insertedCount`, `endedAt` renseignés.
   - En cas d’erreur : `status = "fail"`, `errorMessage` rempli, `endedAt` renseigné.

6. **Logs**
   - Le scheduler et le service loggent la durée du run, le nombre de lignes insérées et les éventuelles erreurs.

Le scheduler (cron) déclenche `runOnce` automatiquement à intervalle régulier par exemple toutes les 60 secondes, avec un verrou anti-overlap pour éviter d’avoir plusieurs runs en parallèle.
## 4. Endpoints exposés (Sprint 1)

- `GET /`  
  Retourne un message texte simple permettant de vérifier que le backend répond.

- `GET /health`  
  Vérifie l’état de l’API et de la base .

- `POST /collect`  
  Déclenche manuellement un run de collecte .

- `GET /assets`  
  Retourne la liste des actifs suivis (id, symbol, name).

- `GET /prices?symbol=&limit=`  
  Retourne l’historique des prix pour un actif donné, limité à N points.

- `GET /changes`  
  Retourne, pour chaque actif, le dernier prix connu et la variation 24h en pourcentage 
  ## 5. Installation et lancement (Sprint 1)
  - Node.js (version LTS)
- Docker + Docker Compose
- npm
# Sprint 2 : API & Visualisation
Le Sprint 2 a pour objectif de construire un premier **dashboard web** permettant
d’exposer les données collectées via une API REST et de visualiser l’évolution d’un actif
crypto dans le temps.

L’architecture repose sur deux blocs principaux :

- **Backend API (Node.js / Express)** : expose les endpoints `/assets`, `/prices`, `/changes`.
- **Frontend (React / Vite)** : consomme cette API et affiche un dashboard interactif
  avec graphique, filtres et indicateurs simples.
  
#### 1.1 Côté backend 
Pour le Sprint 2, l’API expose les endpoints suivants :
- `GET /assets`  
  Retourne la liste des cryptomonnaies suivies
- `GET /prices?symbol=<symbol>&limit=<n>`  
  Retourne l’historique des prix pour un actif donné, limité à *n* points récents.

- `GET /changes`  
  Retourne pour chaque actif le dernier prix connu et la variation sur 24h
  (utilisé pour les badges ).

L’API est protégée par CORS en mode développement (`cors({ origin: true })`), ce qui
permet au frontend React (port Vite) de communiquer avec l’API (port backend).
#### 1.2. Côté frontend : structure des composants

Le frontend est une application **React + Vite**. Le point d’entrée est `main.tsx`, qui
monte le composant racine `App`. 

Les éléments principaux sont :

- **`App.tsx`**  
  Composant principal qui :
  - gère les états de la page : actif sélectionné (`symbol`), actif de comparaison (`compare`),
    période (`limit`), options d’indicateurs (`showSMA`, `showEMA`), et mode
    normalisé ou non (`normalize`).
  - appelle le hook personalisé `useMarketData` pour récupérer les données depuis l’API.
  - construit les données prêtes pour le graphique (`chartData`),
  - calcule le dernier prix, la date de mise à jour et les variations en pourcentage,
  - orchestre l’affichage des sous-composants `Controls`, `PriceBadges` et `CryptoChart`. 

- **`useMarketData.ts` (hook personnalisé)**  
  Ce hook encapsule toute la logique d’accès aux données :
  - charge la liste des actifs via `fetchAssets()` (`GET /assets`),
  - charge les prix d’un actif via `fetchPrices(symbol, limit)` (`GET /prices`),
  - gère un état `loading` et `err` pour l’UX.
  - met en place un **auto-refresh** 60s .
    avec nettoyage du timer à chaque changement de `symbol`, `compare` ou `limit`.   

  Il retourne : `{ assets, dataPrimary, dataCompare, loading, err }`.

- **`lib/api.ts`**  
  Couche d’accès HTTP au backend :
  - `fetchAssets()` → `GET /assets`,
  - `fetchPrices(symbol, limit)` → `GET /prices`,
  - `fetchChanges()` → `GET /changes`.  
  L’URL de base de l’API est configurée via la variable d’environnement `VITE_API_URL`.   

- **`Controls.tsx`**  
  Composant d’interface qui affiche :
  - un sélecteur de crypto principale,
  - un sélecteur d’actif de comparaison,
  - un sélecteur de période (20 / 50 / 100 / 200 points),
  - des options d’affichage (variation %, SMA, EMA).  
  Il ne fait aucun appel API : il remonte simplement les changements grâce à un callback
  `onChange` et laisse `App` mettre à jour les états. 

- **`PriceBadges.tsx`**  
  Affiche la synthèse des informations :
  - dernier prix de la crypto sélectionnée,
  - date/heure de la dernière mise à jour,
  - variations en pourcentage pour l’actif principal et, si présent, pour
    l’actif de comparaison (badges colorés vert/rouge). 

- **`CryptoChart.tsx`**  
  Utilise la librairie de graphiques (Recharts) pour tracer :
  - la courbe de l’actif principal,
  - éventuellement la courbe de comparaison,
  - les indicateurs SMA/EMA si activés.  
  Il s’appuie sur des fonctions utilitaires (`minmax`, `paddedDomain`) pour calculer le
  domaine des axes Y et rendre un graph lisible, avec auto-ajustement du zoom. 

- **Utilitaires (`series.ts`, `percent.ts`, `domains.ts`)**  
  - `buildChartData(...)` assemble les séries (principal + comparaison + SMA/EMA) en un
    tableau unique prêt pour le graphique.
  - `normalizeSeries`, `pctChange`, `pctFromNormalized` gèrent les calculs de pourcentage
    et la représentation en base 100 pour les comparaisons relatives.
  - `minmax` et `paddedDomain` calculent les bornes min/max pour les axes.   
#### 1.3. Flux de données du backend au graphique

Le flux de données pour afficher un graphique dans le Sprint 2 est le suivant :

1. L’utilisateur choisit un actif et une période via le composant `Controls`.
2. `App` met à jour ses états (`symbol`, `compare`, `limit`) et appelle
   automatiquement le hook `useMarketData`.
3. `useMarketData` :
   - interroge le backend via `fetchPrices(symbol, limit)` (et éventuellement
     `fetchPrices(compare, limit)`),
   - met à jour `dataPrimary` et `dataCompare`,
   - indique l’état du chargement (`loading`) et les erreurs (`err`).
4. `App` construit `chartData` à partir de ces séries (et des options SMA/EMA/normalize)
   et calcule aussi le dernier prix et les variations.
5. `CryptoChart` affiche `chartData` sous forme de courbes, avec un axe Y adapté
   à chaque série.
6. `PriceBadges` affiche le dernier prix et les variations pour donner un résumé rapide.

#### 2.une capture de Frontend (dashboard sprint 2)
![dashboardsprint2](./images/dashboardsprint2.png)

---

# Sprint 3 : Graphique en Chandeliers (OHLC)

Le Sprint 3 ajoute un mode de visualisation alternatif : le graphique en **chandeliers japonais** (candlestick / OHLC), couramment utilisé en analyse technique pour visualiser l'évolution des prix.

## 1. Objectifs du Sprint 3

- Ajouter un endpoint backend pour agréger les prix en bougies OHLC (Open, High, Low, Close).
- Créer un composant frontend `CandlestickChart` pour afficher les chandeliers.
- Permettre à l'utilisateur de basculer entre le mode **Courbe** et le mode **Chandeliers**.

## 2. Backend : Endpoint OHLC

### 2.1 Nouveau endpoint

```
GET /prices/ohlc?symbol=<symbol>&granularity=<granularity>
```

**Paramètres :**
- `symbol` : identifiant de la crypto (ex: `bitcoin`)
- `granularity` : période d'agrégation (`1h`, `6h`, `24h`)

**Réponse :**
```json
{
  "symbol": "bitcoin",
  "granularity": "1h",
  "data": [
    { "t": "2025-11-30T10:00:00Z", "open": 91000, "high": 91500, "low": 90800, "close": 91200 },
    ...
  ]
}
```

### 2.2 Logique d'agrégation

L'endpoint récupère les `MarketSnapshot` de l'actif et les regroupe par intervalle de temps (bucket) :

1. Calcul du `bucketStart` : `Math.floor(timestamp / bucketMs) * bucketMs`
2. Pour chaque bucket :
   - `open` = premier prix du bucket
   - `high` = prix maximum
   - `low` = prix minimum
   - `close` = dernier prix du bucket

## 3. Frontend : Composant CandlestickChart

### 3.1 Structure du composant

Le composant `CandlestickChart.tsx` utilise **SVG natif** pour dessiner les chandeliers :

- **Wick (mèche)** : ligne verticale du `high` au `low`
- **Body (corps)** : rectangle entre `open` et `close`
- **Couleur** : vert si `close >= open` (haussier), rouge sinon (baissier)

### 3.2 Fonctionnalités

- Redimensionnement automatique via `ResizeObserver`
- Affichage des volumes en barres sous les chandeliers
- Tooltip au survol avec les valeurs OHLC
- Grille de fond pour faciliter la lecture

### 3.3 Intégration dans Controls

Le composant `Controls.tsx` est enrichi avec un sélecteur de mode :
- **Courbe** : graphique linéaire classique (Recharts)
- **Chandeliers (OHLC)** : graphique en bougies japonaises

## 4. Types de données

```typescript
export type OhlcPoint = {
  t: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number | null;
};
```

## 5. Flux de données

1. L'utilisateur sélectionne le mode **Chandeliers** dans `Controls`
2. `App.tsx` détecte `chartMode === "ohlc"` et appelle `fetchOhlc(symbol, granularity)`
3. Le backend agrège les snapshots en bougies OHLC
4. `CandlestickChart` affiche les données en SVG

---

# Sprint 4 : Alertes, Prévisions & Portfolio

Le Sprint 4 ajoute trois fonctionnalités avancées pour transformer le dashboard en outil de trading complet :

1. **Système d'alertes** : notifications quand un prix dépasse un seuil
2. **Prévisions** : prédictions de prix basées sur des algorithmes (SMA, EMA, régression linéaire)
3. **Gestion de portfolio** : suivi des positions et calcul des gains/pertes (PnL)

## 1. Architecture étendue

### 1.1 Nouveaux modèles Prisma

```prisma
model Alert {
  id            Int               @id @default(autoincrement())
  assetId       Int
  type          String            // price_above, price_below, change_above, change_below
  threshold     Float
  isActive      Boolean           @default(true)
  createdAt     DateTime          @default(now())
  lastTriggered DateTime?
  notifications NotificationLog[]

  asset Asset @relation(fields: [assetId], references: [id])
  @@index([assetId, isActive])
}

model NotificationLog {
  id        Int      @id @default(autoincrement())
  alertId   Int
  sentAt    DateTime @default(now())
  channel   String   // discord, email, webhook
  payload   Json?
  success   Boolean
  errorMsg  String?

  alert Alert @relation(fields: [alertId], references: [id])
  @@index([alertId, sentAt(sort: Desc)])
}

model Portfolio {
  id        Int        @id @default(autoincrement())
  name      String
  createdAt DateTime   @default(now())
  updatedAt DateTime   @updatedAt
  positions Position[]
  trades    Trade[]
}

model Position {
  id          Int      @id @default(autoincrement())
  portfolioId Int
  assetId     Int
  quantity    Float
  avgCost     Float
  updatedAt   DateTime @updatedAt

  portfolio Portfolio @relation(fields: [portfolioId], references: [id])
  asset     Asset     @relation(fields: [assetId], references: [id])

  @@unique([portfolioId, assetId])
  @@index([portfolioId])
}

model Trade {
  id          Int      @id @default(autoincrement())
  portfolioId Int
  assetId     Int
  side        String   // buy, sell
  quantity    Float
  priceUsd    Float
  totalUsd    Float
  executedAt  DateTime @default(now())
  notes       String?

  portfolio Portfolio @relation(fields: [portfolioId], references: [id])
  asset     Asset     @relation(fields: [assetId], references: [id])

  @@index([portfolioId, executedAt(sort: Desc)])
  @@index([assetId])
}
```

### 1.2 Nouveaux services backend

| Service | Fichier | Responsabilité |
|---------|---------|----------------|
| AlertService | `AlertService.ts` | Évaluation des alertes, déclenchement des notifications |
| ForecastService | `ForecastService.ts` | Calcul des prévisions (SMA, EMA, régression) |
| PortfolioService | `PortfolioService.ts` | Gestion des trades, positions, calcul PnL |
| NotifierService | `NotifierService.ts` | Envoi des notifications (Discord webhook) |

## 2. Système d'Alertes

### 2.1 Types d'alertes

| Type | Description |
|------|-------------|
| `price_above` | Prix dépasse un seuil |
| `price_below` | Prix descend sous un seuil |
| `change_above` | Variation 24h dépasse un pourcentage |
| `change_below` | Variation 24h descend sous un pourcentage |

### 2.2 Endpoints API

```
GET    /alerts              → Liste toutes les alertes
POST   /alerts              → Créer une alerte { assetId, type, threshold }
PUT    /alerts/:id/activate → Activer une alerte
PUT    /alerts/:id/deactivate → Désactiver une alerte
DELETE /alerts/:id          → Supprimer une alerte
```

### 2.3 Évaluation automatique

Le service `AlertService.evaluateAll()` est appelé par le scheduler après chaque collecte :

1. Récupère toutes les alertes actives
2. Pour chaque alerte, compare le prix/variation actuel au seuil
3. Si condition remplie :
   - Met à jour `lastTriggered`
   - Envoie une notification via `NotifierService`
   - Crée un `NotificationLog`

### 2.4 Notifications Discord

Le `NotifierService` envoie des webhooks Discord avec un message formaté :

```
🚨 Alerte déclenchée !
Bitcoin a dépassé 90000 USD
Prix actuel : 91,364 USD
```

## 3. Prévisions de Prix

### 3.1 Méthodes disponibles

| Méthode | Description |
|---------|-------------|
| `sma` | Simple Moving Average - moyenne mobile simple |
| `ema` | Exponential Moving Average - moyenne mobile exponentielle |
| `linear` | Régression linéaire - extrapolation de la tendance |

### 3.2 Endpoint API

```
GET /forecast?symbol=<symbol>&method=<method>&history=<n>&steps=<n>
```

**Paramètres :**
- `symbol` : crypto à analyser
- `method` : `sma`, `ema`, ou `linear`
- `history` : nombre de points historiques (défaut: 50)
- `steps` : nombre de points à prédire (défaut: 10)

**Réponse :**
```json
{
  "data": {
    "symbol": "bitcoin",
    "method": "ema",
    "historical": [{ "t": "...", "price": 91000 }, ...],
    "predicted": [{ "t": "...", "price": 91500 }, ...],
    "metrics": {
      "lastPrice": 91364,
      "predictedPrice": 92100,
      "predictedChange": 736,
      "predictedChangePct": 0.81
    }
  }
}
```

### 3.3 Algorithmes

**SMA (Simple Moving Average) :**
```
SMA = (P1 + P2 + ... + Pn) / n
```
Projection : dernière valeur SMA répétée.

**EMA (Exponential Moving Average) :**
```
EMA_t = α × P_t + (1 - α) × EMA_{t-1}
α = 2 / (n + 1)
```
Projection : extrapolation de la tendance EMA.

**Régression Linéaire :**
```
y = mx + b
m = Σ((x - x̄)(y - ȳ)) / Σ(x - x̄)²
b = ȳ - m × x̄
```
Projection : extension de la droite de régression.

## 4. Gestion de Portfolio

### 4.1 Concepts

- **Portfolio** : conteneur de positions (ex: "Mon Portfolio Crypto")
- **Position** : détention d'un actif (quantité + coût moyen)
- **Trade** : transaction d'achat ou de vente
- **PnL** : Profit and Loss (gains/pertes)

### 4.2 Endpoints API

```
GET    /portfolios                    → Liste des portfolios
POST   /portfolios                    → Créer un portfolio { name }
DELETE /portfolios/:id                → Supprimer un portfolio

GET    /portfolios/:id/positions      → Positions du portfolio
GET    /portfolios/:id/pnl            → Calcul PnL en temps réel
GET    /portfolios/:id/trades         → Historique des trades
POST   /portfolios/:id/trades         → Exécuter un trade
```

### 4.3 Calcul du PnL

Pour chaque position :

```
currentValue = quantity × currentPrice
totalCost = quantity × avgCost
unrealizedPnl = currentValue - totalCost
unrealizedPnlPct = (unrealizedPnl / totalCost) × 100
```

**Exemple :**
- Achat : 0.5 BTC à 80,000 USD → coût = 40,000 USD
- Prix actuel : 91,364 USD → valeur = 45,682 USD
- PnL : +5,682 USD (+14.2%)

### 4.4 Gestion des trades

Lors d'un **achat** :
1. Si position existante : mise à jour du coût moyen pondéré
2. Sinon : création d'une nouvelle position

Lors d'une **vente** :
1. Vérification du solde disponible
2. Réduction de la quantité
3. Si quantité = 0 : suppression de la position

## 5. Frontend : Nouveaux composants

### 5.1 Navigation par onglets

L'application utilise maintenant un système d'onglets :

| Onglet | Composant | Description |
|--------|-----------|-------------|
| Dashboard | `App.tsx` | Graphiques et contrôles |
| Forecast | `ForecastChart.tsx` | Prévisions de prix |
| Alerts | `AlertsPanel.tsx` | Gestion des alertes |
| Portfolio | `PortfolioPanel.tsx` | Gestion du portfolio |

### 5.2 AlertsPanel

Fonctionnalités :
- Liste des alertes avec statut (actif/inactif)
- Formulaire de création d'alerte
- Boutons activer/désactiver/supprimer
- Affichage de la dernière date de déclenchement

### 5.3 ForecastChart

Fonctionnalités :
- Sélection de la méthode de prévision
- Graphique avec zone historique et zone prédictive
- Affichage des métriques (prix prédit, variation)

### 5.4 PortfolioPanel

Fonctionnalités :
- Liste des portfolios
- Tableau des positions avec PnL en temps réel
- Formulaire d'exécution de trade (achat/vente)
- Historique des transactions

## 6. Types TypeScript (Frontend)

```typescript
// Alertes
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

// Prévisions
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

// Portfolio
export type Portfolio = { id: number; name: string; createdAt: string };
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
  executedAt: string;
  notes?: string;
};
export type PositionPnL = {
  id: number;
  assetId: number;
  symbol: string;
  quantity: number;
  avgCost: number;
  currentPrice: number;
  currentValue: number;
  unrealizedPnl: number;
  unrealizedPnlPct: number;
};
```

## 7. Fonctions API (Frontend)

```typescript
// Alertes
fetchAlerts(): Promise<Alert[]>
createAlert(assetId, type, threshold): Promise<Alert>
activateAlert(id): Promise<Alert>
deactivateAlert(id): Promise<Alert>
deleteAlert(id): Promise<void>

// Prévisions
fetchForecast(symbol, method, history, steps): Promise<Forecast>

// Portfolio
fetchPortfolios(): Promise<Portfolio[]>
createPortfolio(name): Promise<Portfolio>
deletePortfolio(id): Promise<void>
fetchPositions(portfolioId): Promise<Position[]>
fetchPortfolioPnL(portfolioId): Promise<PortfolioPnL>
fetchTrades(portfolioId, limit): Promise<Trade[]>
executeTrade(portfolioId, assetId, side, quantity, priceUsd, notes): Promise<Trade>
