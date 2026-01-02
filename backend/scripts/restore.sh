#!/bin/bash
# =============================================================================
# Script de Restauration PostgreSQL - GLA Crypto
# =============================================================================
# Ce script restaure une sauvegarde de la base de données PostgreSQL.
#
# Usage:
#   ./restore.sh backup_file.sql       # Restaurer un fichier spécifique
#   ./restore.sh --latest              # Restaurer le dernier backup
#   ./restore.sh --list                # Lister les backups disponibles
#
# =============================================================================

set -euo pipefail

# Configuration par défaut
DB_HOST="${POSTGRES_HOST:-localhost}"
DB_PORT="${POSTGRES_PORT:-5432}"
DB_NAME="${POSTGRES_DB:-gla_db}"
DB_USER="${POSTGRES_USER:-gla_user}"
DB_PASSWORD="${POSTGRES_PASSWORD:-}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"

# Couleurs pour les logs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

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

# Afficher l'aide
show_help() {
    cat << EOF
Usage: $0 [OPTIONS] [BACKUP_FILE]

Script de restauration PostgreSQL pour GLA Crypto.

Arguments:
    BACKUP_FILE            Fichier de backup à restaurer

Options:
    -h, --host HOST        Hôte PostgreSQL (défaut: localhost)
    -p, --port PORT        Port PostgreSQL (défaut: 5432)
    -d, --database DB      Nom de la base de données (défaut: gla_db)
    -u, --user USER        Utilisateur PostgreSQL (défaut: gla_user)
    -l, --latest           Restaurer le dernier backup
    --list                 Lister les backups disponibles
    --drop                 Supprimer et recréer la base avant restauration
    --help                 Afficher cette aide

Exemples:
    $0 backup.sql                          # Restaurer un fichier
    $0 --latest                            # Restaurer le dernier backup
    $0 --list                              # Lister les backups
    $0 --drop --latest                     # Drop DB et restaurer

EOF
    exit 0
}

# Lister les backups disponibles
list_backups() {
    echo "=============================================="
    echo "   Backups disponibles dans $BACKUP_DIR"
    echo "=============================================="
    echo ""

    if [[ ! -d "$BACKUP_DIR" ]]; then
        log_error "Répertoire de backup introuvable: $BACKUP_DIR"
        exit 1
    fi

    local count=0
    while IFS= read -r file; do
        if [[ -n "$file" ]]; then
            local size=$(du -h "$file" | cut -f1)
            local date=$(stat -c %y "$file" 2>/dev/null || stat -f %Sm "$file" 2>/dev/null)
            echo "  - $(basename "$file") ($size)"
            ((count++))
        fi
    done < <(ls -t "$BACKUP_DIR"/${DB_NAME}_*.sql* 2>/dev/null || true)

    echo ""
    if [[ $count -eq 0 ]]; then
        log_warning "Aucun backup trouvé"
    else
        log_info "$count backup(s) trouvé(s)"
    fi

    exit 0
}

# Trouver le dernier backup
get_latest_backup() {
    local latest=$(ls -t "$BACKUP_DIR"/${DB_NAME}_*.sql* 2>/dev/null | head -n1)
    if [[ -z "$latest" ]]; then
        log_error "Aucun backup trouvé dans $BACKUP_DIR"
        exit 1
    fi
    echo "$latest"
}

# Restaurer le backup
perform_restore() {
    local backup_file="$1"
    local drop_db="${2:-false}"

    # Vérifier que le fichier existe
    if [[ ! -f "$backup_file" ]]; then
        log_error "Fichier de backup introuvable: $backup_file"
        exit 1
    fi

    log_info "Fichier de backup: $backup_file"
    log_info "Base de données cible: $DB_NAME"

    # Confirmation
    echo ""
    log_warning "⚠️  ATTENTION: Cette opération va écraser les données existantes!"
    read -p "Êtes-vous sûr de vouloir continuer? (oui/non): " confirm
    if [[ "$confirm" != "oui" ]]; then
        log_info "Opération annulée"
        exit 0
    fi

    # Drop et recréer la base si demandé
    if [[ "$drop_db" == "true" ]]; then
        log_info "Suppression de la base de données existante..."
        PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres \
            -c "DROP DATABASE IF EXISTS $DB_NAME;" 2>/dev/null || true

        log_info "Création de la nouvelle base de données..."
        PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres \
            -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;" 2>/dev/null
    fi

    # Décompresser si nécessaire
    local restore_file="$backup_file"
    local temp_file=""
    if [[ "$backup_file" == *.gz ]]; then
        log_info "Décompression du backup..."
        temp_file=$(mktemp)
        gunzip -c "$backup_file" > "$temp_file"
        restore_file="$temp_file"
    fi

    # Effectuer la restauration
    log_info "Restauration en cours..."
    if PGPASSWORD="$DB_PASSWORD" psql \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USER" \
        -d "$DB_NAME" \
        -f "$restore_file" \
        --quiet 2>/dev/null; then

        log_success "Restauration terminée avec succès!"
    else
        log_error "Échec de la restauration!"
        [[ -n "$temp_file" ]] && rm -f "$temp_file"
        exit 1
    fi

    # Nettoyer le fichier temporaire
    [[ -n "$temp_file" ]] && rm -f "$temp_file"
}

# Point d'entrée principal
main() {
    local backup_file=""
    local use_latest="false"
    local drop_db="false"

    # Parser les arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--host)
                DB_HOST="$2"
                shift 2
                ;;
            -p|--port)
                DB_PORT="$2"
                shift 2
                ;;
            -d|--database)
                DB_NAME="$2"
                shift 2
                ;;
            -u|--user)
                DB_USER="$2"
                shift 2
                ;;
            -l|--latest)
                use_latest="true"
                shift
                ;;
            --list)
                list_backups
                ;;
            --drop)
                drop_db="true"
                shift
                ;;
            --help)
                show_help
                ;;
            -*)
                log_error "Option inconnue: $1"
                show_help
                ;;
            *)
                backup_file="$1"
                shift
                ;;
        esac
    done

    echo "=============================================="
    echo "   GLA Crypto - PostgreSQL Restore Script"
    echo "=============================================="
    echo ""

    # Déterminer le fichier à restaurer
    if [[ "$use_latest" == "true" ]]; then
        backup_file=$(get_latest_backup)
    fi

    if [[ -z "$backup_file" ]]; then
        log_error "Veuillez spécifier un fichier de backup ou utiliser --latest"
        echo ""
        show_help
    fi

    log_info "Configuration:"
    log_info "  - Host: $DB_HOST:$DB_PORT"
    log_info "  - Database: $DB_NAME"
    log_info "  - User: $DB_USER"
    log_info "  - Drop DB: $drop_db"
    echo ""

    perform_restore "$backup_file" "$drop_db"
}

main "$@"
