import { existsSync, readFileSync } from "node:fs";
import { defineConfig } from "drizzle-kit";

// Parse the URL manually so pg-connection-string never runs.
// That library calls readFileSync on the sslrootcert param, which fails when
// the DATABASE_URL has a malformed path value. Passing explicit fields bypasses
// this entirely — same pattern used in scripts/wait-for-db.mjs.
const url = new URL(process.env.DATABASE_URL!);
const sslMode = url.searchParams.get("sslmode");

const RDS_CERT = "/etc/ssl/certs/rds-ca.pem";
const ssl = sslMode
	? existsSync(RDS_CERT)
		? { ca: readFileSync(RDS_CERT).toString() }
		: { rejectUnauthorized: false }
	: undefined;

export default defineConfig({
	schema: "./src/backend/database/schema/index.ts",
	out: "./drizzle",
	dialect: "postgresql",
	dbCredentials: {
		host: url.hostname,
		port: url.port ? Number(url.port) : 5432,
		user: decodeURIComponent(url.username),
		password: decodeURIComponent(url.password),
		database: decodeURIComponent(url.pathname.replace(/^\//, "")),
		ssl,
	},
	verbose: true,
	strict: true,
});
