import { Inject, Injectable } from "@nestjs/common";
import { and, asc, count, eq, isNull } from "drizzle-orm";
import { DatabaseService, schema } from "@/backend/database/database.service";
import type { CreatePlanRequest, UpdatePlanRequest } from "@/shared/contracts";

@Injectable()
export class AdminRepository {
	constructor(
		@Inject(DatabaseService)
		private readonly database: DatabaseService,
	) {}

	private readonly institutionSelect = {
		id: schema.institutions.id,
		type: schema.institutions.type,
		designation: schema.institutions.designation,
		location: schema.institutions.location,
		planId: schema.institutions.planId,
		planName: schema.plans.name,
		createdAt: schema.institutions.createdAt,
	};

	listInstitutions() {
		return this.database.db
			.select(this.institutionSelect)
			.from(schema.institutions)
			.leftJoin(schema.plans, eq(schema.plans.id, schema.institutions.planId))
			.orderBy(asc(schema.institutions.designation));
	}

	findInstitution(id: string) {
		return this.database.db
			.select(this.institutionSelect)
			.from(schema.institutions)
			.leftJoin(schema.plans, eq(schema.plans.id, schema.institutions.planId))
			.where(eq(schema.institutions.id, id))
			.then((rows) => rows[0] ?? null);
	}

	async createInstitution(input: {
		type: "ipss" | "family";
		designation: string;
		location?: string | null;
		planId?: string | null;
	}) {
		const [row] = await this.database.db
			.insert(schema.institutions)
			.values({
				type: input.type,
				designation: input.designation,
				location: input.location ?? null,
				planId: input.planId ?? null,
			})
			.returning({ id: schema.institutions.id });
		return this.findInstitution(row!.id);
	}

	findInstitutionById(id: string) {
		return this.database.db.query.institutions.findFirst({
			where: eq(schema.institutions.id, id),
		});
	}

	deleteInstitution(id: string) {
		return this.database.db
			.delete(schema.institutions)
			.where(eq(schema.institutions.id, id));
	}

	async updateInstitution(
		id: string,
		input: {
			designation?: string;
			location?: string | null;
			planId?: string | null;
		},
	) {
		await this.database.db
			.update(schema.institutions)
			.set(input)
			.where(eq(schema.institutions.id, id));
		return this.findInstitution(id);
	}

	// ── Plans ────────────────────────────────────────────────────────────────

	listPlans() {
		return this.database.db
			.select()
			.from(schema.plans)
			.orderBy(asc(schema.plans.name));
	}

	findPlanById(id: string) {
		return this.database.db.query.plans.findFirst({
			where: eq(schema.plans.id, id),
		});
	}

	findPlanByName(name: string) {
		return this.database.db.query.plans.findFirst({
			where: eq(schema.plans.name, name),
		});
	}

	async createPlan(input: CreatePlanRequest) {
		const [plan] = await this.database.db
			.insert(schema.plans)
			.values({
				name: input.name,
				maxSeniors: input.maxSeniors ?? null,
				maxTalkingMinutesPerMonth: input.maxTalkingMinutesPerMonth ?? null,
			})
			.returning();
		return plan!;
	}

	async updatePlan(id: string, input: UpdatePlanRequest) {
		const [plan] = await this.database.db
			.update(schema.plans)
			.set({
				...(input.name !== undefined ? { name: input.name } : {}),
				...(input.maxSeniors !== undefined
					? { maxSeniors: input.maxSeniors }
					: {}),
				...(input.maxTalkingMinutesPerMonth !== undefined
					? { maxTalkingMinutesPerMonth: input.maxTalkingMinutesPerMonth }
					: {}),
			})
			.where(eq(schema.plans.id, id))
			.returning();
		return plan ?? null;
	}

	deletePlan(id: string) {
		return this.database.db.delete(schema.plans).where(eq(schema.plans.id, id));
	}

	async countInstitutionsWithPlan(planId: string) {
		const [row] = await this.database.db
			.select({ total: count() })
			.from(schema.institutions)
			.where(eq(schema.institutions.planId, planId));
		return row?.total ?? 0;
	}

	findUserByEmail(email: string) {
		return this.database.db.query.users.findFirst({
			where: eq(schema.users.email, email),
		});
	}

	findUserById(id: string) {
		return this.database.db.query.users.findFirst({
			where: eq(schema.users.id, id),
		});
	}

