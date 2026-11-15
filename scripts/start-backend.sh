#!/bin/sh
set -eu

node scripts/wait-for-db.mjs
pnpm exec drizzle-kit migrate
node scripts/validate-migrations.mjs
node dist/backend/seed.js
exec node dist/backend/main.js
