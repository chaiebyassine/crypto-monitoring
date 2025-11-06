// Charge automatiquement les variables du fichier .env (PORT, DATABASE_URL, etc.)
import "dotenv/config";

/**
 * Regroupe toutes les variables de config au même endroit.
 * Avantage : si un nom change, on ne modifie qu'ici.
 */
export const env = {
  // Port HTTP de l'API (par défaut 3001)
  port: Number(process.env.PORT ?? 3001),

  // URL de la base (ici SQLite dans backend/prisma/dev.db)
  dbUrl: process.env.DATABASE_URL ?? "file:./prisma/dev.db",

  // Liste des cryptos à collecter (séparées par des virgules)
  coins: (process.env.COINS ?? "bitcoin,ethereum")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),

  // Fréquence de collecte en secondes (utilisée par le scheduler)
  intervalSeconds: Number(process.env.INTERVAL_SECONDS ?? 300),

  // Timeout HTTP en millisecondes pour les appels au fournisseur
  httpTimeout: Number(process.env.HTTP_TIMEOUT ?? 20000),

  // Nom du fournisseur de données (ici "coincap")
  provider: (process.env.PROVIDER ?? "coincap").toLowerCase(),
} as const;

