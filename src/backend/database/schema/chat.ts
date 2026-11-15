import { sql } from "drizzle-orm";
import {
	boolean,
	customType,
	index,
	integer,
	jsonb,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";
import { caregiver, senior } from "./profiles";

export type ConversationTranscriptTurn = {
	role: "assistant" | "user";
	content: string;
	timestamp: string;
};

const vector = customType<{ data: number[]; driverData: string }>({
	dataType() {
		return "vector(1536)";
	},
	toDriver(value: number[]): string {
		return `[${value.join(",")}]`;
	},
	fromDriver(value: string): number[] {
		return value.replace(/^\[/, "").replace(/\]$/, "").split(",").map(Number);
	},
});

export const conversations = pgTable(
	"conversations",
	{
		id: uuid("ID").primaryKey().defaultRandom(),
		seniorId: uuid("senior_id").references(() => senior.userId, {
			onDelete: "cascade",
		}),
		// Opaque key of the app visit that produced this conversation — unique so
		// only one conversation row is ever created per visit.
		sessionToken: text("session_token"),
		createdAt: timestamp("created_At").defaultNow().notNull(),
		updatedAt: timestamp("updated_At"),
		closedAt: timestamp("closed_At"),
		summary: text("summary"),
		keyPoints: text("keyPoints").array(),
		mainTopics: text("main_Topics").array(),
		emotionalTone: varchar("emotional_Tone", { length: 50 }),
		userOutcome: varchar("user_outcome", { length: 20 }).$type<
			"Sucesso" | "Cancelada" | "Falha"
		>(),
		userNote: text("user_note"),
		fullTranscript: jsonb("full_transcript")
			.$type<ConversationTranscriptTurn[]>()
			.notNull()
			.default(sql`'[]'::jsonb`),
	},
	(table) => ({
		seniorIdIdx: index("conversations_senior_id_idx").on(table.seniorId),
		createdAtIdx: index("conversations_created_at_idx").on(table.createdAt),
		seniorIdCreatedAtIdx: index("conversations_senior_id_created_at_idx").on(
			table.seniorId,
			table.createdAt,
		),
		sessionTokenUnique: uniqueIndex("conversations_session_token_unique").on(
			table.sessionToken,
		),
	}),
);

export const messages = pgTable(
	"messages",
	{
		id: uuid("ID").primaryKey().defaultRandom(),
		conversationId: uuid("conversation_id").references(() => conversations.id, {
			onDelete: "cascade",
		}),
		sender: varchar("sender", { length: 20 })
			.$type<"assistant" | "user">()
			.notNull(),
		content: text("content"),
		timestamp: timestamp("timestamp").defaultNow().notNull(),
		sentimentScore: integer("sentiment_Score"),
	},
	(table) => ({
		conversationIdIdx: index("messages_conversation_id_idx").on(
			table.conversationId,
		),
		conversationIdTimestampIdx: index(
			"messages_conversation_id_timestamp_idx",
		).on(table.conversationId, table.timestamp),
	}),
);

export const sessionLogs = pgTable(
	"session_logs",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		seniorId: uuid("senior_id")
			.notNull()
			.references(() => senior.userId, { onDelete: "cascade" }),
		outcome: varchar("outcome", { length: 20 })
			.$type<"Sucesso" | "Cancelada" | "Falha" | "Abandonada">()
			.notNull(),
		note: text("note"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => ({
		seniorIdIdx: index("session_logs_senior_id_idx").on(table.seniorId),
	}),
);

export const caregiverNotes = pgTable(
	"caregiver_notes",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		seniorId: uuid("senior_id")
			.notNull()
			.references(() => senior.userId, {
				onDelete: "cascade",
			}),
		// Null for notes the person wrote about themselves during onboarding.
		caregiverId: uuid("caregiver_id").references(() => caregiver.userId, {
			onDelete: "cascade",
		}),
		content: text("content").notNull(),
		category: varchar("category", { length: 32 }),
		pinned: boolean("pinned").default(false).notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => ({
		seniorIdIdx: index("caregiver_notes_senior_id_idx").on(table.seniorId),
	}),
);

export const seniorInsights = pgTable(
	"senior_insights",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		seniorId: uuid("senior_id")
			.notNull()
			.references(() => senior.userId, { onDelete: "cascade" }),
		content: text("content").notNull(),
		embedding: vector("embedding").notNull(),
		sourceConversationId: uuid("source_conversation_id"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => ({
		seniorIdIdx: index("senior_insights_senior_id_idx").on(table.seniorId),
	}),
);