	async createUser(input: {
		email: string;
		username: string;
		passwordHash: string;
		role: "caregiver" | "senior";
		organizationId?: string | null;
	}) {
		const [user] = await this.database.db
			.insert(schema.users)
			.values({
				email: input.email,
				username: input.username,
				passwordHash: input.passwordHash,
				role: input.role,
				organizationId: input.organizationId ?? null,
			})
			.returning();
		return user;
	}

	async updateUser(
		userId: string,
		input: Partial<{
			email: string;
			username: string;
			passwordHash: string;
			organizationId: string | null;
			isActive: boolean;
		}>,
	) {
		const [user] = await this.database.db
			.update(schema.users)
			.set(input)
			.where(eq(schema.users.id, userId))
			.returning();
		return user;
	}

	deactivateUser(userId: string) {
		return this.database.db
			.update(schema.users)
			.set({ isActive: false })
			.where(eq(schema.users.id, userId));
	}

	hardDeleteUser(userId: string) {
		return this.database.db
			.delete(schema.users)
			.where(eq(schema.users.id, userId));
	}

	async hardDeleteInstitutionWithMembers(institutionId: string) {
		return this.database.db.transaction(async (tx) => {
			await tx
				.delete(schema.users)
				.where(eq(schema.users.organizationId, institutionId));
			await tx
				.delete(schema.institutions)
				.where(eq(schema.institutions.id, institutionId));
		});
	}

	createCaregiverProfile(userId: string, fullName: string) {
		return this.database.db.insert(schema.caregiver).values({
			userId,
			fullName,
		});
	}

	async updateCaregiverProfile(userId: string, fullName: string) {
		const [caregiver] = await this.database.db
			.update(schema.caregiver)
			.set({
				fullName,
			})
			.where(eq(schema.caregiver.userId, userId))
			.returning();
		return caregiver;
	}

	createSeniorProfile(input: {
		userId: string;
		fullName: string;
		nickname: string | null;
		birthdate: string;
		gender: string | null;
	}) {
		return this.database.db.insert(schema.senior).values({
			userId: input.userId,
			fullname: input.fullName,
			nickname: input.nickname,
			birthdate: input.birthdate,
			gender: input.gender,
		});
	}

	async updateSeniorProfile(
		userId: string,
		input: Partial<{
			fullname: string;
			nickname: string;
			birthdate: string;
			gender: string;
		}>,
	) {
		const [senior] = await this.database.db
			.update(schema.senior)
			.set(input)
			.where(eq(schema.senior.userId, userId))
			.returning();
		return senior;
	}

	async createSeniorSettings(userId: string) {
		await this.database.db.insert(schema.seniorSettings).values({
			seniorId: userId,
			silenceTimeoutMs: 2500,
			chatPersonality: "informal",
		});
	}

	listCaregivers() {
		return this.database.db
			.select({
				id: schema.users.id,
				email: schema.users.email,
				fullName: schema.caregiver.fullName,
				organizationId: schema.users.organizationId,
				organizationName: schema.institutions.designation,
				isActive: schema.users.isActive,
				createdAt: schema.users.createdAt,
			})
			.from(schema.users)
			.innerJoin(schema.caregiver, eq(schema.caregiver.userId, schema.users.id))
			.leftJoin(
				schema.institutions,
				eq(schema.institutions.id, schema.users.organizationId),
			)
			.orderBy(asc(schema.caregiver.fullName));
	}

	findCaregiverById(userId: string) {
		return this.database.db
			.select({
				id: schema.users.id,
				email: schema.users.email,
				fullName: schema.caregiver.fullName,
				organizationId: schema.users.organizationId,
				organizationName: schema.institutions.designation,
				isActive: schema.users.isActive,
				createdAt: schema.users.createdAt,
			})
			.from(schema.users)
			.innerJoin(schema.caregiver, eq(schema.caregiver.userId, schema.users.id))
			.leftJoin(
				schema.institutions,
				eq(schema.institutions.id, schema.users.organizationId),
			)
			.where(eq(schema.users.id, userId))
			.then((rows) => rows[0] ?? null);
	}

