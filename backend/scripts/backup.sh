#!/bin/bash
# =============================================================================
# Script de Backup PostgreSQL - GLA Crypto
# =============================================================================
# Ce script effectue une sauvegarde de la base de données PostgreSQL
# avec rotation automatique des anciens backups.
#
# Usage:
#   ./backup.sh                    # Backup avec paramètres par défaut
#   ./backup.sh -d mon_db          # Spécifier la base de données
#   ./backup.sh -r 7               # Garder les 7 derniers backups
#   ./backup.sh --compress         # Compresser le backup avec gzip
#
# =============================================================================

set -euo pipefail

# Configuration par défaut (peut être surchargée par variables d'environnement)
DB_HOST="${POSTGRES_HOST:-localhost}"
DB_PORT="${POSTGRES_PORT:-5432}"
DB_NAME="${POSTGRES_DB:-gla_db}"
DB_USER="${POSTGRES_USER:-gla_user}"
DB_PASSWORD="${POSTGRES_PASSWORD:-}"

# Répertoire de backup
BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
COMPRESS="${COMPRESS:-false}"

# Couleurs pour les logs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Fonctions de logging
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
Usage: $0 [OPTIONS]

Script de backup PostgreSQL pour GLA Crypto.

Options:
    -h, --host HOST        Hôte PostgreSQL (défaut: localhost)
    -p, --port PORT        Port PostgreSQL (défaut: 5432)
    -d, --database DB      Nom de la base de données (défaut: gla_db)
    -u, --user USER        Utilisateur PostgreSQL (défaut: gla_user)
    -o, --output DIR       Répertoire de sortie (défaut: ./backups)
    -r, --retention DAYS   Jours de rétention (défaut: 7)
    -c, --compress         Compresser le backup avec gzip
    --help                 Afficher cette aide

Variables d'environnement:
    POSTGRES_HOST          Hôte PostgreSQL
    POSTGRES_PORT          Port PostgreSQL
    POSTGRES_DB            Nom de la base de données
    POSTGRES_USER          Utilisateur PostgreSQL
    POSTGRES_PASSWORD      Mot de passe PostgreSQL
    BACKUP_DIR             Répertoire de backup
    RETENTION_DAYS         Jours de rétention

Exemples:
    $0                                    # Backup avec paramètres par défaut
    $0 -d production_db -c                # Backup compressé de production_db
    $0 -r 30 --compress                   # Garder 30 jours avec compression
    POSTGRES_PASSWORD=secret $0           # Utiliser mot de passe via env

EOF
    exit 0
}

# Parser les arguments
parse_args() {
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
            -o|--output)
                BACKUP_DIR="$2"
                shift 2
                ;;
            -r|--retention)
                RETENTION_DAYS="$2"
                shift 2
                ;;
            -c|--compress)
                COMPRESS="true"
                shift
                ;;
            --help)
                show_help
                ;;
            *)
                log_error "Option inconnue: $1"
                show_help
                ;;
        esac
    done
}

# Vérifier les prérequis
check_prerequisites() {
    log_info "Vérification des prérequis..."

    # Vérifier que pg_dump est installé
    if ! command -v pg_dump &> /dev/null; then
        log_error "pg_dump n'est pas installé. Installez postgresql-client."
        exit 1
    fi

    # Vérifier que le répertoire de backup existe
    if [[ ! -d "$BACKUP_DIR" ]]; then
        log_info "Création du répertoire de backup: $BACKUP_DIR"
        mkdir -p "$BACKUP_DIR"
    fi

    # Vérifier la connexion à la base de données
    log_info "Test de connexion à PostgreSQL..."
    if ! PGPASSWORD="$DB_PASSWORD" pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" &> /dev/null; then
        log_error "Impossible de se connecter à PostgreSQL sur $DB_HOST:$DB_PORT"
        exit 1
    fi

    log_success "Prérequis validés"
}

# Effectuer le backup
perform_backup() {
    local timestamp=$(date '+%Y%m%d_%H%M%S')
    local backup_file="${BACKUP_DIR}/${DB_NAME}_${timestamp}.sql"

    log_info "Démarrage du backup de la base '$DB_NAME'..."
    log_info "Fichier de destination: $backup_file"

    # Effectuer le dump
    if PGPASSWORD="$DB_PASSWORD" pg_dump \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USER" \
        -d "$DB_NAME" \
        -F p \
        --no-owner \
        --no-privileges \
        -f "$backup_file" 2>/dev/null; then

        # Compresser si demandé
        if [[ "$COMPRESS" == "true" ]]; then
            log_info "Compression du backup..."
            gzip "$backup_file"
            backup_file="${backup_file}.gz"
        fi

        # Calculer la taille
        local size=$(du -h "$backup_file" | cut -f1)
        log_success "Backup terminé: $backup_file ($size)"

        echo "$backup_file"
    else
        log_error "Échec du backup!"
        exit 1
    fi
}

# Nettoyer les anciens backups
cleanup_old_backups() {
    log_info "Nettoyage des backups de plus de $RETENTION_DAYS jours..."

    local count=0
    while IFS= read -r -d '' file; do
        log_info "Suppression: $file"
        rm -f "$file"
        ((count++))
    done < <(find "$BACKUP_DIR" -name "${DB_NAME}_*.sql*" -type f -mtime +$RETENTION_DAYS -print0 2>/dev/null)

    if [[ $count -gt 0 ]]; then
        log_success "$count ancien(s) backup(s) supprimé(s)"
    else
        log_info "Aucun ancien backup à supprimer"
    fi
}

# Lister les backups existants
list_backups() {
    log_info "Backups existants dans $BACKUP_DIR:"
    echo ""
    if ls -la "$BACKUP_DIR"/${DB_NAME}_*.sql* 2>/dev/null; then
        echo ""
        local total_size=$(du -sh "$BACKUP_DIR" 2>/dev/null | cut -f1)
        log_info "Taille totale: $total_size"
    else
        log_warning "Aucun backup trouvé"
    fi
}

# Point d'entrée principal
main() {
    echo "=============================================="
    echo "   GLA Crypto - PostgreSQL Backup Script"
    echo "=============================================="
    echo ""

    parse_args "$@"

    log_info "Configuration:"
    log_info "  - Host: $DB_HOST:$DB_PORT"
    log_info "  - Database: $DB_NAME"
    log_info "  - User: $DB_USER"
    log_info "  - Backup dir: $BACKUP_DIR"
    log_info "  - Retention: $RETENTION_DAYS jours"
    log_info "  - Compression: $COMPRESS"
    echo ""

    check_prerequisites
    perform_backup
    cleanup_old_backups
    echo ""
    list_backups

    echo ""
    log_success "Opération terminée avec succès!"
}

# Exécuter le script
main "$@"
