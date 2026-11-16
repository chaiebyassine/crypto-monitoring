#  Guide Utilisateur - CryptoTracker

> Application de suivi de portefeuille crypto avec alertes et prévisions

---

## Table des matières

1. [Introduction](#1-introduction)
2. [Premiers pas](#2-premiers-pas)
3. [Dashboard](#3-dashboard)
4. [Prévisions](#4-prévisions)
5. [Alertes](#5-alertes)
6. [Portfolio](#6-portfolio)
7. [Administration](#7-administration)
8. [FAQ](#8-faq)

---

## 1. Introduction

### 1.1 Qu'est-ce que CryptoTracker ?

CryptoTracker est une application web complète de suivi de crypto-monnaies qui vous permet de :

-  **Visualiser** les cours en temps réel avec graphiques interactifs
- **Prévoir** l'évolution des prix avec différents algorithmes
- **Créer des alertes** personnalisées sur les prix
- **Gérer votre portfolio** et suivre vos gains/pertes

### 1.2 Fonctionnalités principales

| Fonctionnalité | Description |
|----------------|-------------|
| Dashboard | Graphiques en temps réel, courbes et chandeliers |
| Prévisions | Algorithmes SMA, EMA et régression linéaire |
| Alertes | Notifications quand un seuil est atteint |
| Portfolio | Suivi des positions et calcul du PnL |

---

## 2. Premiers pas

### 2.1 Création de compte

1. Accédez à l'application via votre navigateur
2. Cliquez sur **"S'inscrire"**
3. Remplissez le formulaire :
   - **Email** : votre adresse email valide
   - **Mot de passe** : minimum 6 caractères
   - **Nom** (optionnel) : votre nom d'affichage
4. Cliquez sur **"Créer mon compte"**

### 2.2 Connexion

1. Entrez votre **email** et **mot de passe**
2. Cliquez sur **"Se connecter"**
3. Vous serez redirigé vers le Dashboard

### 2.3 Modification du mot de passe

1. Connectez-vous à votre compte
2. Accédez aux paramètres du profil
3. Entrez votre mot de passe actuel
4. Entrez et confirmez votre nouveau mot de passe
5. Cliquez sur **"Mettre à jour"**

---

## 3. Dashboard

Le Dashboard est la page principale de l'application où vous pouvez visualiser les cours des crypto-monnaies.

### 3.1 Sélection d'un actif

1. Utilisez le menu déroulant **"Crypto principale"**
2. Sélectionnez la crypto-monnaie souhaitée (Bitcoin, Ethereum, etc.)
3. Le graphique se met à jour automatiquement

### 3.2 Comparaison de deux actifs

Pour comparer deux crypto-monnaies :

1. Sélectionnez votre crypto principale
2. Dans le menu **"Comparer avec"**, choisissez une seconde crypto
3. Les deux courbes s'affichent sur le même graphique
4. Activez le mode **"Normaliser"** pour comparer les variations en %

### 3.3 Période d'affichage

Choisissez le nombre de points de données à afficher :

| Option | Description |
|--------|-------------|
| 20 | Vue courte - dernières heures |
| 50 | Vue moyenne (par défaut) |
| 100 | Vue étendue |
| 200 | Vue longue - plusieurs jours |

### 3.4 Indicateurs techniques

#### SMA (Simple Moving Average)
- Cochez **"Afficher SMA"**
- Ajustez la fenêtre (ex: 10 points)
- La moyenne mobile simple apparaît sur le graphique

#### EMA (Exponential Moving Average)
- Cochez **"Afficher EMA"**
- Ajustez la fenêtre (ex: 20 points)
- La moyenne mobile exponentielle apparaît sur le graphique

### 3.5 Mode d'affichage

L'application propose deux types de graphiques :

#### Mode Courbe (Ligne)
- Affichage classique en ligne continue
- Idéal pour visualiser les tendances générales

#### Mode Chandeliers (OHLC)
- Affichage en bougies japonaises
- Montre : Ouverture, Plus haut, Plus bas, Clôture
- **Vert** : cours en hausse (clôture > ouverture)
- **Rouge** : cours en baisse (clôture < ouverture)

### 3.6 Informations affichées

Le Dashboard affiche également :

- **Dernier prix** : prix actuel de l'actif sélectionné
- **Date de mise à jour** : horodatage de la dernière donnée
- **Variation** : pourcentage de changement sur la période
- **Badge coloré** : vert (hausse) ou rouge (baisse)

---

## 4. Prévisions

L'onglet Prévisions vous permet d'obtenir des estimations sur l'évolution future des prix.

### 4.1 Accéder aux prévisions

1. Cliquez sur l'onglet **"Forecast"** (Prévisions)
2. Sélectionnez une crypto-monnaie
3. Choisissez une méthode de prévision

### 4.2 Méthodes disponibles

#### SMA (Simple Moving Average)
- **Principe** : Moyenne des N derniers prix
- **Utilisation** : Tendances à court terme
- **Recommandé pour** : Marchés stables

#### EMA (Exponential Moving Average)
- **Principe** : Moyenne pondérée donnant plus de poids aux prix récents
- **Utilisation** : Réactivité aux changements récents
- **Recommandé pour** : Marchés volatils

#### Régression Linéaire
- **Principe** : Extrapolation de la tendance actuelle
- **Utilisation** : Projection sur plusieurs points
- **Recommandé pour** : Identifier les tendances de fond

### 4.3 Paramètres de prévision

| Paramètre | Description | Valeur par défaut |
|-----------|-------------|-------------------|
| History | Nombre de points historiques | 50 |
| Steps | Nombre de points à prédire | 10 |

### 4.4 Lecture du graphique

- **Zone grise** : Données historiques (réelles)
- **Zone colorée** : Prévisions (estimées)
- **Métriques affichées** :
  - Prix prédit
  - Variation prédite (en USD et %)

>  **Attention** : Les prévisions sont des estimations basées sur des modèles mathématiques. Elles ne garantissent pas l'évolution future des prix.

---

## 5. Alertes

Le système d'alertes vous notifie quand un actif atteint un seuil défini.

### 5.1 Types d'alertes

| Type | Description | Exemple |
|------|-------------|---------|
| Prix supérieur | Notification si prix > seuil | BTC > 100,000 USD |
| Prix inférieur | Notification si prix < seuil | ETH < 3,000 USD |
| Variation supérieure | Notification si var 24h > seuil | BTC var > +10% |
| Variation inférieure | Notification si var 24h < seuil | ETH var < -5% |

### 5.2 Créer une alerte

1. Accédez à l'onglet **"Alerts"**
2. Cliquez sur **"Nouvelle alerte"**
3. Remplissez le formulaire :
   - **Actif** : Sélectionnez la crypto-monnaie
   - **Type** : Choisissez le type d'alerte
   - **Seuil** : Entrez la valeur de déclenchement
4. Cliquez sur **"Créer"**

### 5.3 Gérer vos alertes

#### Liste des alertes
- Visualisez toutes vos alertes avec leur statut
- **Actif** (vert) : l'alerte surveille le marché
- **Inactif** (gris) : l'alerte est en pause

#### Activer/Désactiver
- Cliquez sur le bouton d'activation pour basculer l'état
- Une alerte désactivée ne déclenchera pas de notification

#### Supprimer
- Cliquez sur l'icône de suppression
- Confirmez la suppression

### 5.4 Notifications

Quand une alerte est déclenchée :

1. L'alerte est marquée avec la date de déclenchement
2. Une notification est envoyée (Discord webhook si configuré)
3. Un log est créé pour l'historique

---

## 6. Portfolio

L'onglet Portfolio vous permet de gérer vos investissements crypto.

### 6.1 Créer un portfolio

1. Accédez à l'onglet **"Portfolio"**
2. Cliquez sur **"Nouveau portfolio"**
3. Entrez un nom (ex: "Mon Portfolio Principal")
4. Cliquez sur **"Créer"**

### 6.2 Exécuter un trade

#### Achat
1. Sélectionnez votre portfolio
2. Cliquez sur **"Acheter"**
3. Remplissez :
   - **Actif** : crypto à acheter
   - **Quantité** : nombre d'unités
   - **Prix** : prix d'achat en USD
   - **Notes** (optionnel) : commentaire
4. Cliquez sur **"Exécuter"**

#### Vente
1. Sélectionnez votre portfolio
2. Cliquez sur **"Vendre"**
3. Remplissez les mêmes informations
4. La vente ne peut pas dépasser la quantité détenue

### 6.3 Comprendre vos positions

Pour chaque position affichée :

| Colonne | Description |
|---------|-------------|
| Actif | Nom de la crypto-monnaie |
| Quantité | Nombre d'unités détenues |
| Coût moyen | Prix d'achat moyen par unité |
| Prix actuel | Cours actuel du marché |
| Valeur | Quantité × Prix actuel |
| PnL | Gains/Pertes en USD |
| PnL % | Gains/Pertes en pourcentage |

### 6.4 Calcul du PnL (Profit & Loss)

Le PnL est calculé automatiquement :

```
Valeur actuelle = Quantité × Prix actuel
Coût total = Quantité × Coût moyen
PnL = Valeur actuelle - Coût total
PnL % = (PnL / Coût total) × 100
```

**Exemple** :
- Achat : 0.5 BTC à 80,000 USD → Coût = 40,000 USD
- Prix actuel : 95,000 USD → Valeur = 47,500 USD
- **PnL = +7,500 USD (+18.75%)**

### 6.5 Historique des trades

- Visualisez toutes vos transactions passées
- Filtrez par date ou par actif
- Exportez l'historique si nécessaire

---

## 7. Administration

>  Cette section est réservée aux utilisateurs avec le rôle **ADMIN**

### 7.1 Accès

Si vous êtes administrateur, l'onglet **"Admin"** apparaît dans la navigation.

### 7.2 Statistiques globales

Le tableau de bord admin affiche :

- Nombre total d'utilisateurs
- Nombre total d'alertes
- Nombre total de portfolios
- Statistiques de collecte de données

### 7.3 Gestion des utilisateurs

#### Liste des utilisateurs
- Recherche par email ou nom
- Filtrage par rôle (USER/ADMIN)
- Pagination des résultats

#### Actions disponibles
- **Voir** : Détails d'un utilisateur
- **Modifier** : Changer le rôle ou les informations
- **Supprimer** : Supprimer un compte utilisateur

---

## 8. FAQ

### Questions générales

**Q: À quelle fréquence les prix sont-ils mis à jour ?**
> Les prix sont collectés toutes les 5 minutes depuis CoinGecko.

**Q: Combien de crypto-monnaies sont suivies ?**
> L'application suit les principales crypto-monnaies (BTC, ETH, etc.) configurées par l'administrateur.

**Q: Mes données sont-elles sécurisées ?**
> Oui, les mots de passe sont hashés avec bcrypt et l'authentification utilise des tokens JWT.

### Alertes

**Q: Comment sont envoyées les notifications ?**
> Les notifications sont envoyées via Discord webhook. Contactez l'administrateur pour configurer votre canal.

**Q: Pourquoi mon alerte ne se déclenche pas ?**
> Vérifiez que l'alerte est bien active et que le seuil correspond à vos attentes.

### Portfolio

**Q: Comment est calculé le coût moyen ?**
> Le coût moyen est calculé comme la moyenne pondérée de tous vos achats.

**Q: Puis-je avoir plusieurs portfolios ?**
> Oui, vous pouvez créer autant de portfolios que nécessaire pour organiser vos investissements.

### Technique

**Q: Quelle est la différence entre SMA et EMA ?**
> - **SMA** : Moyenne simple, tous les points ont le même poids
> - **EMA** : Moyenne exponentielle, les points récents ont plus de poids

**Q: Les prévisions sont-elles fiables ?**
> Les prévisions sont des outils d'aide à la décision basés sur des modèles mathématiques. Elles ne garantissent pas l'évolution future des prix.

---

## Support

Pour toute question ou problème :

- Contactez l'administrateur de la plateforme
- Consultez la documentation technique
- Signalez les bugs via le système de tickets

---

*Guide utilisateur v1.0 - CryptoTracker*
