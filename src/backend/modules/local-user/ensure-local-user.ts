import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "@/backend/database/schema";
import { generateAccessCode } from "@/backend/common/utils";

/**
 * Marker that identifies the one local user of this installation. It is not
 * a mailbox and nothing is ever sent to it.
 */
export const LOCAL_USER_EMAIL = "local@compy.local";

/**
 * Returns the local user's id, creating the user row, senior profile and
 * default settings on the very first run. Idempotent and safe to call on
 * every startup.
 */
export async function ensureLocalUser(
	db: NodePgDatabase<typeof schema>,
): Promise<string> {
	let user = await db.query.users.findFirst({
		where: eq(schema.users.email, LOCAL_USER_EMAIL),
	});

	if (!user) {
		const [created] = await db
			.insert(schema.users)
			.values({
				email: LOCAL_USER_EMAIL,
				username: generateAccessCode(),
				role: "senior",
			})
			.onConflictDoNothing({ target: schema.users.email })
			.returning();
		user =
			created ??
			(await db.query.users.findFirst({
				where: eq(schema.users.email, LOCAL_USER_EMAIL),
			}));
	}

	if (!user) {
		throw new Error("LOCAL_USER_BOOTSTRAP_FAILED");
	}

	await db
		.insert(schema.senior)
		.values({ userId: user.id })
		.onConflictDoNothing({ target: schema.senior.userId });
	await db
		.insert(schema.seniorSettings)
		.values({ seniorId: user.id })
		.onConflictDoNothing({ target: schema.seniorSettings.seniorId });

	return user.id;
}
