import { Inject, Injectable } from "@nestjs/common";
import { and, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { DatabaseService, schema } from "@/backend/database/database.service";
import type {
	SeniorLikes,
	SeniorProfileUpdateRequest,
	SeniorSettingsUpdateRequest,
} from "@/shared/contracts";

@Injectable()
export class SeniorsRepository {
	constructor(
		@Inject(DatabaseService)
		private readonly database: DatabaseService,
	) {}

	findSeniorProfile(userId: string) {
		return this.database.db.query.senior.findFirst({
			where: eq(schema.senior.userId, userId),
		});
	}

	findUser(userId: string) {
		return this.database.db.query.users.findFirst({
			where: eq(schema.users.id, userId),
		});
	}

	findSeniorLikes(userId: string) {
		return this.database.db.query.seniorLikes.findFirst({
			where: eq(schema.seniorLikes.seniorId, userId),
		});
	}

	findUsersByLocation(locationId: string) {
		return this.database.db
			.select({ userId: schema.senior.userId })
			.from(schema.senior)
			.innerJoin(schema.users, eq(schema.users.id, schema.senior.userId))
			.where(eq(schema.users.organizationId, locationId));
	}

	findSeniorProfilesByUserIds(userIds: string[]) {
		if (userIds.length === 0) return Promise.resolve([]);
		return this.database.db.query.senior.findMany({
			where: inArray(schema.senior.userId, userIds),
		});
	}

	findUsersByIds(userIds: string[]) {
		if (userIds.length === 0) return Promise.resolve([]);
		return this.database.db.query.users.findMany({
			where: inArray(schema.users.id, userIds),
		});
	}

	findSeniorLikesByUserIds(userIds: string[]) {
		if (userIds.length === 0) return Promise.resolve([]);
		return this.database.db.query.seniorLikes.findMany({
			where: inArray(schema.seniorLikes.seniorId, userIds),
		});
	}

	findSeniorInsights(userId: string, limit = 12) {
		return this.database.db
			.select({
				id: schema.seniorInsights.id,
				content: schema.seniorInsights.content,
				createdAt: schema.seniorInsights.createdAt,
			})
			.from(schema.seniorInsights)
			.where(eq(schema.seniorInsights.seniorId, userId))
			.orderBy(desc(schema.seniorInsights.createdAt))
			.limit(limit);
	}

	findUserOrganization(userId: string) {
		return this.database.db.query.users.findFirst({
			columns: { organizationId: true },
			where: eq(schema.users.id, userId),
		});
	}

	findFirstCaregiverForOrganization(organizationId: string) {
		return this.database.db
			.select({ userId: schema.caregiver.userId })
			.from(schema.caregiver)
			.innerJoin(schema.users, eq(schema.users.id, schema.caregiver.userId))
			.where(
				and(
					eq(schema.users.organizationId, organizationId),
					eq(schema.users.role, "caregiver"),
					eq(schema.users.isActive, true),
				),
			)
			.limit(1)
			.then((rows) => rows[0] ?? null);
	}

	async createCaregiverContextNote(input: {
		seniorId: string;
		caregiverId: string | null;
		content: string;
		category?: string | null;
		pinned?: boolean;
	}) {
		const [created] = await this.database.db
			.insert(schema.caregiverNotes)
			.values(input)
			.returning();
		return created;
	}

	async upsertSeniorLikes(userId: string, likes: SeniorLikes) {
		const values = {
			football: likes.football,
			music: likes.music,
			cinema: likes.cinema,
			gastronomy: likes.gastronomy,
			hobbies: likes.hobbies ?? [],
		};
		await this.database.db
			.insert(schema.seniorLikes)
			.values({ seniorId: userId, ...values })
			.onConflictDoUpdate({
				target: schema.seniorLikes.seniorId,
				set: values,
			});
	}

	findRecentConversations(userId: string, limit: number) {
		return this.database.db
			.select({
				id: schema.conversations.id,
				createdAt: schema.conversations.createdAt,
				emotionalTone: schema.conversations.emotionalTone,
			})
			.from(schema.conversations)
			.where(eq(schema.conversations.seniorId, userId))
			.orderBy(desc(schema.conversations.createdAt))
			.limit(limit);
	}

	findConversationsForDate(userId: string, start: Date, end: Date) {
		return this.database.db
			.select()
			.from(schema.conversations)
			.where(
				and(
					eq(schema.conversations.seniorId, userId),
					gte(schema.conversations.createdAt, start),
					lte(schema.conversations.createdAt, end),
				),
			)
			.orderBy(desc(schema.conversations.createdAt));
	}

	findSessionLogsForDate(userId: string, start: Date, end: Date) {
		return this.database.db
			.select()
			.from(schema.sessionLogs)
			.where(
				and(
					eq(schema.sessionLogs.seniorId, userId),
					gte(schema.sessionLogs.createdAt, start),
					lte(schema.sessionLogs.createdAt, end),
				),
			)
			.orderBy(desc(schema.sessionLogs.createdAt));
	}

	findConversationDatesForSeniors(seniorIds: string[]) {
		if (seniorIds.length === 0) return Promise.resolve([]);
		return this.database.db
			.select({
				seniorId: schema.conversations.seniorId,
				createdAt: schema.conversations.createdAt,
			})
			.from(schema.conversations)
			.where(inArray(schema.conversations.seniorId, seniorIds));
	}

	findSessionLogDatesForSeniors(seniorIds: string[]) {
		if (seniorIds.length === 0) return Promise.resolve([]);
		return this.database.db
			.select({
				seniorId: schema.sessionLogs.seniorId,
				createdAt: schema.sessionLogs.createdAt,
			})
			.from(schema.sessionLogs)
			.where(inArray(schema.sessionLogs.seniorId, seniorIds));
	}

	async createConversationRecord(userId: string) {
		await this.database.db
			.update(schema.senior)
			.set({
				conversationsNumber: sql`coalesce(${schema.senior.conversationsNumber}, 0) + 1`,
			})
			.where(eq(schema.senior.userId, userId));
	}

	updateSeniorNickname(userId: string, nickname: string) {
		return this.database.db
			.update(schema.senior)
			.set({ nickname })
			.where(eq(schema.senior.userId, userId));
	}

	updateSeniorProfile(userId: string, data: SeniorProfileUpdateRequest) {
		return this.database.db
			.update(schema.senior)
			.set({
				...(data.fullName !== undefined ? { fullname: data.fullName } : {}),
				...(data.birthDate !== undefined ? { birthdate: data.birthDate } : {}),
				...(data.family !== undefined ? { family: data.family } : {}),
				...(data.gender !== undefined ? { gender: data.gender } : {}),
				...(data.diagnoses !== undefined ? { diagnoses: data.diagnoses } : {}),
				...(data.avoidTopics !== undefined
					? { avoidTopics: data.avoidTopics }
					: {}),
				...(data.photoDataUrl !== undefined
					? { photoDataUrl: data.photoDataUrl }
					: {}),
			})
			.where(eq(schema.senior.userId, userId));
	}

	findSeniorSettings(userId: string) {
		return this.database.db.query.seniorSettings.findFirst({
			where: eq(schema.seniorSettings.seniorId, userId),
		});
	}

	async ensureSeniorSettings(userId: string) {
		const [result] = await this.database.db
			.insert(schema.seniorSettings)
			.values({
				seniorId: userId,
				silenceTimeoutMs: 2500,
				chatPersonality: "informal",
			})
			.onConflictDoNothing({ target: schema.seniorSettings.seniorId })
			.returning();

		return result ?? await this.findSeniorSettings(userId)!;
	}

	async updateSeniorSettings(
		userId: string,
		payload: SeniorSettingsUpdateRequest,
	) {
		const [updated] = await this.database.db
			.update(schema.seniorSettings)
			.set({
				...(payload.silenceTimeoutMs !== undefined
					? { silenceTimeoutMs: payload.silenceTimeoutMs }
					: {}),
				...(payload.chatPersonality !== undefined
					? { chatPersonality: payload.chatPersonality }
					: {}),
				updatedAt: new Date(),
			})
			.where(eq(schema.seniorSettings.seniorId, userId))
			.returning();
		return updated;
	}
}
