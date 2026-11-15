import { describe, expect, it, vi } from "vitest";
import { ForbiddenException } from "@nestjs/common";
import { CaregiverService } from "./caregiver.service";

// ── Factories ─────────────────────────────────────────────────────────────────

function makeSession(role: "caregiver" | "senior" | "admin" = "caregiver") {
	return { user: { id: "usr-caregiver-1", role } } as never;
}

function makeSenior(overrides: Record<string, unknown> = {}) {
	return {
		seniorId: "sen-1",
		fullName: "António Silva",
		nickname: "Toni",
		institutionName: null,
		accessCode: "ABC1-DEF2-GHI3",
		...overrides,
	};
}

function makeConv(overrides: Record<string, unknown> = {}) {
	return {
		id: "conv-1",
		seniorId: "sen-1",
		createdAt: new Date("2026-03-30T10:00:00Z"),
		closedAt: new Date("2026-03-30T10:08:00Z"),
		summary: "Talked about family",
		emotionalTone: "positivo",
		userOutcome: null,
		...overrides,
	};
}

function makeSessionLog(overrides: Record<string, unknown> = {}) {
	return {
		id: "log-1",
		seniorId: "sen-1",
		outcome: "Sucesso" as const,
		note: null,
		createdAt: new Date("2026-03-30T10:08:00Z"),
		...overrides,
	};
}

function makeRepo(overrides: Record<string, unknown> = {}) {
	return {
		findUser: vi
			.fn()
			.mockResolvedValue({ id: "usr-caregiver-1", organizationId: "org-1" }),
		listSeniorsByOrganization: vi.fn().mockResolvedValue([makeSenior()]),
		// Dashboard uses aggregate queries
		findConversationSummaryForSeniors: vi.fn().mockResolvedValue([]),
		// Daily overview
		findConversationsForDailyOverview: vi.fn().mockResolvedValue([]),
		findSessionLogsForDailyOverview: vi.fn().mockResolvedValue([]),
		// Senior detail
		findConversationsForSenior: vi.fn().mockResolvedValue([]),
		findCaregiverNotesForSenior: vi.fn().mockResolvedValue([]),
		createCaregiverNote: vi.fn(),
		updateCaregiverNote: vi.fn(),
		deleteCaregiverNote: vi.fn(),
		...overrides,
	};
}

function makePolicy(overrides: Record<string, unknown> = {}) {
	return {
		assertSeniorAccess: vi.fn().mockResolvedValue(undefined),
		...overrides,
	};
}

function makeService(
	repoOverrides: Record<string, unknown> = {},
	policyOverrides: Record<string, unknown> = {},
) {
	return new CaregiverService(
		makeRepo(repoOverrides) as never,
		makePolicy(policyOverrides) as never,
		{ invalidateContext: vi.fn() } as never,
	);
}

// ── toneCategory ──────────────────────────────────────────────────────────────

describe("CaregiverService.toneCategory", () => {
	const svc = makeService();
	const tone = (t: string | null) =>
		(svc as never as Record<string, (t: string | null) => string>).toneCategory(
			t,
		);

	it("classifies null as unknown", () => {
		expect(tone(null)).toBe("unknown");
	});

	it.each([
		"positivo",
		"alegre",
		"feliz",
		"animado",
		"positive",
		"happy",
		"cheerful",
	])("classifies %s as positive", (t) => expect(tone(t)).toBe("positive"));

	it.each([
		"negativo",
		"melancólico",
		"melancolico",
		"ansioso",
		"triste",
		"depressivo",
		"negative",
		"sad",
		"anxious",
		"melancholic",
		"depressed",
	])("classifies %s as negative", (t) => expect(tone(t)).toBe("negative"));

	it("is case-insensitive", () => {
		expect(tone("POSITIVO")).toBe("positive");
		expect(tone("Negativo")).toBe("negative");
	});

	it("classifies unknown strings as neutral", () => {
		expect(tone("curioso")).toBe("neutral");
		expect(tone("tranquilo")).toBe("neutral");
	});
});

