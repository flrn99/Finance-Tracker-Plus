#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_FILE="backup.sql"
BACKUP_PATH="$SCRIPT_DIR/$BACKUP_FILE"
SUPABASE_HOST="aws-1-us-west-1.pooler.supabase.com"
SUPABASE_PORT="6543"
SUPABASE_DB="postgres"
SUPABASE_USER="postgres.eyoxjnuwcqxqzeryhkub"

echo "=== Supabase Migration Script ==="
echo ""

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL environment variable is not set."
  echo "       Make sure you are running this in the Replit environment where DATABASE_URL is configured."
  exit 1
fi

read -rsp "Enter your Supabase database password: " SUPABASE_PASSWORD
echo ""

if [ -z "$SUPABASE_PASSWORD" ]; then
  echo "ERROR: Password cannot be empty."
  exit 1
fi

SUPABASE_URL="postgresql://${SUPABASE_USER}@${SUPABASE_HOST}:${SUPABASE_PORT}/${SUPABASE_DB}"

echo ""
echo "Step 1/3: Exporting data from current database..."
echo "          (Using --clean --if-exists so this dump is safe to import more than once)"

if pg_dump "$DATABASE_URL" \
  --no-owner \
  --no-acl \
  --clean \
  --if-exists \
  --format=plain \
  --file="$BACKUP_PATH"; then
  echo "  SUCCESS: Data exported to $BACKUP_PATH"
else
  echo "  ERROR: pg_dump failed. Check that DATABASE_URL is correct and the database is reachable."
  exit 1
fi

echo ""
echo "  Uploading backup to cloud storage..."
set +e
UPLOAD_OUTPUT=$(pnpm --filter @workspace/scripts run upload-backup "$BACKUP_PATH" 2>&1)
UPLOAD_EXIT=$?
set -e
CLOUD_STORAGE_PATH=""
if [ $UPLOAD_EXIT -eq 0 ]; then
  CLOUD_STORAGE_PATH=$(echo "$UPLOAD_OUTPUT" | grep '^STORAGE_PATH=' | cut -d= -f2- || true)
  CLOUD_STORAGE_LINK=$(echo "$UPLOAD_OUTPUT" | grep '^STORAGE_LINK=' | cut -d= -f2- || true)
  if [ -n "$CLOUD_STORAGE_PATH" ]; then
    echo "  SUCCESS: Backup uploaded to cloud storage."
    echo "           Storage path: $CLOUD_STORAGE_PATH"
    if [ -n "$CLOUD_STORAGE_LINK" ]; then
      echo "           Storage link: $CLOUD_STORAGE_LINK"
    fi
  else
    echo "  ERROR: Upload reported success but returned no storage path."
    echo "         Upload output:"
    echo "$UPLOAD_OUTPUT" | sed 's/^/         /'
    echo "         The local backup ($BACKUP_PATH) has been kept."
    echo "         Resolve the storage issue and re-run this script before proceeding."
    exit 1
  fi
else
  echo "  ERROR: Cloud upload failed."
  echo "         Upload error output:"
  echo "$UPLOAD_OUTPUT" | sed 's/^/         /'
  echo "         The local backup ($BACKUP_PATH) has been kept."
  echo "         Resolve the storage issue and re-run this script before proceeding."
  exit 1
fi

echo ""
echo "Step 2/3: Importing data into Supabase..."
echo "          (Existing objects will be dropped and recreated — safe to re-run)"

if PGPASSWORD="$SUPABASE_PASSWORD" psql "$SUPABASE_URL" \
  --file="$BACKUP_PATH" \
  --set ON_ERROR_STOP=on \
  --quiet; then
  echo "  SUCCESS: Data imported into Supabase."
else
  echo "  ERROR: psql import failed."
  echo "         Check your password and make sure the Supabase project is active."
  echo "         The backup file ($BACKUP_PATH) is preserved — fix the issue and re-run this script."
  echo "         The cloud backup is also available at: $CLOUD_STORAGE_PATH"
  exit 1
fi

echo ""
echo "Step 3/3: Verifying connection to Supabase..."

if PGPASSWORD="$SUPABASE_PASSWORD" psql "$SUPABASE_URL" \
  --command="SELECT 'Connection OK' AS status;" \
  --tuples-only \
  --quiet; then
  echo "  SUCCESS: Supabase database is reachable."
else
  echo "  WARNING: Could not verify Supabase connection, but the import may have still succeeded."
fi

export SUPABASE_MIG_HOST="$SUPABASE_HOST"
export SUPABASE_MIG_PORT="$SUPABASE_PORT"
export SUPABASE_MIG_DB="$SUPABASE_DB"
export SUPABASE_MIG_USER="$SUPABASE_USER"
export SUPABASE_MIG_PASSWORD="$SUPABASE_PASSWORD"
pnpm --filter @workspace/scripts run finalize-migration

echo ""
echo "The local backup file ($BACKUP_PATH) has been kept as a convenience copy."
echo "A durable cloud copy was uploaded to: $CLOUD_STORAGE_PATH"
echo "Delete the local file once you are satisfied with the migration."
