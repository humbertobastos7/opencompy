import { describe, expect, it } from "vitest";
import {
	EmotionalTrendResponseSchema,
	SeniorResponseSchema,
	SeniorSettingsResponseSchema,
	SeniorSettingsUpdateSchema,
} from "./seniors";

// ── SeniorResponseSchema ──────────────────────────────────────────────────────

describe("SeniorResponseSchema", () => {
	const validLikes = {
		football: [],
		music: ["fado", "jazz"],
		cinema: [],
		gastronomy: ["seafood"],
		hobbies: ["jardim"],
		others: {},
	};

	const valid = {
		id: "sen-1",
		fullName: "António Silva",
		email: "antonio@example.com",
		nickname: "Toni",
		birthDate: "1948-05-20",
		photoDataUrl: null,
		family: "Vive com a filha.",
		gender: "m",
		diagnoses: ["demência ligeira"],
		avoidTopics: ["hospital"],
		likes: validLikes,
		memories: [
			{
				id: "memory-1",
				content: "Gosta muito de falar sobre o jardim.",
				createdAt: "2026-04-22T14:20:00.000Z",
			},
		],
		accessCode: "ABC1-DEF2-GHI3",
	};

	it("accepts a valid senior response", () => {
		expect(() => SeniorResponseSchema.parse(valid)).not.toThrow();
	});

	it("accepts null accessCode", () => {
		expect(() =>
			SeniorResponseSchema.parse({ ...valid, accessCode: null }),
		).not.toThrow();
	});

	it("rejects missing fullName", () => {
		const { fullName: _f, ...rest } = valid;
		expect(() => SeniorResponseSchema.parse(rest)).toThrow();
	});

	it("rejects missing likes", () => {
		const { likes: _l, ...rest } = valid;
		expect(() => SeniorResponseSchema.parse(rest)).toThrow();
	});
});

// ── EmotionalTrendResponseSchema ──────────────────────────────────────────────

describe("EmotionalTrendResponseSchema", () => {
	const valid = {
		seniorId: "sen-1",
		entries: [
			{ date: "2026-03-30", emotionalTone: "positivo", conversationCount: 2 },
			{ date: "2026-03-29", emotionalTone: "neutro", conversationCount: 1 },
		],
		hasNegativeAlert: false,
	};

	it("accepts a valid trend response", () => {
		expect(() => EmotionalTrendResponseSchema.parse(valid)).not.toThrow();
	});

	it("accepts hasNegativeAlert = true", () => {
		expect(() =>
			EmotionalTrendResponseSchema.parse({ ...valid, hasNegativeAlert: true }),
		).not.toThrow();
	});

	it("accepts an empty entries array", () => {
		expect(() =>
			EmotionalTrendResponseSchema.parse({ ...valid, entries: [] }),
		).not.toThrow();
	});

	it("rejects missing hasNegativeAlert", () => {
		const { hasNegativeAlert: _h, ...rest } = valid;
		expect(() => EmotionalTrendResponseSchema.parse(rest)).toThrow();
	});

	it("rejects non-numeric conversationCount", () => {
		const invalid = {
			...valid,
			entries: [
				{
					date: "2026-03-30",
					emotionalTone: "positivo",
					conversationCount: "two",
				},
			],
		};
		expect(() => EmotionalTrendResponseSchema.parse(invalid)).toThrow();
	});
});

// ── SeniorSettingsResponseSchema ─────────────────────────────────────────────

describe("SeniorSettingsResponseSchema", () => {
	const valid = {
		id: "set-1",
		seniorId: "sen-1",
		silenceTimeoutMs: 1200,
		chatPersonality: "informal" as const,
		preferredLanguages: ["pt-PT"],
		preferredVoices: { "pt-PT": "calm" },
	};

	it("accepts valid settings", () => {
		expect(() => SeniorSettingsResponseSchema.parse(valid)).not.toThrow();
	});

	it("accepts formal chatPersonality", () => {
		expect(() =>
			SeniorSettingsResponseSchema.parse({
				...valid,
				chatPersonality: "formal",
			}),
		).not.toThrow();
	});

	it("rejects invalid chatPersonality value", () => {
		expect(() =>
			SeniorSettingsResponseSchema.parse({
				...valid,
				chatPersonality: "aggressive",
			}),
		).toThrow();
	});

	it("accepts optional voiceRateModifier", () => {
		expect(() =>
			SeniorSettingsResponseSchema.parse({
				...valid,
				voiceRateModifier: { "pt-PT": 0.9 },
			}),
		).not.toThrow();
	});
});

// ── SeniorSettingsUpdateSchema ────────────────────────────────────────────────

describe("SeniorSettingsUpdateSchema", () => {
	it("accepts an empty update (all fields optional)", () => {
		expect(() => SeniorSettingsUpdateSchema.parse({})).not.toThrow();
	});

	it("accepts a partial update with only silenceTimeoutMs", () => {
		expect(() =>
			SeniorSettingsUpdateSchema.parse({ silenceTimeoutMs: 2000 }),
		).not.toThrow();
	});

	it("rejects invalid chatPersonality", () => {
		expect(() =>
			SeniorSettingsUpdateSchema.parse({ chatPersonality: "chill" }),
		).toThrow();
	});
});
