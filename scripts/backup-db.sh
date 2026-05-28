#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DB_PATH="${ROOT_DIR}/data/feeding-tracker.db"
BACKUP_DIR="${ROOT_DIR}/backups"
TS="$(date +%Y%m%d-%H%M%S)"

mkdir -p "${BACKUP_DIR}"
if [[ ! -f "${DB_PATH}" ]]; then
  echo "Database not found at ${DB_PATH}" >&2
  exit 1
fi

cp "${DB_PATH}" "${BACKUP_DIR}/feeding-tracker-${TS}.db"
if [[ -f "${DB_PATH}-wal" ]]; then
  cp "${DB_PATH}-wal" "${BACKUP_DIR}/feeding-tracker-${TS}.db-wal"
fi
if [[ -f "${DB_PATH}-shm" ]]; then
  cp "${DB_PATH}-shm" "${BACKUP_DIR}/feeding-tracker-${TS}.db-shm"
fi

echo "Backup created in ${BACKUP_DIR}"