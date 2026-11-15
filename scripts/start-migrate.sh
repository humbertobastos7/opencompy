#!/bin/sh
set -e

DB_URL_LEN=$(printf '%s' "${DATABASE_URL:-}" | wc -c)
echo "[migrator] DATABASE_URL length: $DB_URL_LEN"

if [ "$DB_URL_LEN" -eq 0 ]; then
  echo "[migrator] ERROR: DATABASE_URL is not set — aborting"
  exit 1
fi

echo "[migrator] Step 1: waiting for DB..."
node scripts/wait-for-db.mjs 2>&1
echo "[migrator] Step 2: running drizzle-kit migrate..."
pnpm exec drizzle-kit migrate 2>&1
echo "[migrator] Step 3: validating schema..."
node scripts/validate-migrations.mjs 2>&1
echo "[migrator] Done."
