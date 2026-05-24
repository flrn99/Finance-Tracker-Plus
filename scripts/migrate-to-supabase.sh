#!/usr/bin/env bash
set -euo pipefail

BACKUP_FILE="backup.sql"
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
  --file="$BACKUP_FILE"; then
  echo "  SUCCESS: Data exported to $BACKUP_FILE"
else
  echo "  ERROR: pg_dump failed. Check that DATABASE_URL is correct and the database is reachable."
  exit 1
fi

echo ""
echo "Step 2/3: Importing data into Supabase..."
echo "          (Existing objects will be dropped and recreated — safe to re-run)"

if PGPASSWORD="$SUPABASE_PASSWORD" psql "$SUPABASE_URL" \
  --file="$BACKUP_FILE" \
  --set ON_ERROR_STOP=on \
  --quiet; then
  echo "  SUCCESS: Data imported into Supabase."
else
  echo "  ERROR: psql import failed."
  echo "         Check your password and make sure the Supabase project is active."
  echo "         The backup file ($BACKUP_FILE) is preserved — fix the issue and re-run this script."
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

echo ""
echo "=== Migration complete! ==="
echo ""
echo "Next steps:"
echo "  1. Verify your data looks correct in the Supabase dashboard."
echo "  2. Update your DATABASE_URL secret in Replit to point to Supabase:"
echo "     postgresql://${SUPABASE_USER}:<password>@${SUPABASE_HOST}:${SUPABASE_PORT}/${SUPABASE_DB}"
echo "  3. Restart your API server to pick up the new DATABASE_URL."
echo ""
echo "The local backup file ($BACKUP_FILE) has been kept. Delete it once you are satisfied with the migration."
