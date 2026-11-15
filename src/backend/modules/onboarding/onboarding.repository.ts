import { Inject, Injectable } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { DatabaseService, schema } from "@/backend/database/database.service";

@Injectable()
export class OnboardingRepository {
	constructor(
		@Inject(DatabaseService)
		private readonly database: DatabaseService,
	) {}

	findUserByEmail(email: string) {
		return this.database.db.query.users.findFirst({
			where: eq(schema.users.email, email),
		});
	}

	updateUserEmail(userId: string, email: string) {
		return this.database.db
			.update(schema.users)
			.set({ email })
			.where(eq(schema.users.id, userId));
	}

	updateSeniorProfile(
		userId: string,
		input: { fullName: string; nickname: string; birthdate: string | null },
	) {
		return this.database.db
			.update(schema.senior)
			.set({
				fullname: input.fullName,
				nickname: input.nickname,
				birthdate: input.birthdate,
			})
			.where(eq(schema.senior.userId, userId));
	}

	createSeniorProfile(input: {
		userId: string;
		fullName: string;
		nickname: string;
		birthdate: string | null;
	}) {
		return this.database.db
			.insert(schema.senior)
			.values({
				userId: input.userId,
				fullname: input.fullName,
				nickname: input.nickname,
				birthdate: input.birthdate,
			});
	}

	async createSeniorAccount(input: {
		locationId: string;
		email: string;
		username: string;
		passwordHash: string;
		fullName: string;
		nickname: string;
		birthdate: string | null;
	}) {
		const [user] = await this.database.db
			.insert(schema.users)
			.values({
				organizationId: input.locationId,
				email: input.email,
				username: input.username,
				passwordHash: input.passwordHash,
				role: "senior",
			})
			.returning();

		await this.database.db.insert(schema.senior).values({
			userId: user.id,
			fullname: input.fullName,
			nickname: input.nickname,
			birthdate: input.birthdate,
		});

		return user;
	}

	assignSeniorToLocation(userId: string, locationId: string) {
		return this.database.db
			.update(schema.users)
			.set({ organizationId: locationId })
			.where(eq(schema.users.id, userId));
	}

	findSeniorByAccessCode(accessCode: string) {
		return this.database.db.query.users.findFirst({
			where: and(
				eq(schema.users.username, accessCode),
				eq(schema.users.role, "senior"),
			),
		});
	}

	clearSeniorLocation(userId: string) {
		return this.database.db
			.update(schema.users)
			.set({ organizationId: null })
			.where(eq(schema.users.id, userId));
	}

	findUserOrganization(userId: string) {
		return this.database.db.query.users.findFirst({
			columns: { organizationId: true },
			where: eq(schema.users.id, userId),
		});
	}

	findLocationCaregiverName(locationId: string) {
		return this.database.db
			.select({
				name: schema.caregiver.fullName,
			})
			.from(schema.caregiver)
			.innerJoin(schema.users, eq(schema.users.id, schema.caregiver.userId))
			.where(
				and(
					eq(schema.users.organizationId, locationId),
					eq(schema.users.role, "caregiver"),
				),
			)
			.limit(1)
			.then((rows) => rows[0] ?? null);
	}
}