	listCaregiversByInstitution(institutionId: string) {
		return this.database.db
			.select({
				id: schema.users.id,
				email: schema.users.email,
				fullName: schema.caregiver.fullName,
				organizationId: schema.users.organizationId,
				organizationName: schema.institutions.designation,
				isActive: schema.users.isActive,
				createdAt: schema.users.createdAt,
			})
			.from(schema.users)
			.innerJoin(schema.caregiver, eq(schema.caregiver.userId, schema.users.id))
			.leftJoin(
				schema.institutions,
				eq(schema.institutions.id, schema.users.organizationId),
			)
			.where(eq(schema.users.organizationId, institutionId))
			.orderBy(asc(schema.caregiver.fullName));
	}

	listSeniors() {
		return this.database.db
			.select({
				id: schema.users.id,
				email: schema.users.email,
				fullName: schema.senior.fullname,
				nickname: schema.senior.nickname,
				birthDate: schema.senior.birthdate,
				gender: schema.senior.gender,
				accessCode: schema.users.username,
				organizationId: schema.users.organizationId,
				organizationName: schema.institutions.designation,
				isActive: schema.users.isActive,
				createdAt: schema.users.createdAt,
			})
			.from(schema.users)
			.innerJoin(schema.senior, eq(schema.senior.userId, schema.users.id))
			.leftJoin(
				schema.institutions,
				eq(schema.institutions.id, schema.users.organizationId),
			)
			.orderBy(asc(schema.senior.fullname));
	}

	findSeniorById(userId: string) {
		return this.database.db
			.select({
				id: schema.users.id,
				email: schema.users.email,
				fullName: schema.senior.fullname,
				nickname: schema.senior.nickname,
				birthDate: schema.senior.birthdate,
				gender: schema.senior.gender,
				accessCode: schema.users.username,
				organizationId: schema.users.organizationId,
				organizationName: schema.institutions.designation,
				isActive: schema.users.isActive,
				createdAt: schema.users.createdAt,
			})
			.from(schema.users)
			.innerJoin(schema.senior, eq(schema.senior.userId, schema.users.id))
			.leftJoin(
				schema.institutions,
				eq(schema.institutions.id, schema.users.organizationId),
			)
			.where(eq(schema.users.id, userId))
			.then((rows) => rows[0] ?? null);
	}

	listSeniorsByInstitution(institutionId: string) {
		return this.database.db
			.select({
				id: schema.users.id,
				email: schema.users.email,
				fullName: schema.senior.fullname,
				nickname: schema.senior.nickname,
				birthDate: schema.senior.birthdate,
				gender: schema.senior.gender,
				accessCode: schema.users.username,
				organizationId: schema.users.organizationId,
				organizationName: schema.institutions.designation,
				isActive: schema.users.isActive,
				createdAt: schema.users.createdAt,
			})
			.from(schema.users)
			.innerJoin(schema.senior, eq(schema.senior.userId, schema.users.id))
			.leftJoin(
				schema.institutions,
				eq(schema.institutions.id, schema.users.organizationId),
			)
			.where(eq(schema.users.organizationId, institutionId))
			.orderBy(asc(schema.senior.fullname));
	}

	async countInstitutions() {
		const [row] = await this.database.db
			.select({ total: count() })
			.from(schema.institutions);
		return row?.total ?? 0;
	}

	async countUsersByRole(role: "caregiver" | "senior") {
		const [row] = await this.database.db
			.select({ total: count() })
			.from(schema.users)
			.where(eq(schema.users.role, role));
		return row?.total ?? 0;
	}

	async countActiveUsers() {
		const [row] = await this.database.db
			.select({ total: count() })
			.from(schema.users)
			.where(eq(schema.users.isActive, true));
		return row?.total ?? 0;
	}

	async countConversations() {
		const [row] = await this.database.db
			.select({ total: count() })
			.from(schema.conversations);
		return row?.total ?? 0;
	}

	async countUsersWithoutInstitution(role: "caregiver" | "senior") {
		const [row] = await this.database.db
			.select({ total: count() })
			.from(schema.users)
			.where(
				and(eq(schema.users.role, role), isNull(schema.users.organizationId)),
			);
		return row?.total ?? 0;
	}

	async countUsersAssignedToInstitution(institutionId: string) {
		const [row] = await this.database.db
			.select({ total: count() })
			.from(schema.users)
			.where(eq(schema.users.organizationId, institutionId));
		return row?.total ?? 0;
	}
}
