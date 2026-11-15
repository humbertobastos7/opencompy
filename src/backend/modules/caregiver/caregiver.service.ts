import {
	BadRequestException,
	ForbiddenException,
	Inject,
	Injectable,
	NotFoundException,
	UnauthorizedException,
} from "@nestjs/common";
import type {
	LocalSession,
	CaregiverDailyOverviewResponse,
	CaregiverDashboardResponse,
	CaregiverInstitutionResponse,
	CaregiverNoteResponse,
	CaregiverNotesResponse,
	CaregiverSeniorActivityResponse,
	CaregiverSeniorSummaryResponse,
	CreateCaregiverNoteRequest,
	CreateFamilySeniorRequest,
	CreateFamilySeniorResponse,
	DeleteCaregiverNoteResponse,
	SeniorConversationCountResponse,
	UpdateCaregiverNoteRequest,
	UpdateCaregiverProfileRequest,
} from "@/shared/contracts";
import { ConversationContextService } from "@/backend/conversation-context.service";
import { CaregiverNoteCategorySchema } from "@/shared/contracts";
import { toneCategory } from "@/backend/common/emotional-tone";
import { SeniorAccessPolicy } from "@/backend/modules/seniors/senior-access.policy";
import { CaregiverRepository } from "./caregiver.repository";

@Injectable()
export class CaregiverService {
	constructor(
		@Inject(CaregiverRepository)
		private readonly caregiverRepository: CaregiverRepository,
		@Inject(SeniorAccessPolicy)
		private readonly seniorAccessPolicy: SeniorAccessPolicy,
		@Inject(ConversationContextService)
		private readonly conversationContextService: ConversationContextService,
	) {}

	private assertCaregiver(session: LocalSession) {
		if (session.user.role !== "caregiver") {
			throw new ForbiddenException("CAREGIVER_ONLY_ENDPOINT");
		}
	}

	private computeConversationDurationMinutes(conversation: {
		createdAt: Date;
		closedAt: Date | null;
	}) {
		if (!conversation.closedAt) {
			return 0;
		}

		// Cap at 4 hours to guard against sessions left open when the user backgrounds the browser.
		const MAX_MINUTES = 240;
		return Math.min(
			MAX_MINUTES,
			Math.max(
				1,
				Math.round(
					(conversation.closedAt.getTime() - conversation.createdAt.getTime()) /
						60000,
				),
			),
		);
	}

	private serializeNote(note: {
		id: string;
		seniorId: string;
		caregiverId: string | null;
		content: string;
		category: string | null;
		pinned: boolean;
		createdAt: Date;
	}): CaregiverNoteResponse {
		const parsedCategory = CaregiverNoteCategorySchema.nullable().safeParse(
			note.category,
		);

		return {
			id: note.id,
			seniorId: note.seniorId,
			// Empty for notes written by the person during onboarding.
			caregiverId: note.caregiverId ?? "",
			content: note.content,
			category: parsedCategory.success ? parsedCategory.data : null,
			pinned: note.pinned,
			createdAt: note.createdAt.toISOString(),
		};
	}

	private async getAccessibleSeniors(session: LocalSession) {
		this.assertCaregiver(session);
		const caregiver = await this.caregiverRepository.findUser(session.user.id);
		if (!caregiver?.organizationId) {
			return [];
		}

		return this.caregiverRepository.listSeniorsByOrganization(
			caregiver.organizationId,
		);
	}

	async getDashboard(session: LocalSession): Promise<CaregiverDashboardResponse> {
		const seniors = await this.getAccessibleSeniors(session);
		const seniorIds = seniors.map((senior) => senior.seniorId);
		const conversationSummaries = await this.caregiverRepository.findConversationSummaryForSeniors(seniorIds);

		const conversationMap = new Map<string, { count: number; lastConversationAt: string | null }>();
		for (const summary of conversationSummaries) {
			if (summary.seniorId) {
				conversationMap.set(summary.seniorId, {
					count: summary.count,
					lastConversationAt: summary.lastConversationAt?.toISOString() ?? null,
				});
			}
		}

		const totalConversations = conversationSummaries.reduce((sum, s) => sum + s.count, 0);

		return {
			totalSeniors: seniors.length,
			totalConversations,
			seniors: seniors.map((senior) => ({
				seniorId: senior.seniorId,
				fullName: senior.fullName?.trim() || senior.nickname?.trim() || "",
				nickname: senior.nickname?.trim() || senior.fullName?.trim() || "Senior",
				photoDataUrl: senior.photoDataUrl ?? null,
				institutionName: senior.institutionName ?? null,
				accessCode: senior.accessCode ?? null,
				conversationCount: conversationMap.get(senior.seniorId)?.count ?? 0,
				lastConversationAt: conversationMap.get(senior.seniorId)?.lastConversationAt ?? null,
			})),
		};
	}