// ── computeConversationDurationMinutes ────────────────────────────────────────

describe("CaregiverService.computeConversationDurationMinutes", () => {
	const svc = makeService();
	const dur = (conv: { createdAt: Date; closedAt: Date | null }) =>
		(
			svc as never as Record<string, (c: typeof conv) => number>
		).computeConversationDurationMinutes(conv);

	it("returns 0 when closedAt is null (abandoned)", () => {
		expect(dur({ createdAt: new Date(), closedAt: null })).toBe(0);
	});

	it("returns at least 1 minute for very short conversations", () => {
		const start = new Date("2026-03-30T10:00:00Z");
		const end = new Date("2026-03-30T10:00:30Z"); // 30 seconds
		expect(dur({ createdAt: start, closedAt: end })).toBe(1);
	});

	it("rounds to the nearest minute", () => {
		const start = new Date("2026-03-30T10:00:00Z");
		const end = new Date("2026-03-30T10:07:30Z"); // 7.5 min → rounds to 8
		expect(dur({ createdAt: start, closedAt: end })).toBe(8);
	});

	it("computes exact minute durations correctly", () => {
		const start = new Date("2026-03-30T10:00:00Z");
		const end = new Date("2026-03-30T10:15:00Z"); // 15 min
		expect(dur({ createdAt: start, closedAt: end })).toBe(15);
	});
});

// ── assertCaregiver (via getDashboard) ────────────────────────────────────────

describe("CaregiverService.assertCaregiver", () => {
	it("throws ForbiddenException when called as senior", async () => {
		const svc = makeService();
		await expect(svc.getDashboard(makeSession("senior"))).rejects.toThrow(
			ForbiddenException,
		);
	});

	it("throws ForbiddenException when called as admin", async () => {
		const svc = makeService();
		await expect(svc.getDashboard(makeSession("admin"))).rejects.toThrow(
			ForbiddenException,
		);
	});

	it("does not throw when called as caregiver", async () => {
		const svc = makeService();
		await expect(
			svc.getDashboard(makeSession("caregiver")),
		).resolves.toBeDefined();
	});
});

// ── getDashboard ──────────────────────────────────────────────────────────────

describe("CaregiverService.getDashboard", () => {
	it("returns empty seniors when caregiver has no organization", async () => {
		const svc = makeService({
			findUser: vi
				.fn()
				.mockResolvedValue({ id: "usr-1", organizationId: null }),
		});
		const result = await svc.getDashboard(makeSession());
		expect(result.totalSeniors).toBe(0);
		expect(result.seniors).toHaveLength(0);
	});

	it("aggregates conversation counts from summary query", async () => {
		const svc = makeService({
			findConversationSummaryForSeniors: vi.fn().mockResolvedValue([
				{
					seniorId: "sen-1",
					count: 5,
					lastConversationAt: new Date("2026-03-30T10:00:00Z"),
				},
			]),
		});
		const result = await svc.getDashboard(makeSession());
		expect(result.seniors[0]?.conversationCount).toBe(5);
		expect(result.totalConversations).toBe(5);
	});

	it("sums total conversations across all seniors", async () => {
		const svc = makeService({
			listSeniorsByOrganization: vi
				.fn()
				.mockResolvedValue([
					makeSenior({ seniorId: "sen-1" }),
					makeSenior({ seniorId: "sen-2", fullName: "Maria Costa" }),
				]),
			findConversationSummaryForSeniors: vi.fn().mockResolvedValue([
				{ seniorId: "sen-1", count: 3, lastConversationAt: new Date() },
				{ seniorId: "sen-2", count: 7, lastConversationAt: new Date() },
			]),
		});
		const result = await svc.getDashboard(makeSession());
		expect(result.totalConversations).toBe(10);
	});

	it("falls back to nickname when fullName is missing", async () => {
		const svc = makeService({
			listSeniorsByOrganization: vi
				.fn()
				.mockResolvedValue([makeSenior({ fullName: null, nickname: "Toni" })]),
		});
		const result = await svc.getDashboard(makeSession());
		expect(result.seniors[0]?.nickname).toBe("Toni");
		expect(result.seniors[0]?.fullName).toBe("Toni");
	});
});

