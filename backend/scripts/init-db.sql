-- ============================================
-- PostgreSQL Init Script - GLA Crypto Tracker
-- ============================================
-- Ce script est exécuté automatiquement au premier
-- démarrage du conteneur PostgreSQL
-- ============================================

-- ============================================
-- 1. EXTENSIONS
-- ============================================

-- Extension pour les UUIDs (si besoin futur)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Extension pour les fonctions de cryptographie
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Extension pour la recherche full-text avancée
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================
-- 2. CONFIGURATION DE LA BASE
-- ============================================

-- Définir le timezone
SET timezone = 'UTC';

-- ============================================
-- 3. RÔLES ET PERMISSIONS (optionnel)
-- ============================================

-- Créer un rôle read-only pour les dashboards/monitoring
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'readonly') THEN
        CREATE ROLE readonly;
    END IF;
END
$$;

-- Permissions read-only sur le schéma public
GRANT USAGE ON SCHEMA public TO readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO readonly;

-- ============================================
-- 4. FONCTIONS UTILITAIRES
-- ============================================

-- Fonction pour mettre à jour automatiquement updatedAt
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Fonction pour calculer le pourcentage de changement
CREATE OR REPLACE FUNCTION calculate_price_change(
    old_price DECIMAL,
    new_price DECIMAL
) RETURNS DECIMAL AS $$
BEGIN
    IF old_price IS NULL OR old_price = 0 THEN
        RETURN 0;
    END IF;
    RETURN ROUND(((new_price - old_price) / old_price * 100)::numeric, 2);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Fonction pour formater les montants en devise
CREATE OR REPLACE FUNCTION format_currency(
    amount DECIMAL,
    currency VARCHAR DEFAULT 'USD'
) RETURNS VARCHAR AS $$
BEGIN
    RETURN CASE currency
        WHEN 'USD' THEN '$' || TO_CHAR(amount, 'FM999,999,999.00')
        WHEN 'EUR' THEN TO_CHAR(amount, 'FM999,999,999.00') || '€'
        ELSE TO_CHAR(amount, 'FM999,999,999.00') || ' ' || currency
    END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================
-- 5. INDEX POUR PERFORMANCES
-- ============================================

-- Note: Les index principaux sont créés par Prisma
-- Ici on ajoute des index supplémentaires pour les requêtes fréquentes

-- Index pour recherche de prix par date (si la table existe)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'Price') THEN
        CREATE INDEX IF NOT EXISTS idx_price_crypto_date 
        ON "Price" ("cryptoId", "timestamp" DESC);
        
        CREATE INDEX IF NOT EXISTS idx_price_timestamp 
        ON "Price" ("timestamp" DESC);
    END IF;
END
$$;

-- Index pour les alertes actives
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'Alert') THEN
        CREATE INDEX IF NOT EXISTS idx_alert_active 
        ON "Alert" ("isActive", "cryptoId");
    END IF;
END
$$;

-- Index pour le portfolio par utilisateur
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'Portfolio') THEN
        CREATE INDEX IF NOT EXISTS idx_portfolio_user 
        ON "Portfolio" ("userId");
    END IF;
END
$$;

-- ============================================
-- 6. VUES UTILES
-- ============================================

-- Vue pour le résumé du portfolio (sera créée après les migrations Prisma)
-- Cette vue n'est pas créée ici car les tables n'existent pas encore

-- ============================================
-- 7. CONFIGURATION DES STATISTIQUES
-- ============================================

-- Activer les statistiques étendues pour de meilleures performances
ALTER SYSTEM SET track_activities = on;
ALTER SYSTEM SET track_counts = on;

-- ============================================
-- 8. MESSAGE DE CONFIRMATION
-- ============================================

DO $$
BEGIN
    RAISE NOTICE '============================================';
    RAISE NOTICE 'GLA Crypto Database initialized successfully!';
    RAISE NOTICE 'Extensions: uuid-ossp, pgcrypto, pg_trgm';
    RAISE NOTICE 'Roles: readonly created';
    RAISE NOTICE 'Functions: update_updated_at_column, calculate_price_change, format_currency';
    RAISE NOTICE '============================================';
END
$$;
