import { describe, expect, it, vi } from "vitest";
import { ForbiddenException } from "@nestjs/common";
import { SeniorsService } from "./seniors.service";

// ── Factories ─────────────────────────────────────────────────────────────────

function makeSession(role: "caregiver" | "senior" | "admin" = "caregiver") {
	return { user: { id: "usr-1", role, isActive: true } } as never;
}

function makeConv(overrides: Record<string, unknown> = {}) {
	return {
		id: "conv-1",
		seniorId: "sen-1",
		createdAt: new Date("2026-03-30T10:00:00Z"),
		closedAt: new Date("2026-03-30T10:08:00Z"),
		summary: "Talked about family",
		emotionalTone: "positivo",
		...overrides,
	};
}

function makeRepo(overrides: Record<string, unknown> = {}) {
	return {
		findSeniorProfile: vi.fn().mockResolvedValue({ userId: "sen-1" }),
		findUserOrganization: vi
			.fn()
			.mockResolvedValue({ organizationId: "org-1" }),
		findUser: vi.fn().mockResolvedValue({
			id: "usr-1",
			organizationId: "org-1",
			isActive: true,
		}),
		findUsersByLocation: vi.fn().mockResolvedValue([]),
		findSeniorLikes: vi.fn().mockResolvedValue(null),
		findRecentConversations: vi.fn().mockResolvedValue([]),
		findConversationsForDate: vi.fn().mockResolvedValue([]),
		findSessionLogsForDate: vi.fn().mockResolvedValue([]),
		findConversationDatesForSeniors: vi.fn().mockResolvedValue([]),
		findSessionLogDatesForSeniors: vi.fn().mockResolvedValue([]),
		upsertSeniorLikes: vi.fn().mockResolvedValue(undefined),
		updateSeniorNickname: vi.fn().mockResolvedValue(undefined),
		ensureSeniorSettings: vi.fn().mockResolvedValue({
			id: "set-1",
			seniorId: "sen-1",
			voiceRateModifier: null,
			silenceTimeoutMs: 1200,
			chatPersonality: "informal",
			preferredLanguages: ["pt-PT"],
			preferredVoices: {},
		}),
		updateSeniorSettings: vi.fn().mockResolvedValue(undefined),
		...overrides,
	};
}

function makePolicy(overrides: Record<string, unknown> = {}) {
	return {
		assertSeniorAccess: vi.fn().mockResolvedValue({ userId: "sen-1" }),
		...overrides,
	};
}

function makeService(
	repoOverrides: Record<string, unknown> = {},
	policyOverrides: Record<string, unknown> = {},
) {
	return new SeniorsService(
		makeRepo(repoOverrides) as never,
		makePolicy(policyOverrides) as never,
		{ invalidateContext: vi.fn() } as never,
	);
}

// ── getEmotionalTrend ─────────────────────────────────────────────────────────

describe("SeniorsService.getEmotionalTrend", () => {
	it("returns empty entries when senior has no conversations", async () => {
		const svc = makeService();
		const result = await svc.getEmotionalTrend(makeSession(), "sen-1");
		expect(result.entries).toHaveLength(0);
		expect(result.hasNegativeAlert).toBe(false);
	});

	it("groups conversations by date ordered oldest to newest", async () => {
		const svc = makeService({
			findRecentConversations: vi
				.fn()
				.mockResolvedValue([
					makeConv({ id: "c1", createdAt: new Date("2026-03-30T10:00:00Z") }),
					makeConv({ id: "c2", createdAt: new Date("2026-03-29T10:00:00Z") }),
				]),
		});
		const result = await svc.getEmotionalTrend(makeSession(), "sen-1");
		expect(result.entries[0]?.date).toBe("2026-03-29");
		expect(result.entries[1]?.date).toBe("2026-03-30");
	});

	it("counts conversations per day correctly", async () => {
		const svc = makeService({
			findRecentConversations: vi
				.fn()
				.mockResolvedValue([
					makeConv({ id: "c1", createdAt: new Date("2026-03-30T09:00:00Z") }),
					makeConv({ id: "c2", createdAt: new Date("2026-03-30T11:00:00Z") }),
					makeConv({ id: "c3", createdAt: new Date("2026-03-29T10:00:00Z") }),
				]),
		});
		const result = await svc.getEmotionalTrend(makeSession(), "sen-1");
		const march30 = result.entries.find((e) => e.date === "2026-03-30");
		expect(march30?.conversationCount).toBe(2);
	});

	it("picks the most negative tone for the day when mixed tones exist", async () => {
		// findRecentConversations returns DESC (most recent first); method reverses for grouping
		const svc = makeService({
			findRecentConversations: vi.fn().mockResolvedValue([
				makeConv({
					id: "c2",
					createdAt: new Date("2026-03-30T11:00:00Z"),
					emotionalTone: "positivo",
				}),
				makeConv({
					id: "c1",
					createdAt: new Date("2026-03-30T09:00:00Z"),
					emotionalTone: "negativo",
				}),
			]),
		});
		const result = await svc.getEmotionalTrend(makeSession(), "sen-1");
		// negativo is in NEGATIVE_TONES, so it takes priority
		expect(result.entries[0]?.emotionalTone).toBe("negativo");
	});

	it("triggers hasNegativeAlert when the last 3 conversations are all negative", async () => {
		const svc = makeService({
			findRecentConversations: vi
				.fn()
				.mockResolvedValue([
					makeConv({ id: "c1", emotionalTone: "negativo" }),
					makeConv({ id: "c2", emotionalTone: "triste" }),
					makeConv({ id: "c3", emotionalTone: "ansioso" }),
				]),
		});
		const result = await svc.getEmotionalTrend(makeSession(), "sen-1");
		expect(result.hasNegativeAlert).toBe(true);
	});

	it("does not trigger hasNegativeAlert when fewer than 3 conversations", async () => {
		const svc = makeService({
			findRecentConversations: vi
				.fn()
				.mockResolvedValue([
					makeConv({ id: "c1", emotionalTone: "negativo" }),
					makeConv({ id: "c2", emotionalTone: "negativo" }),
				]),
		});
		const result = await svc.getEmotionalTrend(makeSession(), "sen-1");
		expect(result.hasNegativeAlert).toBe(false);
	});

	it("does not trigger hasNegativeAlert when last 3 are mixed", async () => {
		const svc = makeService({
			findRecentConversations: vi
				.fn()
				.mockResolvedValue([
					makeConv({ id: "c1", emotionalTone: "negativo" }),
					makeConv({ id: "c2", emotionalTone: "positivo" }),
					makeConv({ id: "c3", emotionalTone: "negativo" }),
				]),
		});
		const result = await svc.getEmotionalTrend(makeSession(), "sen-1");
		expect(result.hasNegativeAlert).toBe(false);
	});

	it("returns the senior's userId in the response", async () => {
		const svc = makeService();
		const result = await svc.getEmotionalTrend(makeSession(), "sen-1");
		expect(result.seniorId).toBe("sen-1");
	});

	it("handles null emotionalTone gracefully", async () => {
		const svc = makeService({
			findRecentConversations: vi
				.fn()
				.mockResolvedValue([makeConv({ emotionalTone: null })]),
		});
		const result = await svc.getEmotionalTrend(makeSession(), "sen-1");
		expect(result.entries[0]?.emotionalTone).toBe("neutro");
	});
});