// ── getDailyOverview ──────────────────────────────────────────────────────────

describe("CaregiverService.getDailyOverview", () => {
	it("returns empty entries when there are no data", async () => {
		const svc = makeService();
		const result = await svc.getDailyOverview(makeSession());
		expect(result.entries).toHaveLength(0);
	});

	it("counts session outcomes from session logs", async () => {
		const svc = makeService({
			findSessionLogsForDailyOverview: vi
				.fn()
				.mockResolvedValue([
					makeSessionLog({ outcome: "Sucesso" }),
					makeSessionLog({ id: "log-2", outcome: "Cancelada" }),
					makeSessionLog({ id: "log-3", outcome: "Falha" }),
					makeSessionLog({ id: "log-4", outcome: "Abandonada" }),
				]),
		});
		const result = await svc.getDailyOverview(makeSession());
		expect(result.entries[0]?.sessions.successful).toBe(1);
		expect(result.entries[0]?.sessions.cancelled).toBe(1);
		expect(result.entries[0]?.sessions.failed).toBe(1);
		expect(result.entries[0]?.sessions.abandoned).toBe(1);
	});

	it("groups conversations by date and sorts DESC", async () => {
		const svc = makeService({
			findConversationsForDailyOverview: vi
				.fn()
				.mockResolvedValue([
					makeConv({ id: "c1", createdAt: new Date("2026-03-30T10:00:00Z") }),
					makeConv({ id: "c2", createdAt: new Date("2026-03-29T10:00:00Z") }),
				]),
		});
		const result = await svc.getDailyOverview(makeSession());
		expect(result.entries).toHaveLength(2);
		expect(result.entries[0]?.date).toBe("2026-03-30");
		expect(result.entries[1]?.date).toBe("2026-03-29");
	});

	it("counts distinct seniors per day", async () => {
		const svc = makeService({
			listSeniorsByOrganization: vi
				.fn()
				.mockResolvedValue([
					makeSenior({ seniorId: "sen-1" }),
					makeSenior({ seniorId: "sen-2", fullName: "Maria Costa" }),
				]),
			findConversationsForDailyOverview: vi.fn().mockResolvedValue([
				makeConv({ id: "c1", seniorId: "sen-1" }),
				makeConv({ id: "c2", seniorId: "sen-1" }), // same senior
				makeConv({ id: "c3", seniorId: "sen-2" }),
			]),
		});
		const result = await svc.getDailyOverview(makeSession());
		expect(result.entries[0]?.seniorsCount).toBe(2);
	});

	it("aggregates emotion distribution correctly", async () => {
		const svc = makeService({
			listSeniorsByOrganization: vi
				.fn()
				.mockResolvedValue([
					makeSenior({ seniorId: "sen-1" }),
					makeSenior({ seniorId: "sen-2", fullName: "Maria Costa" }),
					makeSenior({ seniorId: "sen-3", fullName: "João Melo" }),
				]),
			findConversationsForDailyOverview: vi.fn().mockResolvedValue([
				makeConv({ id: "c1", seniorId: "sen-1", emotionalTone: "positivo" }),
				makeConv({ id: "c2", seniorId: "sen-2", emotionalTone: "negativo" }),
				makeConv({ id: "c3", seniorId: "sen-3", emotionalTone: "curioso" }), // neutral
			]),
		});
		const result = await svc.getDailyOverview(makeSession());
		expect(result.entries[0]?.emotions.positive).toBe(1);
		expect(result.entries[0]?.emotions.negative).toBe(1);
		expect(result.entries[0]?.emotions.neutral).toBe(1);
	});

	it("computes totalMinutes as sum of all conversation durations", async () => {
		const svc = makeService({
			findConversationsForDailyOverview: vi.fn().mockResolvedValue([
				makeConv({
					id: "c1",
					createdAt: new Date("2026-03-30T10:00:00Z"),
					closedAt: new Date("2026-03-30T10:10:00Z"),
				}),
				makeConv({
					id: "c2",
					createdAt: new Date("2026-03-30T11:00:00Z"),
					closedAt: new Date("2026-03-30T11:05:00Z"),
				}),
			]),
		});
		const result = await svc.getDailyOverview(makeSession());
		expect(result.entries[0]?.totalMinutes).toBe(15);
		expect(result.entries[0]?.averageMinutes).toBe(8); // Math.round(15/2)
	});

	it("uses the most recent tone as dominant emotion for senior breakdown", async () => {
		// Conversations arrive DESC, so first occurrence = most recent
		const svc = makeService({
			findConversationsForDailyOverview: vi.fn().mockResolvedValue([
				makeConv({
					id: "c1",
					emotionalTone: "positivo",
					createdAt: new Date("2026-03-30T11:00:00Z"),
				}),
				makeConv({
					id: "c2",
					emotionalTone: "negativo",
					createdAt: new Date("2026-03-30T09:00:00Z"),
				}),
			]),
		});
		const result = await svc.getDailyOverview(makeSession());
		const seniorBreakdown = result.entries[0]?.seniorBreakdown[0];
		expect(seniorBreakdown?.dominantEmotion).toBe("positive");
	});
});

