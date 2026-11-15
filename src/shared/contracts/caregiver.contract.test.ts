import { describe, expect, it } from "vitest";
import {
	CaregiverDailyOverviewResponseSchema,
	CaregiverDashboardResponseSchema,
	CaregiverNoteResponseSchema,
	CaregiverSeniorActivityResponseSchema,
	CaregiverSeniorSummaryResponseSchema,
	CreateCaregiverNoteRequestSchema,
	UpdateCaregiverNoteRequestSchema,
	SeniorConversationCountResponseSchema,
} from "./caregiver";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const validSeniorBreakdown = {
	seniorId: "sen-1",
	fullName: "António Silva",
	nickname: "Toni",
	sessions: { successful: 2, cancelled: 1, failed: 0, abandoned: 0 },
	dominantEmotion: "positive" as const,
	sessionLogs: [],
};

const validDailyEntry = {
	date: "2026-03-30",
	totalConversations: 5,
	totalMinutes: 40,
	averageMinutes: 8,
	seniorsCount: 3,
	sessions: { successful: 3, cancelled: 1, failed: 0, abandoned: 1 },
	emotions: { positive: 2, neutral: 2, negative: 1, unknown: 0 },
	seniorBreakdown: [validSeniorBreakdown],
};

const validDashboardSenior = {
	seniorId: "sen-1",
	fullName: "António Silva",
	nickname: "Toni",
	photoDataUrl: null,
	institutionName: "Centro de Saúde",
	accessCode: "ABC1-DEF2-GHI3",
	conversationCount: 5,
	lastConversationAt: "2026-03-30T10:00:00.000Z",
};

// ── CreateCaregiverNoteRequestSchema ──────────────────────────────────────────

describe("CreateCaregiverNoteRequestSchema", () => {
	it("accepts valid content", () => {
		expect(() =>
			CreateCaregiverNoteRequestSchema.parse({
				content: "Estava bem-disposto hoje.",
			}),
		).not.toThrow();
	});

	it("accepts optional category and pinned state", () => {
		expect(() =>
			CreateCaregiverNoteRequestSchema.parse({
				content: "Prefere chá ao fim da tarde.",
				category: "Alimentação",
				pinned: true,
			}),
		).not.toThrow();
	});

	it("rejects empty content", () => {
		expect(() =>
			CreateCaregiverNoteRequestSchema.parse({ content: "" }),
		).toThrow();
	});

	it("rejects content over 2000 characters", () => {
		expect(() =>
			CreateCaregiverNoteRequestSchema.parse({ content: "a".repeat(2001) }),
		).toThrow();
	});

	it("accepts content at the 2000 character boundary", () => {
		expect(() =>
			CreateCaregiverNoteRequestSchema.parse({ content: "a".repeat(2000) }),
		).not.toThrow();
	});
});

// ── UpdateCaregiverNoteRequestSchema ──────────────────────────────────────────

describe("UpdateCaregiverNoteRequestSchema", () => {
	it("accepts content, category or pinned updates", () => {
		expect(() =>
			UpdateCaregiverNoteRequestSchema.parse({
				content: "Prefere ser chamada de Mimi.",
			}),
		).not.toThrow();
		expect(() =>
			UpdateCaregiverNoteRequestSchema.parse({ category: "Social" }),
		).not.toThrow();
		expect(() =>
			UpdateCaregiverNoteRequestSchema.parse({ pinned: true }),
		).not.toThrow();
	});

	it("rejects an empty update payload", () => {
		expect(() => UpdateCaregiverNoteRequestSchema.parse({})).toThrow();
	});
});

// ── CaregiverNoteResponseSchema ───────────────────────────────────────────────

describe("CaregiverNoteResponseSchema", () => {
	const valid = {
		id: "note-1",
		seniorId: "sen-1",
		caregiverId: "usr-caregiver-1",
		content: "Senior estava bem-disposto.",
		category: null,
		pinned: false,
		createdAt: "2026-03-30T10:00:00.000Z",
	};

	it("accepts a valid note response", () => {
		expect(() => CaregiverNoteResponseSchema.parse(valid)).not.toThrow();
	});

	it("rejects missing id", () => {
		const { id: _id, ...rest } = valid;
		expect(() => CaregiverNoteResponseSchema.parse(rest)).toThrow();
	});

	it("rejects missing createdAt", () => {
		const { createdAt: _c, ...rest } = valid;
		expect(() => CaregiverNoteResponseSchema.parse(rest)).toThrow();
	});
});

// ── CaregiverDashboardResponseSchema ─────────────────────────────────────────

describe("CaregiverDashboardResponseSchema", () => {
	const valid = {
		totalSeniors: 3,
		totalConversations: 12,
		seniors: [validDashboardSenior],
	};

	it("accepts a valid dashboard response", () => {
		expect(() => CaregiverDashboardResponseSchema.parse(valid)).not.toThrow();
	});

	it("accepts null for institutionName and accessCode", () => {
		const withNulls = {
			...valid,
			seniors: [
				{ ...validDashboardSenior, institutionName: null, accessCode: null },
			],
		};
		expect(() =>
			CaregiverDashboardResponseSchema.parse(withNulls),
		).not.toThrow();
	});

	it("accepts an empty seniors array", () => {
		expect(() =>
			CaregiverDashboardResponseSchema.parse({ ...valid, seniors: [] }),
		).not.toThrow();
	});

	it("rejects non-numeric totalSeniors", () => {
		expect(() =>
			CaregiverDashboardResponseSchema.parse({
				...valid,
				totalSeniors: "three",
			}),
		).toThrow();
	});
});