	private toneCategory = toneCategory;

	async getDailyOverview(session: LocalSession): Promise<CaregiverDailyOverviewResponse> {
		const seniors = await this.getAccessibleSeniors(session);
		const seniorIds = seniors.map((s) => s.seniorId);

		const [conversations, sessionLogs] = await Promise.all([
			this.caregiverRepository.findConversationsForDailyOverview(seniorIds),
			this.caregiverRepository.findSessionLogsForDailyOverview(seniorIds),
		]);

		// Group conversations by date for totalConversations, totalMinutes, seniorsCount, emotions
		type ConvDayData = {
			seniorIds: Set<string>;
			totalMinutes: number;
			emotions: { positive: number; neutral: number; negative: number; unknown: number };
			count: number;
			firstToneBySenior: Map<string, string | null>;
		};

		const convByDate = new Map<string, ConvDayData>();

		for (const conv of conversations) {
			if (!conv.seniorId) continue;
			const date = conv.createdAt.toISOString().slice(0, 10);
			const existing = convByDate.get(date) ?? {
				seniorIds: new Set<string>(),
				totalMinutes: 0,
				emotions: { positive: 0, neutral: 0, negative: 0, unknown: 0 },
				count: 0,
				firstToneBySenior: new Map<string, string | null>(),
			};
			existing.seniorIds.add(conv.seniorId);
			existing.count += 1;

			existing.totalMinutes += this.computeConversationDurationMinutes(conv);

			// Conversations arrive DESC so first occurrence per senior per day = most recent
			if (!existing.firstToneBySenior.has(conv.seniorId) && conv.emotionalTone) {
				existing.firstToneBySenior.set(conv.seniorId, conv.emotionalTone);
			}

			const cat = this.toneCategory(conv.emotionalTone ?? null);
			existing.emotions[cat] += 1;
			convByDate.set(date, existing);
		}

		// Group session logs by date for outcome counts and per-senior log entries
		type LogDayData = {
			sessions: { successful: number; cancelled: number; failed: number; abandoned: number };
			logsBySenior: Map<string, Array<{ outcome: string; note: string | null; createdAt: string }>>;
		};

		const logByDate = new Map<string, LogDayData>();

		for (const log of sessionLogs) {
			const date = log.createdAt.toISOString().slice(0, 10);
			const existing = logByDate.get(date) ?? {
				sessions: { successful: 0, cancelled: 0, failed: 0, abandoned: 0 },
				logsBySenior: new Map(),
			};

			if (log.outcome === "Sucesso") existing.sessions.successful += 1;
			else if (log.outcome === "Cancelada") existing.sessions.cancelled += 1;
			else if (log.outcome === "Falha") existing.sessions.failed += 1;
			else if (log.outcome === "Abandonada") existing.sessions.abandoned += 1;

			const seniorLogs = existing.logsBySenior.get(log.seniorId) ?? [];
			seniorLogs.push({
				outcome: log.outcome,
				note: log.note,
				createdAt: log.createdAt.toISOString(),
			});
			existing.logsBySenior.set(log.seniorId, seniorLogs);
			logByDate.set(date, existing);
		}

		// Merge all dates from both sources
		const allDates = new Set([...convByDate.keys(), ...logByDate.keys()]);
		const seniorMap = new Map(seniors.map((s) => [s.seniorId, s]));

		const entries = [...allDates]
			.sort((a, b) => b.localeCompare(a))
			.map((date) => {
				const conv = convByDate.get(date);
				const logs = logByDate.get(date);

				const totalCount = conv?.count ?? 0;
				const totalMinutes = conv?.totalMinutes ?? 0;
				const allSeniorIds = new Set([
					...(conv?.seniorIds ?? []),
					...(logs?.logsBySenior.keys() ?? []),
				]);

				// Build per-senior breakdown
				const seniorBreakdown = [...allSeniorIds].map((seniorId) => {
					const s = seniorMap.get(seniorId);
					const logEntries = logs?.logsBySenior.get(seniorId) ?? [];
					const sessions = { successful: 0, cancelled: 0, failed: 0, abandoned: 0 };
					for (const entry of logEntries) {
						if (entry.outcome === "Sucesso") sessions.successful += 1;
						else if (entry.outcome === "Cancelada") sessions.cancelled += 1;
						else if (entry.outcome === "Falha") sessions.failed += 1;
						else if (entry.outcome === "Abandonada") sessions.abandoned += 1;
					}
					return {
						seniorId,
						fullName: s?.fullName?.trim() || s?.nickname?.trim() || "",
						nickname: s?.nickname?.trim() || s?.fullName?.trim() || "Senior",
						sessions,
						dominantEmotion: this.toneCategory(conv?.firstToneBySenior.get(seniorId) ?? null),
						sessionLogs: logEntries.map((l) => ({
							outcome: l.outcome as "Sucesso" | "Cancelada" | "Falha" | "Abandonada",
							note: l.note,
							createdAt: l.createdAt,
						})),
					};
				}).sort((a, b) => a.fullName.localeCompare(b.fullName));

				return {
					date,
					totalConversations: totalCount,
					totalMinutes,
					averageMinutes: totalCount > 0 ? Math.round(totalMinutes / totalCount) : 0,
					seniorsCount: allSeniorIds.size,
					sessions: logs?.sessions ?? { successful: 0, cancelled: 0, failed: 0, abandoned: 0 },
					emotions: conv?.emotions ?? { positive: 0, neutral: 0, negative: 0, unknown: 0 },
					seniorBreakdown,
				};
			});

		return { entries };
	}

