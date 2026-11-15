import { Injectable } from "@nestjs/common";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { env } from "@/env/backend";
import { pgConfigFromUrl } from "./pg-config";
import * as schema from "./schema";

const pool = new pg.Pool({
	...pgConfigFromUrl(env.DATABASE_URL),
	max: 20,
	min: 2,
	idleTimeoutMillis: 30_000,
	connectionTimeoutMillis: 5_000,
	statement_timeout: 30_000,
});

pool.on("error", (err) => {
	// Evita que um erro numa conexão idle derrube o processo inteiro
	console.error("[db-pool] Unexpected error on idle client:", err.message);
});

@Injectable()
export class DatabaseService {
	readonly db = drizzle(pool, { schema });
}

export type Database = DatabaseService["db"];
export { pool, schema };