// ── CaregiverSeniorSummaryResponseSchema ──────────────────────────────────────

describe("CaregiverSeniorSummaryResponseSchema", () => {
	const valid = {
		seniorId: "sen-1",
		fullName: "António Silva",
		nickname: "Toni",
		conversationCount: 12,
		lastConversationAt: "2026-03-30T10:00:00.000Z",
		averageConversationDurationMinutes: 8,
		notesCount: 3,
	};

	it("accepts a valid summary response", () => {
		expect(() =>
			CaregiverSeniorSummaryResponseSchema.parse(valid),
		).not.toThrow();
	});

	it("accepts null for lastConversationAt", () => {
		const withNulls = {
			...valid,
			lastConversationAt: null,
		};
		expect(() =>
			CaregiverSeniorSummaryResponseSchema.parse(withNulls),
		).not.toThrow();
	});

	it("rejects missing notesCount", () => {
		const { notesCount: _n, ...rest } = valid;
		expect(() => CaregiverSeniorSummaryResponseSchema.parse(rest)).toThrow();
	});
});

// ── SeniorConversationCountResponseSchema ─────────────────────────────────────

describe("SeniorConversationCountResponseSchema", () => {
	it("accepts valid count response", () => {
		expect(() =>
			SeniorConversationCountResponseSchema.parse({
				seniorId: "sen-1",
				total: 5,
			}),
		).not.toThrow();
	});

	it("accepts zero total", () => {
		expect(() =>
			SeniorConversationCountResponseSchema.parse({
				seniorId: "sen-1",
				total: 0,
			}),
		).not.toThrow();
	});

	it("rejects missing total", () => {
		expect(() =>
			SeniorConversationCountResponseSchema.parse({ seniorId: "sen-1" }),
		).toThrow();
	});
});

// ── CaregiverSeniorActivityResponseSchema ─────────────────────────────────────

describe("CaregiverSeniorActivityResponseSchema", () => {
	const valid = {
		seniorId: "sen-1",
		items: [
			{
				type: "conversation",
				timestamp: "2026-03-30T10:00:00.000Z",
				title: "Conversation recorded",
				description: "Talked about family.",
				metadata: { conversationId: "conv-1" },
			},
		],
	};

	it("accepts a valid activity response", () => {
		expect(() =>
			CaregiverSeniorActivityResponseSchema.parse(valid),
		).not.toThrow();
	});

	it("accepts an empty items array", () => {
		expect(() =>
			CaregiverSeniorActivityResponseSchema.parse({
				seniorId: "sen-1",
				items: [],
			}),
		).not.toThrow();
	});

	it("rejects invalid type values", () => {
		const withBadType = {
			...valid,
			items: [{ ...valid.items[0], type: "unknown_type" }],
		};
		expect(() =>
			CaregiverSeniorActivityResponseSchema.parse(withBadType),
		).toThrow();
	});

	it("accepts all valid item types", () => {
		const types = ["conversation", "caregiver_note"] as const;
		for (const type of types) {
			expect(() =>
				CaregiverSeniorActivityResponseSchema.parse({
					seniorId: "sen-1",
					items: [{ ...valid.items[0], type }],
				}),
			).not.toThrow();
		}
	});
});

// ── CaregiverDailyOverviewResponseSchema ─────────────────────────────────────

describe("CaregiverDailyOverviewResponseSchema", () => {
	it("accepts a valid daily overview response", () => {
		expect(() =>
			CaregiverDailyOverviewResponseSchema.parse({
				entries: [validDailyEntry],
			}),
		).not.toThrow();
	});

	it("accepts an empty entries array", () => {
		expect(() =>
			CaregiverDailyOverviewResponseSchema.parse({ entries: [] }),
		).not.toThrow();
	});

	it("rejects invalid dominantEmotion values in seniorBreakdown", () => {
		const invalid = {
			entries: [
				{
					...validDailyEntry,
					seniorBreakdown: [
						{ ...validSeniorBreakdown, dominantEmotion: "confused" },
					],
				},
			],
		};
		expect(() => CaregiverDailyOverviewResponseSchema.parse(invalid)).toThrow();
	});

	it("rejects non-numeric emotion counts", () => {
		const invalid = {
			entries: [
				{
					...validDailyEntry,
					emotions: { positive: "many", neutral: 2, negative: 1, unknown: 0 },
				},
			],
		};
		expect(() => CaregiverDailyOverviewResponseSchema.parse(invalid)).toThrow();
	});

	it("rejects missing sessions fields", () => {
		const invalid = {
			entries: [
				{
					...validDailyEntry,
					sessions: { successful: 1 }, // missing cancelled and abandoned
				},
			],
		};
		expect(() => CaregiverDailyOverviewResponseSchema.parse(invalid)).toThrow();
	});
});
