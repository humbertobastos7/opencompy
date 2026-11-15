import {
	ForbiddenException,
	Inject,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import type {
	AvailableReportDatesResponse,
	LocalSession,
	ConversationReportResponse,
	EmotionalTrendResponse,
	SeniorLikes,
	SeniorProfileUpdateRequest,
	SeniorResponse,
	SeniorsListResponse,
	SeniorSettingsResponse,
	SeniorSettingsUpdateRequest,
} from "@/shared/contracts";
import { ConversationContextService } from "@/backend/conversation-context.service";
import {
	mapConversationReport,
	mapSeniorLikes,
	mapSeniorResponse,
	mapSeniorSettings,
} from "./seniors.mapper";
import { NEGATIVE_TONES } from "@/backend/common/emotional-tone";
import { SeniorAccessPolicy } from "./senior-access.policy";
import { SeniorsRepository } from "./seniors.repository";

@Injectable()
export class SeniorsService {
	constructor(
		@Inject(SeniorsRepository)
		private readonly seniorsRepository: SeniorsRepository,
		@Inject(SeniorAccessPolicy)
		private readonly seniorAccessPolicy: SeniorAccessPolicy,
		@Inject(ConversationContextService)
		private readonly conversationContextService: ConversationContextService,
	) {}

	async resolveSeniorByAnyId(seniorOrUserId: string) {
		return this.seniorsRepository.findSeniorProfile(seniorOrUserId);
	}

	async getSeniorByUserId(userId: string) {
		return this.seniorsRepository.findSeniorProfile(userId);
	}

	private async getSeniorLikes(seniorId: string): Promise<SeniorLikes> {
		return mapSeniorLikes(await this.seniorsRepository.findSeniorLikes(seniorId));
	}

	private async saveInitialContextNote(seniorId: string, content: string) {
		// When the senior belongs to an organization the note is attributed to
		// its caregiver; the local user has none, so the note stands on its own.
		const seniorUser = await this.seniorsRepository.findUserOrganization(seniorId);
		const caregiver = seniorUser?.organizationId
			? await this.seniorsRepository.findFirstCaregiverForOrganization(
					seniorUser.organizationId,
				)
			: null;

		await this.seniorsRepository.createCaregiverContextNote({
			seniorId,
			caregiverId: caregiver?.userId ?? null,
			content,
			category: "Geral",
			pinned: true,
		});
	}

	private async toSeniorResponse(seniorId: string): Promise<SeniorResponse> {
		const senior = await this.seniorsRepository.findSeniorProfile(seniorId);
		if (!senior) {
			throw new NotFoundException("SENIOR_NOT_FOUND");
		}

		const [user, likes, memories] = await Promise.all([
			this.seniorsRepository.findUser(senior.userId),
			this.getSeniorLikes(senior.userId),
			this.seniorsRepository.findSeniorInsights(senior.userId),
		]);
		if (!user) {
			throw new NotFoundException("SENIOR_NOT_FOUND");
		}

		return mapSeniorResponse({
			user,
			senior,
			likes,
			memories: memories.map((memory) => ({
				id: memory.id,
				content: memory.content,
				createdAt: memory.createdAt.toISOString(),
			})),
		});
	}

	async assertSeniorAccess(localSession: LocalSession, seniorOrUserId: string) {
		return this.seniorAccessPolicy.assertSeniorAccess(localSession, seniorOrUserId);
	}

	async getSeniors(localSession: LocalSession): Promise<SeniorsListResponse> {
		if (localSession.user.role === "senior") {
			const senior = await this.getSeniorByUserId(localSession.user.id);
			return senior ? [await this.toSeniorResponse(senior.userId)] : [];
		}

		if (localSession.user.role !== "caregiver") {
			throw new ForbiddenException("ONLY_CAREGIVERS_CAN_LIST_SENIORS");
		}

		const user = await this.seniorsRepository.findUser(localSession.user.id);
		if (!user?.isActive) {
			throw new ForbiddenException("ACCOUNT_DISABLED");
		}

		if (!user.organizationId) {
			return [];
		}

		const seniors = await this.seniorsRepository.findUsersByLocation(
			user.organizationId,
		);

		if (seniors.length === 0) return [];

		const userIds = seniors.map((s) => s.userId);
		const [profiles, users, allLikes] = await Promise.all([
			this.seniorsRepository.findSeniorProfilesByUserIds(userIds),
			this.seniorsRepository.findUsersByIds(userIds),
			this.seniorsRepository.findSeniorLikesByUserIds(userIds),
		]);

		const profileMap = new Map(profiles.map((p) => [p.userId, p]));
		const userMap = new Map(users.map((u) => [u.id, u]));
		const likesMap = new Map(allLikes.map((l) => [l.seniorId, l]));

		return userIds.flatMap((id) => {
			const profile = profileMap.get(id);
			const usr = userMap.get(id);
			if (!profile || !usr) return [];
			return [
				mapSeniorResponse({
					user: usr,
					senior: profile,
					likes: mapSeniorLikes(likesMap.get(id)),
				}),
			];
		});
	}

	async getSenior(localSession: LocalSession, seniorOrUserId: string) {
		const senior = await this.assertSeniorAccess(localSession, seniorOrUserId);
		return this.toSeniorResponse(senior.userId);
	}

	async saveSeniorLikes(
		localSession: LocalSession,
		seniorOrUserId: string,
		likes: SeniorLikes,
	) {
		const senior = await this.assertSeniorAccess(localSession, seniorOrUserId);
		await this.seniorsRepository.upsertSeniorLikes(senior.userId, likes);
		return { success: true };
	}

	async getConversationReport(
		localSession: LocalSession,
		residentOrUserId: string,
		date: string,
	): Promise<ConversationReportResponse> {
		const senior = await this.assertSeniorAccess(localSession, residentOrUserId);
		const start = new Date(`${date}T00:00:00.000Z`);
		const end = new Date(`${date}T23:59:59.999Z`);
		const [conversations, sessionLogs] = await Promise.all([
			this.seniorsRepository.findConversationsForDate(senior.userId, start, end),
			this.seniorsRepository.findSessionLogsForDate(senior.userId, start, end),
		]);
		return mapConversationReport({
			date,
			conversations,
			sessionLogs,
		});
	}

	async getEmotionalTrend(
		localSession: LocalSession,
		residentOrUserId: string,
	): Promise<EmotionalTrendResponse> {
		const TREND_CONVERSATION_LIMIT = 30;

		const senior = await this.assertSeniorAccess(localSession, residentOrUserId);
		const recent = await this.seniorsRepository.findRecentConversations(
			senior.userId,
			TREND_CONVERSATION_LIMIT,
		);

		// Group by date (oldest first for chart order).
		const byDate = new Map<string, { tones: string[]; count: number }>();
		for (const conv of [...recent].reverse()) {
			const date = conv.createdAt.toISOString().slice(0, 10);
			const existing = byDate.get(date) ?? { tones: [], count: 0 };
			existing.count += 1;
			if (conv.emotionalTone) {
				existing.tones.push(conv.emotionalTone.toLowerCase());
			}
			byDate.set(date, existing);
		}

		const entries = [...byDate.entries()].map(([date, { tones, count }]) => {
			// Pick the most negative tone for the day, falling back to neutral.
			const dominant =
				tones.find((t) => NEGATIVE_TONES.has(t)) ?? tones[0] ?? "neutro";
			return { date, emotionalTone: dominant, conversationCount: count };
		});

		// Alert when the last three or more conversations are all negative.
		const lastThree = recent.slice(0, 3);
		const hasNegativeAlert =
			lastThree.length >= 3 &&
			lastThree.every((c) =>
				c.emotionalTone ? NEGATIVE_TONES.has(c.emotionalTone.toLowerCase()) : false,
			);

		return { seniorId: senior.userId, entries, hasNegativeAlert };
	}

	async getAvailableReportDates(
		localSession: LocalSession,
	): Promise<AvailableReportDatesResponse> {
		const seniors = await this.getSeniors(localSession);
		if (seniors.length === 0) {
			return [];
		}

		const seniorIds = seniors.map((senior) => senior.id);
		const [conversations, sessionLogs] = await Promise.all([
			this.seniorsRepository.findConversationDatesForSeniors(seniorIds),
			this.seniorsRepository.findSessionLogDatesForSeniors(seniorIds),
		]);
		const grouped = new Map<string, Set<string>>();

		for (const item of conversations) {
			if (!item.seniorId) {
				continue;
			}

			const dates = grouped.get(item.seniorId) ?? new Set<string>();
			dates.add(item.createdAt.toISOString().slice(0, 10));
			grouped.set(item.seniorId, dates);
		}

		for (const item of sessionLogs) {
			if (!item.seniorId) {
				continue;
			}

			const dates = grouped.get(item.seniorId) ?? new Set<string>();
			dates.add(item.createdAt.toISOString().slice(0, 10));
			grouped.set(item.seniorId, dates);
		}

		return [...grouped.entries()].map(([seniorId, dates]) => ({
			seniorId,
			dates: [...dates].sort(),
		}));
	}

	async updateSeniorProfile(
		localSession: LocalSession,
		residentOrUserId: string,
		payload: SeniorProfileUpdateRequest,
	) {
		const senior = await this.assertSeniorAccess(localSession, residentOrUserId);

		const profilePatch: SeniorProfileUpdateRequest = {
			...(payload.fullName !== undefined
				? { fullName: payload.fullName.trim() }
				: {}),
			...(payload.birthDate !== undefined
				? { birthDate: normalizeBirthDate(payload.birthDate) }
				: {}),
			...(payload.family !== undefined
				? { family: payload.family?.trim() ? payload.family.trim() : null }
				: {}),
			...(payload.diagnoses !== undefined
				? { diagnoses: normalizeStringList(payload.diagnoses) }
				: {}),
			...(payload.avoidTopics !== undefined
				? { avoidTopics: normalizeStringList(payload.avoidTopics) }
				: {}),
			...(payload.photoDataUrl !== undefined
				? { photoDataUrl: payload.photoDataUrl }
				: {}),
		};

		if (Object.keys(profilePatch).length > 0) {
			await this.seniorsRepository.updateSeniorProfile(senior.userId, profilePatch);
		}

		const initialContext = payload.initialContext?.trim();
		if (initialContext) {
			await this.saveInitialContextNote(senior.userId, initialContext);
		}

		if (Object.keys(profilePatch).length > 0 || initialContext) {
			this.conversationContextService.invalidateContext(senior.userId);
		}

		return { success: true };
	}

	async updateSeniorNickname(
		localSession: LocalSession,
		residentOrUserId: string,
		nickname: string,
	) {
		const senior = await this.assertSeniorAccess(localSession, residentOrUserId);
		await this.seniorsRepository.updateSeniorNickname(senior.userId, nickname);
		return this.toSeniorResponse(senior.userId);
	}

	async getSeniorSettings(localSession: LocalSession, residentOrUserId: string) {
		const senior = await this.assertSeniorAccess(localSession, residentOrUserId);
		return mapSeniorSettings(
			await this.seniorsRepository.ensureSeniorSettings(senior.userId),
		);
	}

	async updateSeniorSettings(
		localSession: LocalSession,
		residentOrUserId: string,
		payload: SeniorSettingsUpdateRequest,
	): Promise<SeniorSettingsResponse> {
		const senior = await this.assertSeniorAccess(localSession, residentOrUserId);
		await this.seniorsRepository.ensureSeniorSettings(senior.userId);
		return mapSeniorSettings(
			await this.seniorsRepository.updateSeniorSettings(senior.userId, payload),
		);
	}
}

function normalizeBirthDate(input: string) {
	if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
		return input;
	}

	return new Date(input).toISOString().slice(0, 10);
}

function normalizeStringList(values: string[]) {
	return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}
