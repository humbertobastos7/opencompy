import type {
	ConversationReportResponse,
	SeniorMemory,
	SeniorLikes,
	SeniorResponse,
	SeniorSettingsResponse,
} from "@/shared/contracts";

import type { schema } from "@/backend/database/database.service";

export function mapSeniorLikes(
	likes: typeof schema.seniorLikes.$inferSelect | null | undefined,
): SeniorLikes {
	return {
		football: likes?.football ?? [],
		music: likes?.music ?? [],
		cinema: likes?.cinema ?? [],
		gastronomy: likes?.gastronomy ?? [],
		hobbies: likes?.hobbies ?? [],
		others: {},
	};
}

export function mapSeniorResponse(params: {
	user: typeof schema.users.$inferSelect;
	senior: typeof schema.senior.$inferSelect;
	likes: SeniorLikes;
	memories?: SeniorMemory[];
}): SeniorResponse {
	const { senior, user, likes, memories = [] } = params;
	const fullName =
		senior.fullname?.trim() || senior.nickname?.trim() || user.email;
	const nickname = senior.nickname?.trim() || fullName;

	return {
		id: senior.userId,
		fullName,
		email: user.email,
		nickname,
		birthDate: senior.birthdate
			? new Date(senior.birthdate).toISOString()
			: new Date("1970-01-01T00:00:00.000Z").toISOString(),
		photoDataUrl: senior.photoDataUrl ?? null,
		family: senior.family ?? null,
		gender:
			senior.gender === "m" || senior.gender === "f" ? senior.gender : null,
		diagnoses: senior.diagnoses ?? [],
		avoidTopics: senior.avoidTopics ?? [],
		likes,
		memories,
		accessCode: user.role === "senior" ? user.username : null,
	};
}

export function mapSeniorSettings(
	settings: typeof schema.seniorSettings.$inferSelect,
): SeniorSettingsResponse {
	return {
		id: settings.id,
		seniorId: settings.seniorId,
		silenceTimeoutMs: settings.silenceTimeoutMs,
		chatPersonality: settings.chatPersonality,
	};
}

function conversationStatus(
	conv: typeof schema.conversations.$inferSelect,
): "successful" | "cancelled" | "abandoned" {
	if (!conv.closedAt) return "abandoned";
	if (conv.summary?.trim()) return "successful";
	return "cancelled";
}

function sessionLogStatusFromOutcome(
	outcome: "Sucesso" | "Cancelada" | "Falha" | "Abandonada",
): "successful" | "cancelled" | "abandoned" {
	if (outcome === "Sucesso") return "successful";
	if (outcome === "Abandonada") return "abandoned";
	return "cancelled";
}

function buildConversationEntry(
	conversation: typeof schema.conversations.$inferSelect,
) {
	return {
		startTime: conversation.createdAt.toISOString(),
		duration: conversation.closedAt
			? Math.max(
					1,
					Math.round(
						(new Date(conversation.closedAt).getTime() -
							new Date(conversation.createdAt).getTime()) /
							60000,
					),
				)
			: 0,
		status: conversationStatus(conversation),
		userOutcome:
			(conversation.userOutcome as
				| "Sucesso"
				| "Cancelada"
				| "Falha"
				| null
				| undefined) ?? null,
		userNote: conversation.userNote ?? null,
		emotionalTone: conversation.emotionalTone ?? "sem_registo",
		summary: conversation.summary ?? "",
		mainTopics: conversation.mainTopics ?? [],
		keyPoints: conversation.keyPoints ?? [],
	};
}

function buildSyntheticConversationFromSessionLog(
	log: typeof schema.sessionLogs.$inferSelect,
) {
	return {
		startTime: log.createdAt.toISOString(),
		duration: 0,
		status: sessionLogStatusFromOutcome(log.outcome),
		userOutcome: log.outcome === "Abandonada" ? null : log.outcome,
		userNote: log.note ?? null,
		emotionalTone: "sem_registo",
		summary: "",
		mainTopics: [],
		keyPoints: [],
	};
}

function buildSessionLogEntryFromConversation(
	conversation: typeof schema.conversations.$inferSelect,
) {
	return {
		startTime: conversation.createdAt.toISOString(),
		status: conversationStatus(conversation),
		userOutcome:
			(conversation.userOutcome as
				| "Sucesso"
				| "Cancelada"
				| "Falha"
				| null
				| undefined) ?? null,
		userNote: conversation.userNote ?? null,
	};
}

function buildSessionLogEntry(log: typeof schema.sessionLogs.$inferSelect) {
	return {
		startTime: log.createdAt.toISOString(),
		status: sessionLogStatusFromOutcome(log.outcome),
		userOutcome: log.outcome === "Abandonada" ? null : log.outcome,
		userNote: log.note ?? null,
	};
}

function matchesConversationAndSessionLog(
	conversation: typeof schema.conversations.$inferSelect,
	log: typeof schema.sessionLogs.$inferSelect,
) {
	const expectedOutcome =
		(conversation.userOutcome as
			| "Sucesso"
			| "Cancelada"
			| "Falha"
			| null
			| undefined) ??
		(conversationStatus(conversation) === "abandoned"
			? "Abandonada"
			: undefined);
	if (expectedOutcome !== log.outcome) return false;

	if ((conversation.userNote ?? null) !== (log.note ?? null)) {
		return false;
	}

	if (conversation.closedAt) {
		return (
			Math.abs(
				new Date(conversation.closedAt).getTime() - log.createdAt.getTime(),
			) <=
			10 * 60 * 1000
		);
	}

	return (
		log.outcome === "Abandonada" &&
		conversation.createdAt.toISOString().slice(0, 10) ===
			log.createdAt.toISOString().slice(0, 10)
	);
}

export function mapConversationReport(params: {
	date: string;
	conversations: Array<typeof schema.conversations.$inferSelect>;
	sessionLogs: Array<typeof schema.sessionLogs.$inferSelect>;
}): ConversationReportResponse {
	const matchedConversationIds = new Set<string>();
	for (const log of params.sessionLogs) {
		const match = params.conversations.find(
			(conversation) =>
				!matchedConversationIds.has(conversation.id) &&
				matchesConversationAndSessionLog(conversation, log),
		);
		if (match) {
			matchedConversationIds.add(match.id);
		}
	}

	const syntheticConversations = params.sessionLogs
		.filter(
			(log) =>
				!params.conversations.some((conversation) =>
					matchesConversationAndSessionLog(conversation, log),
				),
		)
		.map(buildSyntheticConversationFromSessionLog);

	const parsedConversations = [
		...params.conversations.map(buildConversationEntry),
		...syntheticConversations,
	].sort(
		(a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime(),
	);

	const totalDuration = parsedConversations.reduce(
		(sum, conversation) => sum + conversation.duration,
		0,
	);

	return {
		date: params.date,
		totalConversations: parsedConversations.length,
		averageDuration:
			parsedConversations.length > 0
				? Math.round(totalDuration / parsedConversations.length)
				: 0,
		conversations: parsedConversations,
		sessionLog: [
			...params.sessionLogs.map(buildSessionLogEntry),
			...params.conversations
				.filter((conversation) => !matchedConversationIds.has(conversation.id))
				.map(buildSessionLogEntryFromConversation),
		].sort(
			(a, b) =>
				new Date(b.startTime).getTime() - new Date(a.startTime).getTime(),
		),
	};
}
