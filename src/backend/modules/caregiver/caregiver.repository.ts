import { Inject, Injectable } from "@nestjs/common";
import { and, count, desc, eq, gte, inArray, max } from "drizzle-orm";
import { DatabaseService, schema } from "@/backend/database/database.service";
import { institutions } from "@/backend/database/schema/auth";
import { generateAccessCode } from "@/backend/common/utils";

@Injectable()
export class CaregiverRepository {
	constructor(
		@Inject(DatabaseService)
		private readonly database: DatabaseService,
	) {}

	findUser(userId: string) {
		return this.database.db.query.users.findFirst({
			where: eq(schema.users.id, userId),
		});
	}

	listSeniorsByOrganization(organizationId: string) {
		return this.database.db
			.select({
				seniorId: schema.senior.userId,
				fullName: schema.senior.fullname,
				nickname: schema.senior.nickname,
				photoDataUrl: schema.senior.photoDataUrl,
				institutionName: institutions.designation,
				accessCode: schema.users.username,
			})
			.from(schema.senior)
			.innerJoin(schema.users, eq(schema.users.id, schema.senior.userId))
			.leftJoin(institutions, eq(institutions.id, schema.users.organizationId))
			.where(eq(schema.users.organizationId, organizationId))
			.orderBy(desc(schema.senior.userId));
	}

	findConversationsForSeniors(seniorIds: string[]) {
		if (seniorIds.length === 0) {
			return Promise.resolve([]);
		}

		return this.database.db
			.select({
				id: schema.conversations.id,
				seniorId: schema.conversations.seniorId,
				createdAt: schema.conversations.createdAt,
				closedAt: schema.conversations.closedAt,
				summary: schema.conversations.summary,
			})
			.from(schema.conversations)
			.where(inArray(schema.conversations.seniorId, seniorIds));
	}

	findConversationsForDailyOverview(seniorIds: string[]) {
		if (seniorIds.length === 0) {
			return Promise.resolve([]);
		}

		const since = new Date();
		since.setDate(since.getDate() - 90);

		return this.database.db
			.select({
				id: schema.conversations.id,
				seniorId: schema.conversations.seniorId,
				createdAt: schema.conversations.createdAt,
				closedAt: schema.conversations.closedAt,
				summary: schema.conversations.summary,
				emotionalTone: schema.conversations.emotionalTone,
				userOutcome: schema.conversations.userOutcome,
			})
			.from(schema.conversations)
			.where(and(
				inArray(schema.conversations.seniorId, seniorIds),
				gte(schema.conversations.createdAt, since),
			))
			.orderBy(desc(schema.conversations.createdAt));
	}

	findCaregiverNotesForSeniors(seniorIds: string[]) {
		if (seniorIds.length === 0) {
			return Promise.resolve([]);
		}

		return this.database.db
			.select({
				id: schema.caregiverNotes.id,
				seniorId: schema.caregiverNotes.seniorId,
				caregiverId: schema.caregiverNotes.caregiverId,
				content: schema.caregiverNotes.content,
				category: schema.caregiverNotes.category,
				pinned: schema.caregiverNotes.pinned,
				createdAt: schema.caregiverNotes.createdAt,
			})
			.from(schema.caregiverNotes)
			.where(inArray(schema.caregiverNotes.seniorId, seniorIds))
			.orderBy(desc(schema.caregiverNotes.createdAt));
	}

	findSessionLogsForDailyOverview(seniorIds: string[]) {
		if (seniorIds.length === 0) {
			return Promise.resolve([]);
		}

		const since = new Date();
		since.setDate(since.getDate() - 90);

		return this.database.db
			.select({
				id: schema.sessionLogs.id,
				seniorId: schema.sessionLogs.seniorId,
				outcome: schema.sessionLogs.outcome,
				note: schema.sessionLogs.note,
				createdAt: schema.sessionLogs.createdAt,
			})
			.from(schema.sessionLogs)
			.where(and(
				inArray(schema.sessionLogs.seniorId, seniorIds),
				gte(schema.sessionLogs.createdAt, since),
			))
			.orderBy(desc(schema.sessionLogs.createdAt));
	}

	findConversationSummaryForSeniors(seniorIds: string[]) {
		if (seniorIds.length === 0) {
			return Promise.resolve([]);
		}

		return this.database.db
			.select({
				seniorId: schema.conversations.seniorId,
				count: count(),
				lastConversationAt: max(schema.conversations.createdAt),
			})
			.from(schema.conversations)
			.where(inArray(schema.conversations.seniorId, seniorIds))
			.groupBy(schema.conversations.seniorId);
	}