// ── createNote ────────────────────────────────────────────────────────────────

describe("CaregiverService.createNote", () => {
	it("trims whitespace from note content before saving", async () => {
		const createFn = vi.fn().mockResolvedValue({
			id: "note-1",
			seniorId: "sen-1",
			caregiverId: "usr-caregiver-1",
			content: "Note content",
			category: null,
			pinned: false,
			createdAt: new Date("2026-03-30T10:00:00Z"),
		});
		const svc = makeService({ createCaregiverNote: createFn });

		await svc.createNote(makeSession(), "sen-1", {
			content: "  Note content  ",
		});

		expect(createFn).toHaveBeenCalledWith(
			expect.objectContaining({
				content: "Note content",
				category: null,
				pinned: false,
			}),
		);
	});

	it("throws ForbiddenException when called as non-caregiver", async () => {
		const svc = makeService();
		await expect(
			svc.createNote(makeSession("senior"), "sen-1", { content: "test" }),
		).rejects.toThrow(ForbiddenException);
	});
});

// ── updateNote ────────────────────────────────────────────────────────────────

describe("CaregiverService.updateNote", () => {
	it("updates category and pinned state", async () => {
		const updateFn = vi.fn().mockResolvedValue({
			id: "note-1",
			seniorId: "sen-1",
			caregiverId: "usr-caregiver-1",
			content: "Prefere ser chamada de Mimi.",
			category: "Geral",
			pinned: true,
			createdAt: new Date("2026-03-30T10:00:00Z"),
		});
		const svc = makeService({ updateCaregiverNote: updateFn });

		const result = await svc.updateNote(makeSession(), "sen-1", "note-1", {
			category: "Geral",
			pinned: true,
		});

		expect(updateFn).toHaveBeenCalledWith(
			expect.objectContaining({
				noteId: "note-1",
				seniorId: "sen-1",
				category: "Geral",
				pinned: true,
			}),
		);
		expect(result.pinned).toBe(true);
	});
});

// ── deleteNote ────────────────────────────────────────────────────────────────

describe("CaregiverService.deleteNote", () => {
	it("deletes a note", async () => {
		const deleteFn = vi.fn().mockResolvedValue({ id: "note-1" });
		const svc = makeService({ deleteCaregiverNote: deleteFn });

		await expect(
			svc.deleteNote(makeSession(), "sen-1", "note-1"),
		).resolves.toEqual({ success: true });

		expect(deleteFn).toHaveBeenCalledWith({
			noteId: "note-1",
			seniorId: "sen-1",
		});
	});
});
