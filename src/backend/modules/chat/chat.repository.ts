import { Inject, Injectable } from "@nestjs/common";
import { asc, desc, eq, sql } from "drizzle-orm";
import { DatabaseService, schema } from "@/backend/database/database.service";
import type { ConversationTranscriptTurn } from "@/backend/database/schema/chat";
import { getEmbedding } from "@/shared/embeddings";

type TranscriptMessage = Pick<ConversationTranscriptTurn, "content" | "role">;
type PersistedTurnInput = {
	role: "assistant" | "user";
	content: string;
};

@Injectable()
export class ChatRepository {
	constructor(
		@Inject(DatabaseService)
		private readonly database: DatabaseService,
	) {}

	findConversation(conversationId: string) {
		return this.database.db.query.conversations.findFirst({
			where: eq(schema.conversations.id, conversationId),
		});
	}

	/**
	 * Returns the conversation for this app visit, creating one if it does
	 * not yet exist. Idempotent: safe to call on every turn — stop/start presses,
	 * retries, and concurrent requests all resolve to the same row.
	 *
	 * The unique index on session_token is the hard DB-level guarantee;
	 * the SELECT-first path avoids the write in the common case.
	 */
	async openConversation(seniorId: string, sessionToken: string): Promise<{ id: string }> {
		const existing = await this.database.db
			.select({ id: schema.conversations.id })
			.from(schema.conversations)
			.where(eq(schema.conversations.sessionToken, sessionToken))
			.limit(1);

		if (existing.length > 0) {
			return existing[0];
		}

		// New conversation for this session — create it and bump the senior counter.
		try {
			return await this.database.db.transaction(async (tx) => {
				const [conversation] = await tx
					.insert(schema.conversations)
					.values({ seniorId, sessionToken, fullTranscript: [] })
					.returning({ id: schema.conversations.id });

				await tx
					.update(schema.senior)
					.set({
						conversationsNumber: sql`coalesce(${schema.senior.conversationsNumber}, 0) + 1`,
					})
					.where(eq(schema.senior.userId, seniorId));

				return conversation;
			});
		} catch {
			// Unique constraint violation from a concurrent request that won the
			// race — fetch and return the row it just created.
			const [row] = await this.database.db
				.select({ id: schema.conversations.id })
				.from(schema.conversations)
				.where(eq(schema.conversations.sessionToken, sessionToken))
				.limit(1);
			if (!row) {
				throw new Error(`[openConversation] failed to recover conversation for session ${sessionToken}`);
			}
			return row;
		}
	}

	/**
	 * Persists one or more ordered turns in both the legacy `messages` table and
	 * the newer `conversations.fullTranscript` JSON snapshot inside one transaction.
	 */
	async appendConversationTurns(
		conversationId: string,
		turns: PersistedTurnInput[],
	) {
		const normalizedTurns = this.createTranscriptTurns(turns);
		const updatedAt = new Date();

		await this.database.db.transaction(async (tx) => {
			await tx.insert(schema.messages).values(
				normalizedTurns.map((turn) => ({
					conversationId,
					sender: turn.role,
					content: turn.content,
					timestamp: new Date(turn.timestamp),
				})),
			);

			// Append new turns atomically so the JSON transcript stays in sync with
			// the row-per-message history even if multiple turns arrive close together.
			await tx
				.update(schema.conversations)
				.set({
					updatedAt,
					fullTranscript: sql`COALESCE(${schema.conversations.fullTranscript}, '[]'::jsonb) || ${JSON.stringify(normalizedTurns)}::jsonb`,
				})
				.where(eq(schema.conversations.id, conversationId));
		});
	}

	async insertMessages(
		messages: Array<{
			conversationId: string;
			sender: "user" | "assistant";
			content: string;
		}>,
	) {
		await this.database.db.insert(schema.messages).values(messages);
	}

