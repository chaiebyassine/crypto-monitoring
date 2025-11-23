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