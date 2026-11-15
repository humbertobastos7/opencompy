import pg from "pg";

const rawUrl = process.env.DATABASE_URL;
if (!rawUrl) {
	console.error("[wait-for-db] DATABASE_URL is not set");
	process.exit(1);
}

// Parse the URL manually so pg-connection-string never runs.
// That library calls readFileSync on the sslrootcert param at construction
// time, which fails when the secret has a malformed path. Passing explicit
// connection fields instead of connectionString bypasses this entirely.
const url = new URL(rawUrl);
const sslMode = url.searchParams.get("sslmode");
const config = {
	host: url.hostname,
	port: url.port ? Number(url.port) : 5432,
	user: decodeURIComponent(url.username),
	password: decodeURIComponent(url.password),
	database: decodeURIComponent(url.pathname.replace(/^\//, "")),
	...(sslMode ? { ssl: { rejectUnauthorized: false } } : {}),
};

const timeoutMs = Number(process.env.DB_WAIT_TIMEOUT_MS ?? 60000);
const intervalMs = Number(process.env.DB_WAIT_INTERVAL_MS ?? 2000);
const startedAt = Date.now();

for (;;) {
	const client = new pg.Client(config);

	try {
		await client.connect();
		await client.query("select 1");
		await client.end();
		console.log("DATABASE_READY");
		process.exit(0);
	} catch (error) {
		await client.end().catch(() => undefined);
		if (Date.now() - startedAt >= timeoutMs) {
			console.error("DATABASE_WAIT_TIMEOUT", error);
			process.exit(1);
		}
		console.log("WAITING_FOR_DATABASE");
		await new Promise((resolve) => setTimeout(resolve, intervalMs));
	}
}
