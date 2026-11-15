import { Inject, Injectable } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { DatabaseService, schema } from "@/backend/database/database.service";

@Injectable()
export class LocationsService {
	constructor(
		@Inject(DatabaseService)
		private readonly database: DatabaseService,
	) {}

	async createLocationForUser(designation: string, userId: string) {
		const [institution] = await this.database.db
			.insert(schema.institutions)
			.values({
				designation,
			})
			.returning();

		await this.database.db
			.update(schema.users)
			.set({
				organizationId: institution.id,
			})
			.where(eq(schema.users.id, userId));

		return institution.id;
	}

	async findFirstOwnedLocation(userId: string) {
		const [user] = await this.database.db
			.select({ location_id: schema.users.organizationId })
			.from(schema.users)
			.where(eq(schema.users.id, userId))
			.limit(1);

		if (!user?.location_id) {
			return null;
		}

		return user;
	}

	async hasAccessToLocation(userId: string, locationId: string) {
		const [access] = await this.database.db
			.select({ id: schema.users.id })
			.from(schema.users)
			.where(
				and(
					eq(schema.users.id, userId),
					eq(schema.users.organizationId, locationId),
				),
			)
			.limit(1);

		return Boolean(access);
	}
}
