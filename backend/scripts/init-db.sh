#!/bin/bash
# ============================================
# PostgreSQL Init Script Wrapper
# GLA Crypto Tracker
# ============================================
# Ce script est utilisé comme entrypoint pour
# initialiser PostgreSQL dans Docker
# ============================================

set -e

# ============================================
# CONFIGURATION
# ============================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SQL_INIT_FILE="${SCRIPT_DIR}/init-db.sql"

# Couleurs pour les logs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ============================================
# FONCTIONS
# ============================================

log_info() {
    echo -e "${BLUE}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

# ============================================
# VÉRIFICATIONS
# ============================================

check_postgres() {
    log_info "Checking PostgreSQL connection..."
    
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if pg_isready -h "${POSTGRES_HOST:-localhost}" -p "${POSTGRES_PORT:-5432}" -U "${POSTGRES_USER:-postgres}" > /dev/null 2>&1; then
            log_success "PostgreSQL is ready!"
            return 0
        fi
        
        log_info "Waiting for PostgreSQL... (attempt $attempt/$max_attempts)"
        sleep 2
        attempt=$((attempt + 1))
    done
    
    log_error "PostgreSQL is not available after $max_attempts attempts"
    return 1
}

# ============================================
# INITIALISATION
# ============================================

init_database() {
    log_info "Starting database initialization..."
    
    # Variables de connexion
    local host="${POSTGRES_HOST:-localhost}"
    local port="${POSTGRES_PORT:-5432}"
    local user="${POSTGRES_USER:-postgres}"
    local db="${POSTGRES_DB:-crypto_db}"
    
    # Vérifier si le fichier SQL existe
    if [ ! -f "$SQL_INIT_FILE" ]; then
        log_warning "SQL init file not found: $SQL_INIT_FILE"
        log_info "Skipping SQL initialization"
        return 0
    fi
    
    # Exécuter le script SQL
    log_info "Executing init-db.sql..."
    
    if PGPASSWORD="${POSTGRES_PASSWORD}" psql -h "$host" -p "$port" -U "$user" -d "$db" -f "$SQL_INIT_FILE" > /dev/null 2>&1; then
        log_success "Database initialization completed!"
    else
        log_warning "Some initialization commands may have failed (this is normal on re-runs)"
    fi
}

create_database_if_not_exists() {
    local host="${POSTGRES_HOST:-localhost}"
    local port="${POSTGRES_PORT:-5432}"
    local user="${POSTGRES_USER:-postgres}"
    local db="${POSTGRES_DB:-crypto_db}"
    
    log_info "Checking if database '$db' exists..."
    
    # Vérifier si la base existe
    if PGPASSWORD="${POSTGRES_PASSWORD}" psql -h "$host" -p "$port" -U "$user" -lqt | cut -d \| -f 1 | grep -qw "$db"; then
        log_info "Database '$db' already exists"
    else
        log_info "Creating database '$db'..."
        PGPASSWORD="${POSTGRES_PASSWORD}" psql -h "$host" -p "$port" -U "$user" -c "CREATE DATABASE $db;" > /dev/null 2>&1
        log_success "Database '$db' created!"
    fi
}

# ============================================
# MAIN
# ============================================

main() {
    echo ""
    echo "============================================"
    echo "  GLA Crypto - Database Initialization"
    echo "============================================"
    echo ""
    
    # Vérifier la connexion PostgreSQL
    check_postgres || exit 1
    
    # Créer la base si elle n'existe pas
    create_database_if_not_exists
    
    # Initialiser la base
    init_database
    
    echo ""
    log_success "All initialization steps completed!"
    echo ""
}

# ============================================
# EXÉCUTION
# ============================================

# Mode d'exécution
case "${1:-}" in
    --check)
        check_postgres
        ;;
    --create-db)
        check_postgres && create_database_if_not_exists
        ;;
    --init-only)
        init_database
        ;;
    *)
        main
        ;;
esac