	findConversationMessages(conversationId: string) {
		return this.database.db.query.messages.findMany({
			where: eq(schema.messages.conversationId, conversationId),
			orderBy: [asc(schema.messages.timestamp)],
		});
	}

	/**
	 * Returns the conversation transcript used for summarization, preferring the
	 * JSON snapshot on `conversations` and falling back to legacy message rows.
	 */
	async findConversationMessagesForSummary(
		conversationId: string,
	): Promise<TranscriptMessage[]> {
		const conversation = await this.database.db.query.conversations.findFirst({
			where: eq(schema.conversations.id, conversationId),
			columns: {
				fullTranscript: true,
			},
		});
		const transcriptMessages = this.normalizeTranscriptMessages(
			conversation?.fullTranscript,
		);

		if (transcriptMessages.length > 0) {
			return transcriptMessages;
		}

		const dbMessages = await this.findConversationMessages(conversationId);
		return dbMessages
			.filter((message) => message.content)
			.map((message) => ({
				role: message.sender as "user" | "assistant",
				content: message.content as string,
			}));
	}

	async deleteConversation(conversationId: string) {
		await this.database.db
			.delete(schema.conversations)
			.where(eq(schema.conversations.id, conversationId));
	}

	async createSessionLog(input: {
		seniorId: string;
		outcome: "Sucesso" | "Cancelada" | "Falha" | "Abandonada";
		note?: string;
	}) {
		await this.database.db.insert(schema.sessionLogs).values({
			seniorId: input.seniorId,
			outcome: input.outcome,
			note: input.note ?? null,
		});
	}

	async closeConversation(
		conversationId: string,
		data: {
			summary: string;
			keyPoints: string[];
			mainTopics: string[];
			emotionalTone: string;
			userOutcome?: "Sucesso" | "Cancelada" | "Falha";
			userNote?: string;
		},
	) {
		await this.database.db
			.update(schema.conversations)
			.set({
				closedAt: new Date(),
				updatedAt: new Date(),
				summary: data.summary,
				keyPoints: data.keyPoints,
				mainTopics: data.mainTopics,
				emotionalTone: data.emotionalTone,
				userOutcome: data.userOutcome ?? null,
				userNote: data.userNote ?? null,
			})
			.where(eq(schema.conversations.id, conversationId));
	}

	/**
	 * Returns the top-k memories for a senior most similar to the query embedding,
	 * filtered by a minimum cosine similarity threshold.
	 */
	async searchMemories(
		seniorId: string,
		queryEmbedding: number[],
		limit = 5,
		minSimilarity = 0.3,
	): Promise<string[]> {
		this.validateEmbedding(queryEmbedding);
		const vectorLiteral = `[${queryEmbedding.join(",")}]`;
		const rows = await this.database.db.execute<{ content: string }>(sql`
			SELECT content
			FROM senior_insights
			WHERE senior_id = ${seniorId}
			  AND 1 - (embedding <=> ${vectorLiteral}::vector) >= ${minSimilarity}
			ORDER BY embedding <=> ${vectorLiteral}::vector
			LIMIT ${limit}
		`);
		return rows.rows.map((r) => r.content);
	}

	/**
	 * Saves a memory fact only if no sufficiently similar memory already exists
	 * (cosine similarity >= 0.85). Silently skips duplicates.
	 */
	async saveMemoryIfNew(
		seniorId: string,
		content: string,
		embedding: number[],
		sourceConversationId?: string,
	): Promise<void> {
		this.validateEmbedding(embedding);
		const vectorLiteral = `[${embedding.join(",")}]`;
		const duplicate = await this.database.db.execute<{ id: string }>(sql`
			SELECT id
			FROM senior_insights
			WHERE senior_id = ${seniorId}
			  AND 1 - (embedding <=> ${vectorLiteral}::vector) >= 0.85
			LIMIT 1
		`);
		if (duplicate.rows.length > 0) {
			return;
		}
		await this.database.db.insert(schema.seniorInsights).values({
			seniorId,
			content,
			embedding,
			sourceConversationId: sourceConversationId ?? null,
		});
	}

