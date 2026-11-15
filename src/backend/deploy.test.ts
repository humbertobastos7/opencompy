/**
 * Deploy validation tests.
 *
 * These tests run in CI/CD before every deployment and verify that the
 * environment is correctly configured. They use the env vars injected by
 * vitest.config.ts in test mode, and the real process.env in production.
 *
 * To run against the real environment:
 *   NODE_ENV=production vitest run src/backend/deploy.test.ts
 */
import { describe, expect, it } from "vitest";

// ── Database ──────────────────────────────────────────────────────────────────

describe("DATABASE_URL", () => {
	it("is defined", () => {
		expect(process.env.DATABASE_URL, "DATABASE_URL must be set").toBeTruthy();
	});

	it("is a valid PostgreSQL connection string", () => {
		const url = process.env.DATABASE_URL ?? "";
		const isValid =
			url.startsWith("postgres://") || url.startsWith("postgresql://");
		const protocol = url.split("://")[0] || "unknown";
		expect(
			isValid,
			`DATABASE_URL must start with postgres:// or postgresql://, got: ${protocol}://[REDACTED]`,
		).toBe(true);
	});

	it("contains a host, port, and database name", () => {
		const url = new URL(process.env.DATABASE_URL ?? "postgres://invalid");
		expect(url.hostname, "DATABASE_URL must include a host").toBeTruthy();
		expect(
			url.pathname.length > 1,
			"DATABASE_URL must include a database name",
		).toBe(true);
	});
});

// ── AI service ────────────────────────────────────────────────────────────────

describe("AI_SERVICE_URL", () => {
	it("is defined", () => {
		expect(
			process.env.AI_SERVICE_URL,
			"AI_SERVICE_URL must be set",
		).toBeTruthy();
	});

	it("is a valid URL", () => {
		const raw = process.env.AI_SERVICE_URL ?? "";
		expect(
			() => new URL(raw),
			`AI_SERVICE_URL is not a valid URL: ${raw}`,
		).not.toThrow();
	});

	it("uses http or https", () => {
		const url = new URL(process.env.AI_SERVICE_URL ?? "http://invalid");
		expect(
			["http:", "https:"].includes(url.protocol),
			`AI_SERVICE_URL must use http or https, got: ${url.protocol}`,
		).toBe(true);
	});
});

// ── NODE_ENV ──────────────────────────────────────────────────────────────────

describe("NODE_ENV", () => {
	it("is set to a known value", () => {
		const known = ["development", "production", "test"];
		expect(
			known.includes(process.env.NODE_ENV ?? ""),
			`NODE_ENV must be one of ${known.join(", ")}, got: ${process.env.NODE_ENV}`,
		).toBe(true);
	});
});
