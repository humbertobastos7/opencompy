import { existsSync, readFileSync } from "node:fs";
import type { PoolConfig } from "pg";

const RDS_CERT = "/etc/ssl/certs/rds-ca.pem";

// Parse DATABASE_URL manually so pg-connection-string never runs.
// That library calls readFileSync on the sslrootcert param at construction
// time, which fails when the URL has a malformed path value. Passing explicit
// PoolConfig fields bypasses this entirely — same pattern used in
// scripts/wait-for-db.mjs and drizzle.config.ts.
export function pgConfigFromUrl(databaseUrl: string): PoolConfig {
	const url = new URL(databaseUrl);
	const sslMode = url.searchParams.get("sslmode");

	let ssl: PoolConfig["ssl"];
	if (sslMode) {
		ssl = existsSync(RDS_CERT)
			? { ca: readFileSync(RDS_CERT).toString() }
			: { rejectUnauthorized: false };
	}

	return {
		host: url.hostname,
		port: url.port ? Number(url.port) : 5432,
		user: decodeURIComponent(url.username),
		password: decodeURIComponent(url.password),
		database: decodeURIComponent(url.pathname.replace(/^\//, "")),
		ssl,
	};
}
