import { randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import type { OnModuleInit } from "@nestjs/common";
import { count, eq } from "drizzle-orm";
import { DatabaseService, schema } from "@/backend/database/database.service";
import type { LocalSession } from "@/shared/contracts";
import { ensureLocalUser } from "./ensure-local-user";

const VISIT_KEY_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Compy runs without accounts: every request belongs to one local user that
 * is created on first startup and stored in the database, so conversations,
 * games and onboarding answers persist between runs.
 */
@Injectable()
export class LocalUserService implements OnModuleInit {
	private userId: string | null = null;
	// Used when the client does not send a visit key (e.g. API calls from docs).
	private readonly fallbackVisitKey = randomUUID();

	constructor(
		@Inject(DatabaseService)
		private readonly database: DatabaseService,
	) {}

	async onModuleInit() {
		this.userId = await ensureLocalUser(this.database.db);
	}

	private async getUserId() {
		if (!this.userId) {
			this.userId = await ensureLocalUser(this.database.db);
		}
		return this.userId;
	}

	/**
	 * Builds the session object every controller receives. `visitKey` is the
	 * id the browser generates on each page load; all turns of one visit are
	 * stored in the same conversation.
	 */
	async getSession(visitKey?: string | null): Promise<LocalSession> {
		const db = this.database.db;
		const userId = await this.getUserId();

		const [user, profile, likes, [conversations]] = await Promise.all([
			db.query.users.findFirst({ where: eq(schema.users.id, userId) }),
			db.query.senior.findFirst({ where: eq(schema.senior.userId, userId) }),
			db.query.seniorLikes.findFirst({
				where: eq(schema.seniorLikes.seniorId, userId),
			}),
			db
				.select({ total: count() })
				.from(schema.conversations)
				.where(eq(schema.conversations.seniorId, userId)),
		]);

		if (!user) {
			// The row was removed while the server was running — recreate it.
			this.userId = null;
			return this.getSession(visitKey);
		}

		const key =
			visitKey && VISIT_KEY_PATTERN.test(visitKey)
				? visitKey.toLowerCase()
				: this.fallbackVisitKey;

		return {
			sessionId: `visit:${key}`,
			user: {
				id: user.id,
				email: user.email,
				name: profile?.fullname?.trim() || profile?.nickname?.trim() || "",
				role: "senior",
				accessCode: user.username,
				likes: likes
					? {
							football: likes.football ?? [],
							music: likes.music ?? [],
							cinema: likes.cinema ?? [],
							gastronomy: likes.gastronomy ?? [],
							hobbies: likes.hobbies ?? [],
							others: {},
						}
					: undefined,
				birthDate: profile?.birthdate
					? new Date(profile.birthdate).toISOString()
					: undefined,
				nickname: profile?.nickname ?? undefined,
				conversationCount: conversations?.total ?? 0,
				termsAcceptedAt: user.termsAcceptedAt?.toISOString(),
				gender: (profile?.gender as "m" | "f" | undefined) ?? undefined,
			},
		};
	}

	/**
	 * Marks onboarding as finished so the next app start goes straight to the
	 * conversation screen.
	 */
	async completeOnboarding(visitKey?: string | null): Promise<LocalSession> {
		const db = this.database.db;
		const userId = await this.getUserId();

		await db
			.update(schema.users)
			.set({ termsAcceptedAt: new Date() })
			.where(eq(schema.users.id, userId));

		// Onboarding only asks how the person wants to be addressed; reuse that
		// as the profile name when none was given.
		const profile = await db.query.senior.findFirst({
			where: eq(schema.senior.userId, userId),
		});
		if (profile && !profile.fullname?.trim() && profile.nickname?.trim()) {
			await db
				.update(schema.senior)
				.set({ fullname: profile.nickname.trim() })
				.where(eq(schema.senior.userId, userId));
		}

		return this.getSession(visitKey);
	}
}
