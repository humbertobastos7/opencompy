import "reflect-metadata";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { pgConfigFromUrl } from "@/backend/database/pg-config";
import * as schema from "@/backend/database/schema";
import { ensureLocalUser } from "@/backend/modules/local-user/ensure-local-user";
import { env } from "@/env/backend";

/**
 * Bootstrap seed. Compy has no accounts, so the only record it needs is the
 * local user (created empty — the onboarding flow fills in the profile).
 * The backend also does this on startup; the seed exists for container
 * start scripts that run it explicitly.
 */
const pool = new pg.Pool(pgConfigFromUrl(env.DATABASE_URL));
const db = drizzle(pool, { schema });

ensureLocalUser(db)
	.then((userId) => {
		console.log(JSON.stringify({ seeded: true, localUserId: userId }, null, 2));
	})
	.catch((error) => {
		console.error("BOOTSTRAP_SEED_FAILED", error);
		process.exitCode = 1;
	})
	.finally(async () => {
		await pool.end();
	});
