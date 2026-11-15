import {
	date,
	index,
	integer,
	pgTable,
	text,
	timestamp,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./auth";

export const caregiver = pgTable("caregiver", {
	userId: uuid("user_id")
		.primaryKey()
		.references(() => users.id, { onDelete: "cascade" }),
	fullName: text("full_name"),
});

export const senior = pgTable("senior", {
	userId: uuid("user_id")
		.primaryKey()
		.references(() => users.id, { onDelete: "cascade" }),
	fullname: text("fullname"),
	nickname: text("nickname"),
	photoDataUrl: text("photo_data_url"),
	birthdate: date("birthdate", { mode: "string" }),
	cognitiveLevel: integer("cognitive_level"),
	conversationsNumber: integer("conversations_number").default(0),
	family: text("family"),
	gender: varchar("gender", { length: 1 }),
	diagnoses: text("diagnoses").array().default(sql`'{}'::text[]`),
	avoidTopics: text("avoid_topics").array().default(sql`'{}'::text[]`),
});

export const seniorLikes = pgTable(
	"resident_likes",
	{
		id: uuid("ID").primaryKey().defaultRandom(),
		seniorId: uuid("senior_id")
			.unique()
			.references(() => senior.userId, {
				onDelete: "cascade",
			}),
		football: text("football").array().default([]).notNull(),
		music: text("music").array().default([]).notNull(),
		cinema: text("cinema").array().default([]).notNull(),
		gastronomy: text("gastronomy").array().default([]).notNull(),
		hobbies: text("hobbies").array().default([]).notNull(),
	},
	(table) => ({
		seniorIdIdx: index("senior_likes_senior_id_idx").on(table.seniorId),
	}),
);

export const seniorSettings = pgTable("senior_settings", {
	id: uuid("id").primaryKey().defaultRandom(),
	seniorId: uuid("senior_id")
		.notNull()
		.unique()
		.references(() => senior.userId, { onDelete: "cascade" }),
	silenceTimeoutMs: integer("silence_timeout_ms").notNull().default(2500),
	chatPersonality: varchar("chat_personality", { length: 20 })
		.$type<"formal" | "informal">()
		.notNull()
		.default("informal"),
	createdAt: timestamp("created_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
});