	/**
	 * Returns the total number of facts stored for a senior.
	 * Used to decide between recency-based and RAG-based memory retrieval.
	 */
	async countMemories(seniorId: string): Promise<number> {
		const rows = await this.database.db.execute<{ count: string }>(sql`
			SELECT COUNT(*)::text AS count
			FROM senior_insights
			WHERE senior_id = ${seniorId}
		`);
		return Number(rows.rows[0]?.count ?? 0);
	}

	/**
	 * Returns the most recent `limit` facts for a senior, ordered newest-first.
	 * Used when the senior has <= 30 facts (all fit in the prompt).
	 */
	async getAllMemories(seniorId: string, limit = 30): Promise<string[]> {
		const rows = await this.database.db.query.seniorInsights.findMany({
			where: eq(schema.seniorInsights.seniorId, seniorId),
			orderBy: [desc(schema.seniorInsights.createdAt)],
			limit,
			columns: { content: true },
		});
		return rows.map((r) => r.content);
	}

	/**
	 * Embeds each fact and persists those that are not already known for this senior.
	 * Runs best-effort and in parallel — errors per fact are logged and skipped.
	 */
	async saveExtractedFacts(
		seniorId: string,
		facts: string[],
		sourceConversationId?: string,
	): Promise<void> {
		console.info(`[chat.repository] saveExtractedFacts: processing ${facts.length} facts for senior ${seniorId}`);
		const results = await Promise.allSettled(
			facts.map(async (fact) => {
				const embedding = await Promise.race([
					getEmbedding(fact),
					new Promise<never>((_, reject) =>
						setTimeout(() => reject(new Error("EMBEDDING_TIMEOUT")), 10_000),
					),
				]);
				await this.saveMemoryIfNew(seniorId, fact, embedding, sourceConversationId);
				console.info(`[chat.repository] fact saved (or skipped as duplicate): "${fact}"`);
			}),
		);
		const failed = results.filter((r) => r.status === "rejected");
		if (failed.length > 0) {
			console.warn(
				`[chat.repository] ${failed.length}/${facts.length} facts failed to save`,
				failed.map((r) => (r as PromiseRejectedResult).reason instanceof Error ? (r as PromiseRejectedResult).reason.message : r),
			);
		}
	}

	private validateEmbedding(embedding: number[]): void {
		if (
			!Array.isArray(embedding) ||
			embedding.length === 0 ||
			!embedding.every((n) => typeof n === "number" && Number.isFinite(n))
		) {
			throw new Error("Invalid embedding: must be a non-empty array of finite numbers");
		}
	}

	/**
	 * Adds deterministic ISO timestamps to stored transcript turns so the JSON
	 * snapshot preserves the same order as the row-per-message persistence.
	 */
	private createTranscriptTurns(
		turns: PersistedTurnInput[],
	): ConversationTranscriptTurn[] {
		const baseTime = Date.now();

		return turns.map((turn, index) => ({
			role: turn.role,
			content: turn.content,
			timestamp: new Date(baseTime + index).toISOString(),
		}));
	}

	/**
	 * Filters malformed JSON transcript entries and returns only valid messages
	 * that can be safely forwarded to the summarization pipeline.
	 */
	private normalizeTranscriptMessages(
		fullTranscript: ConversationTranscriptTurn[] | null | undefined,
	): TranscriptMessage[] {
		if (!Array.isArray(fullTranscript)) {
			return [];
		}

		return fullTranscript
			.filter((turn): turn is ConversationTranscriptTurn => {
				if (!turn || typeof turn !== "object") {
					return false;
				}

				const role = turn.role;
				const content = turn.content;

				return (
					(role === "user" || role === "assistant") &&
					typeof content === "string" &&
					content.trim().length > 0
				);
			})
			.map((turn) => ({
				role: turn.role,
				content: turn.content,
			}));
	}
}