// ── getSeniors ────────────────────────────────────────────────────────────────

describe("SeniorsService.getSeniors", () => {
	it("throws ForbiddenException when called as admin", async () => {
		const svc = makeService();
		await expect(svc.getSeniors(makeSession("admin"))).rejects.toThrow(
			ForbiddenException,
		);
	});

	it("returns empty list when caregiver has no organization", async () => {
		const svc = makeService({
			findUser: vi.fn().mockResolvedValue({
				id: "usr-1",
				organizationId: null,
				isActive: true,
			}),
		});
		const result = await svc.getSeniors(makeSession("caregiver"));
		expect(result).toHaveLength(0);
	});
});

// ── getAvailableReportDates ───────────────────────────────────────────────────

describe("SeniorsService.getAvailableReportDates", () => {
	it("returns empty list when caregiver has no seniors", async () => {
		const svc = makeService({
			findUser: vi.fn().mockResolvedValue({
				id: "usr-1",
				organizationId: null,
				isActive: true,
			}),
		});
		const result = await svc.getAvailableReportDates(makeSession("caregiver"));
		expect(result).toHaveLength(0);
	});

	it("merges dates coming from conversations and session logs", async () => {
		const svc = makeService({
			findUsersByLocation: vi.fn().mockResolvedValue([{ userId: "sen-1" }]),
			findSeniorProfilesByUserIds: vi.fn().mockResolvedValue([
				{
					userId: "sen-1",
					nickname: "Jose",
					fullname: "Jose Carlos",
					birthdate: "1948-05-20",
				},
			]),
			findUsersByIds: vi.fn().mockResolvedValue([
				{
					id: "sen-1",
					email: "jose@example.com",
					role: "senior",
					username: "ABCD-EFGH-IJKL",
				},
			]),
			findSeniorLikesByUserIds: vi.fn().mockResolvedValue([]),
			findConversationDatesForSeniors: vi
				.fn()
				.mockResolvedValue([
					{ seniorId: "sen-1", createdAt: new Date("2026-04-21T10:00:00Z") },
				]),
			findSessionLogDatesForSeniors: vi
				.fn()
				.mockResolvedValue([
					{ seniorId: "sen-1", createdAt: new Date("2026-04-22T12:00:00Z") },
				]),
		});

		const result = await svc.getAvailableReportDates(makeSession("caregiver"));

		expect(result).toEqual([
			{
				seniorId: "sen-1",
				dates: ["2026-04-21", "2026-04-22"],
			},
		]);
	});
});

describe("SeniorsService.getConversationReport", () => {
	it("uses session logs as the source of truth for failed sessions with notes", async () => {
		const svc = makeService({
			findConversationsForDate: vi.fn().mockResolvedValue([]),
			findSessionLogsForDate: vi.fn().mockResolvedValue([
				{
					id: "log-1",
					seniorId: "sen-1",
					outcome: "Falha",
					note: "O microfone deixou de funcionar.",
					createdAt: new Date("2026-04-22T14:20:00Z"),
				},
			]),
		});

		const result = await svc.getConversationReport(
			makeSession("caregiver"),
			"sen-1",
			"2026-04-22",
		);

		expect(result.totalConversations).toBe(1);
		expect(result.conversations).toEqual([
			{
				startTime: "2026-04-22T14:20:00.000Z",
				duration: 0,
				status: "cancelled",
				userOutcome: "Falha",
				userNote: "O microfone deixou de funcionar.",
				emotionalTone: "sem_registo",
				summary: "",
				mainTopics: [],
				keyPoints: [],
			},
		]);
		expect(result.sessionLog).toEqual([
			{
				startTime: "2026-04-22T14:20:00.000Z",
				status: "cancelled",
				userOutcome: "Falha",
				userNote: "O microfone deixou de funcionar.",
			},
		]);
	});
});