	async getSeniorSummary(
		session: LocalSession,
		seniorId: string,
	): Promise<CaregiverSeniorSummaryResponse> {
		this.assertCaregiver(session);
		await this.seniorAccessPolicy.assertSeniorAccess(session, seniorId);
		const seniors = await this.getAccessibleSeniors(session);
		const senior = seniors.find((item) => item.seniorId === seniorId);
		if (!senior) {
			throw new ForbiddenException("YOU_DO_NOT_HAVE_ACCESS_TO_THIS_LOCATION");
		}

		const [conversations, notes] = await Promise.all([
			this.caregiverRepository.findConversationsForSenior(seniorId),
			this.caregiverRepository.findCaregiverNotesForSenior(seniorId),
		]);

		const totalDuration = conversations.reduce(
			(sum, conversation) =>
				sum + this.computeConversationDurationMinutes(conversation),
			0,
		);

		return {
			seniorId,
			fullName: senior.fullName?.trim() || senior.nickname?.trim() || "",
			nickname: senior.nickname?.trim() || senior.fullName?.trim() || "Senior",
			conversationCount: conversations.length,
			lastConversationAt: conversations[0]?.createdAt.toISOString() ?? null,
			averageConversationDurationMinutes:
				conversations.length > 0
					? Math.round(totalDuration / conversations.length)
					: 0,
			notesCount: notes.length,
		};
	}

	async getConversationCount(
		session: LocalSession,
		seniorId: string,
	): Promise<SeniorConversationCountResponse> {
		this.assertCaregiver(session);
		await this.seniorAccessPolicy.assertSeniorAccess(session, seniorId);
		const conversations =
			await this.caregiverRepository.findConversationsForSenior(seniorId);

		return {
			seniorId,
			total: conversations.length,
		};
	}

	async getSeniorActivity(
		session: LocalSession,
		seniorId: string,
	): Promise<CaregiverSeniorActivityResponse> {
		this.assertCaregiver(session);
		await this.seniorAccessPolicy.assertSeniorAccess(session, seniorId);
		const [conversations, notes] = await Promise.all([
			this.caregiverRepository.findConversationsForSenior(seniorId),
			this.caregiverRepository.findCaregiverNotesForSenior(seniorId),
		]);

		const items = [
			...conversations.map((conversation) => ({
				type: "conversation" as const,
				timestamp: conversation.createdAt.toISOString(),
				title: "Conversation recorded",
				description:
					conversation.summary?.trim() ||
					"Conversation stored without a generated summary.",
				metadata: { conversationId: conversation.id },
			})),
			...notes.map((note) => ({
				type: "caregiver_note" as const,
				timestamp: note.createdAt.toISOString(),
				title: "Caregiver note added",
				description: note.content,
				metadata: { noteId: note.id, caregiverId: note.caregiverId ?? "" },
			})),
		].sort((left, right) => right.timestamp.localeCompare(left.timestamp));

		return {
			seniorId,
			items,
		};
	}