	findConversationsForSenior(seniorId: string) {
		return this.database.db
			.select({
				id: schema.conversations.id,
				seniorId: schema.conversations.seniorId,
				createdAt: schema.conversations.createdAt,
				closedAt: schema.conversations.closedAt,
				summary: schema.conversations.summary,
			})
			.from(schema.conversations)
			.where(eq(schema.conversations.seniorId, seniorId))
			.orderBy(desc(schema.conversations.createdAt));
	}

	findCaregiverNotesForSenior(seniorId: string) {
		return this.database.db
			.select({
				id: schema.caregiverNotes.id,
				seniorId: schema.caregiverNotes.seniorId,
				caregiverId: schema.caregiverNotes.caregiverId,
				content: schema.caregiverNotes.content,
				category: schema.caregiverNotes.category,
				pinned: schema.caregiverNotes.pinned,
				createdAt: schema.caregiverNotes.createdAt,
			})
			.from(schema.caregiverNotes)
			.where(eq(schema.caregiverNotes.seniorId, seniorId))
			.orderBy(desc(schema.caregiverNotes.createdAt));
	}

	async createCaregiverNote(input: {
		seniorId: string;
		caregiverId: string;
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

	async updateCaregiverNote(input: {
		noteId: string;
		seniorId: string;
		content?: string;
		category?: string | null;
		pinned?: boolean;
	}) {
		const values: {
			content?: string;
			category?: string | null;
			pinned?: boolean;
		} = {};

		if (input.content !== undefined) values.content = input.content;
		if (input.category !== undefined) values.category = input.category;
		if (input.pinned !== undefined) values.pinned = input.pinned;

		const [updated] = await this.database.db
			.update(schema.caregiverNotes)
			.set(values)
			.where(and(
				eq(schema.caregiverNotes.id, input.noteId),
				eq(schema.caregiverNotes.seniorId, input.seniorId),
			))
			.returning();

		return updated ?? null;
	}

	async deleteCaregiverNote(input: {
		noteId: string;
		seniorId: string;
	}) {
		const [deleted] = await this.database.db
			.delete(schema.caregiverNotes)
			.where(and(
				eq(schema.caregiverNotes.id, input.noteId),
				eq(schema.caregiverNotes.seniorId, input.seniorId),
			))
			.returning({ id: schema.caregiverNotes.id });

		return deleted ?? null;
	}

	findUserWithInstitution(userId: string) {
		return this.database.db
			.select({
				userId: schema.users.id,
				email: schema.users.email,
				organizationId: schema.users.organizationId,
				institutionType: institutions.type,
				institutionDesignation: institutions.designation,
			})
			.from(schema.users)
			.leftJoin(institutions, eq(institutions.id, schema.users.organizationId))
			.where(eq(schema.users.id, userId))
			.then((rows) => rows[0] ?? null);
	}

	findUserByEmail(email: string) {
		return this.database.db.query.users.findFirst({
			where: eq(schema.users.email, email),
		});
	}

	async updateUserEmail(userId: string, email: string) {
		await this.database.db
			.update(schema.users)
			.set({ email })
			.where(eq(schema.users.id, userId));
	}

	async updateCaregiverFullName(userId: string, fullName: string) {
		const existing = await this.database.db.query.caregiver.findFirst({
			where: eq(schema.caregiver.userId, userId),
		});
		if (existing) {
			await this.database.db
				.update(schema.caregiver)
				.set({ fullName })
				.where(eq(schema.caregiver.userId, userId));
		} else {
			await this.database.db
				.insert(schema.caregiver)
				.values({ userId, fullName });
		}
	}

	async createFamilySenior(input: {
		organizationId: string;
		fullName: string;
		gender: "m" | "f" | null;
		birthdate: string;
	}) {
		const accessCode = generateAccessCode();
		const email = `${accessCode.toLowerCase()}@compy.local`;

		const [user] = await this.database.db
			.insert(schema.users)
			.values({
				email,
				username: accessCode,
				passwordHash: "$NO_PIN$",
				role: "senior",
				organizationId: input.organizationId,
			})
			.returning();

		await this.database.db
			.insert(schema.senior)
			.values({
				userId: user.id,
				fullname: input.fullName,
				nickname: null,
				birthdate: input.birthdate,
				gender: input.gender ?? null,
				cognitiveLevel: 2,
				conversationsNumber: 2,
			});

		await this.database.db
			.insert(schema.seniorSettings)
			.values({
				seniorId: user.id,
				silenceTimeoutMs: 2500,
				chatPersonality: "informal",
			});

		return { userId: user.id, accessCode };
	}
}
