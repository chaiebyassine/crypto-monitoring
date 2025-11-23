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
 