	async createNote(
		session: LocalSession,
		seniorId: string,
		payload: CreateCaregiverNoteRequest,
	): Promise<CaregiverNoteResponse> {
		this.assertCaregiver(session);
		await this.seniorAccessPolicy.assertSeniorAccess(session, seniorId);
		const created = await this.caregiverRepository.createCaregiverNote({
			seniorId,
			caregiverId: session.user.id,
			content: payload.content.trim(),
			category: payload.category ?? null,
			pinned: payload.pinned ?? false,
		});
		this.conversationContextService.invalidateContext(seniorId);

		return this.serializeNote(created);
	}

	async getNotes(
		session: LocalSession,
		seniorId: string,
	): Promise<CaregiverNotesResponse> {
		this.assertCaregiver(session);
		await this.seniorAccessPolicy.assertSeniorAccess(session, seniorId);
		const notes = await this.caregiverRepository.findCaregiverNotesForSenior(seniorId);

		return {
			seniorId,
			notes: notes.map((note) => this.serializeNote(note)),
		};
	}

	async updateNote(
		session: LocalSession,
		seniorId: string,
		noteId: string,
		payload: UpdateCaregiverNoteRequest,
	): Promise<CaregiverNoteResponse> {
		this.assertCaregiver(session);
		await this.seniorAccessPolicy.assertSeniorAccess(session, seniorId);
		const updated = await this.caregiverRepository.updateCaregiverNote({
			noteId,
			seniorId,
			content: payload.content?.trim(),
			category: payload.category,
			pinned: payload.pinned,
		});

		if (!updated) {
			throw new NotFoundException("CAREGIVER_NOTE_NOT_FOUND");
		}
		this.conversationContextService.invalidateContext(seniorId);

		return this.serializeNote(updated);
	}

	async deleteNote(
		session: LocalSession,
		seniorId: string,
		noteId: string,
	): Promise<DeleteCaregiverNoteResponse> {
		this.assertCaregiver(session);
		await this.seniorAccessPolicy.assertSeniorAccess(session, seniorId);
		const deleted = await this.caregiverRepository.deleteCaregiverNote({
			noteId,
			seniorId,
		});

		if (!deleted) {
			throw new NotFoundException("CAREGIVER_NOTE_NOT_FOUND");
		}
		this.conversationContextService.invalidateContext(seniorId);

		return { success: true };
	}

	async getInstitution(session: LocalSession): Promise<CaregiverInstitutionResponse> {
		this.assertCaregiver(session);
		const row = await this.caregiverRepository.findUserWithInstitution(session.user.id);
		if (!row?.institutionType) {
			return { type: "ipss", designation: null };
		}
		return {
			type: row.institutionType as "ipss" | "family",
			designation: row.institutionDesignation ?? null,
		};
	}

	async updateProfile(
		session: LocalSession,
		payload: UpdateCaregiverProfileRequest,
	): Promise<{ success: true }> {
		this.assertCaregiver(session);
		const existing = await this.caregiverRepository.findUserByEmail(payload.email);
		if (existing && existing.id !== session.user.id) {
			throw new BadRequestException("EMAIL_ALREADY_REGISTERED");
		}
		await this.caregiverRepository.updateUserEmail(session.user.id, payload.email);
		await this.caregiverRepository.updateCaregiverFullName(session.user.id, payload.fullName);
		return { success: true };
	}

	async createFamilySenior(
		session: LocalSession,
		payload: CreateFamilySeniorRequest,
	): Promise<CreateFamilySeniorResponse> {
		this.assertCaregiver(session);
		const row = await this.caregiverRepository.findUserWithInstitution(session.user.id);
		if (!row?.organizationId) {
			throw new UnauthorizedException("CAREGIVER_HAS_NO_INSTITUTION");
		}
		if (row.institutionType !== "family") {
			throw new ForbiddenException("FAMILY_INSTITUTION_REQUIRED");
		}
		const result = await this.caregiverRepository.createFamilySenior({
			organizationId: row.organizationId,
			fullName: payload.fullName,
			gender: (payload.gender as "m" | "f" | null) ?? null,
			birthdate: payload.birthDate.toISOString().slice(0, 10),
		});
		return { seniorId: result.userId, accessCode: result.accessCode };
	}
}
