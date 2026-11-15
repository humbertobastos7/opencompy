/**
 * Runs after drizzle-kit migrate to detect schema drift.
 * Parses ADD COLUMN statements in each migration file (minus columns and
 * tables dropped by later migrations) and verifies they exist in the database.
 * Safe in production — read-only, never modifies data.
 */
import pg from "pg";
import { readFileSync, readdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const drizzleDir = resolve(__dirname, "../drizzle");

const rawUrl = process.env.DATABASE_URL ?? "";
if (!rawUrl) {
	console.error("[validate-migrations] DATABASE_URL is not set");
	process.exit(1);
}

// Parse the URL manually so pg-connection-string never runs.
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

const client = new pg.Client(config);
await client.connect();

try {
	const sqlFiles = readdirSync(drizzleDir)
		.filter((f) => f.endsWith(".sql"))
		.sort();

	// Columns added by a migration and not removed by a later one. Processing
	// the files in order lets later DROP COLUMN / DROP TABLE statements cancel
	// earlier ADD COLUMN ones, so intentional removals are not reported as drift.
	const expected = new Map();

	for (const file of sqlFiles) {
		const sql = readFileSync(resolve(drizzleDir, file), "utf8");

		for (const [statement] of sql.matchAll(
			/ALTER TABLE "\w+" (?:ADD|DROP) COLUMN (?:IF (?:NOT )?EXISTS )?"\w+"|DROP TABLE (?:IF EXISTS )?"\w+"/gi,
		)) {
			const add = statement.match(
				/ALTER TABLE "(\w+)" ADD COLUMN (?:IF NOT EXISTS )?"(\w+)"/i,
			);
			const dropColumn = statement.match(
				/ALTER TABLE "(\w+)" DROP COLUMN (?:IF EXISTS )?"(\w+)"/i,
			);
			const dropTable = statement.match(/DROP TABLE (?:IF EXISTS )?"(\w+)"/i);

			if (add) {
				expected.set(`${add[1]}.${add[2]}`, {
					file,
					table: add[1],
					column: add[2],
				});
			} else if (dropColumn) {
				expected.delete(`${dropColumn[1]}.${dropColumn[2]}`);
			} else if (dropTable) {
				for (const key of [...expected.keys()]) {
					if (key.startsWith(`${dropTable[1]}.`)) expected.delete(key);
				}
			}
		}
	}

	const drift = [];

	for (const entry of expected.values()) {
		const { rows } = await client.query(
			`SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
			[entry.table, entry.column],
		);
		if (rows.length === 0) {
			drift.push(entry);
		}
	}

	if (drift.length === 0) {
		console.log("[validate-migrations] Schema is consistent with migrations.");
		process.exit(0);
	}

	console.error("\n[validate-migrations] SCHEMA DRIFT DETECTED!");
	console.error(
		"The migration tracking table thinks these changes were applied, but they are missing from the database:\n",
	);
	for (const { file, table, column } of drift) {
		console.error(`  • column "${column}" in table "${table}"  (${file})`);
	}
	console.error(
		"\nThis is usually caused by wrong timestamps in drizzle/meta/_journal.json.",
	);
	console.error(
		"Development fix:  docker compose down -v && docker compose up --build",
	);
	console.error(
		"Production fix:   connect to the DB and run the missing SQL from the files above.",
	);
	process.exit(1);
} finally {
	await client.end();
}
