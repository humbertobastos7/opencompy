import { Inject, Injectable } from "@nestjs/common";
import NodeCache from "node-cache";
import { and, desc, eq, isNotNull } from "drizzle-orm";
import { DatabaseService, schema } from "@/backend/database/database.service";
import { ChatRepository } from "@/backend/modules/chat/chat.repository";
import { getEmbedding } from "@/shared/embeddings";
import type { AssistantContext } from "@/shared/contracts";

const EMBEDDING_TIMEOUT_MS = 900;

/**
 * Wraps getEmbedding with a hard timeout so a slow first-load of the Xenova
 * model never blocks a voice turn for more than EMBEDDING_TIMEOUT_MS.
 */
async function getEmbeddingWithTimeout(text: string): Promise<number[]> {
    return Promise.race([
        getEmbedding(text),
        new Promise<never>((_, reject) =>
            setTimeout(
                () => reject(new Error("EMBEDDING_TIMEOUT")),
                EMBEDDING_TIMEOUT_MS,
            ),
        ),
    ]);
}

type StaticContext = Omit<AssistantContext, "retrieved_memories" | "mood_trend" | "all_memories">;

function computeAge(birthdate: string | undefined | null): number | undefined {
    if (!birthdate) return undefined;
    const birth = new Date(birthdate);
    if (Number.isNaN(birth.getTime())) return undefined;
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
        age--;
    }
    return age;
}

/**
 * Builds the compact backend-owned assistant context that will later be
 * forwarded to the AI service for Structured RAG.
 */
@Injectable()
export class ConversationContextService {
    /**
     * Keeps static assistant context warm across consecutive turns so repeated
     * database reads do not run for every voice turn.
     */
    private readonly contextCache = new NodeCache({
        stdTTL: 300,
        checkperiod: 60,
        useClones: false,
    });

    constructor(
        @Inject(DatabaseService)
        private readonly database: DatabaseService,
        @Inject(ChatRepository)
        private readonly chatRepository: ChatRepository,
    ) {}

    /**
     * Builds a compact context block for one senior.
     *
     * When `inputText` is provided the method appends semantically relevant
     * memories retrieved via pgvector cosine similarity.  The static parts
     * (profile, notes, summaries, likes) are cached for 5 minutes
     * so back-to-back turns within the same session skip the DB round-trips.
     */
    async buildAssistantContext(
        seniorId: string,
        inputText?: string,
    ): Promise<AssistantContext> {
        const staticContext = await this.getStaticContext(seniorId);
        const moodTrend = this.computeMoodTrend(staticContext.recent_summaries);

        let allMemories: string[] | undefined;
        let retrievedMemories: string[] | undefined;

        const allMemoriesPromise = this.chatRepository
            .getAllMemories(seniorId, 12)
            .catch((err) => {
                console.warn("[conversation-context] ALL_MEMORIES_FAILED", err instanceof Error ? err.message : err);
                return [];
            });

        const retrievedMemoriesPromise = inputText?.trim()
            ? (async () => {
                try {
                    const queryEmbedding = await getEmbeddingWithTimeout(inputText);
                    return await this.chatRepository.searchMemories(seniorId, queryEmbedding, 3, 0.3);
                } catch (err) {
                    console.warn("[conversation-context] MEMORY_RETRIEVAL_FAILED", err instanceof Error ? err.message : err);
                    return [];
                }
            })()
            : Promise.resolve([]);

        // §6 — all_memories: stable background knowledge, always recency-based.
        // Run memory reads and semantic RAG in parallel so context preparation
        // does not sit on the critical voice-response path longer than needed.
        const [memories, retrieved] = await Promise.all([
            allMemoriesPromise,
            retrievedMemoriesPromise,
        ]);
        if (memories.length > 0) allMemories = memories;

        // retrieved_memories — per-turn RAG: facts semantically close to what the senior
        // just said. Used to react naturally to the current topic.
        if (retrieved.length > 0) retrievedMemories = retrieved;

        return {
            ...staticContext,
            all_memories: allMemories,
            mood_trend: moodTrend,
            retrieved_memories: retrievedMemories,
        };
    }

    /**
     * Clears the cached assistant context for one senior so the next turn
     * rebuilds it from the database.
     */
    invalidateContext(seniorId: string) {
        this.contextCache.del(`ctx:${seniorId}`);
    }

    // ---------------------------------------------------------------------------
    // Private helpers
    // ---------------------------------------------------------------------------

    private async getStaticContext(seniorId: string): Promise<StaticContext> {
        const cacheKey = `ctx:${seniorId}`;
        const cached = this.contextCache.get<StaticContext>(cacheKey);
        if (cached) {
            return cached;
        }

        const [seniorProfile, seniorUser, caregiverNotes, recentConversations, seniorLikes] =
            await Promise.all([
                this.database.db.query.senior.findFirst({
                    where: eq(schema.senior.userId, seniorId),
                }),
                this.database.db.query.users.findFirst({
                    where: eq(schema.users.id, seniorId),
                }),
                this.database.db.query.caregiverNotes.findMany({
                    where: and(
                        eq(schema.caregiverNotes.seniorId, seniorId),
                        eq(schema.caregiverNotes.pinned, true),
                    ),
                    orderBy: [desc(schema.caregiverNotes.createdAt)],
                    limit: 5,
                }),
                this.database.db.query.conversations.findMany({
                    where: and(
                        eq(schema.conversations.seniorId, seniorId),
                        // Exclude ghost rows (no summary) and still-open conversations.
                        isNotNull(schema.conversations.summary),
                    ),
                    orderBy: [desc(schema.conversations.createdAt)],
                    limit: 3,
                }),
                this.database.db.query.seniorLikes.findFirst({
                    where: eq(schema.seniorLikes.seniorId, seniorId),
                }),
            ]);

        const nome = seniorProfile?.fullname?.trim() || seniorUser?.username?.trim();
        const tratamento = seniorProfile?.nickname?.trim() || nome;
        const idade = computeAge(seniorProfile?.birthdate);

        const staticContext: StaticContext = {
            nome: nome || undefined,
            tratamento: tratamento || undefined,
            idade,
            familia: seniorProfile?.family?.trim() || undefined,
            diagnosticos: seniorProfile?.diagnoses?.filter(Boolean) ?? undefined,
            evitar: seniorProfile?.avoidTopics?.filter(Boolean) ?? undefined,
            senior_profile: seniorProfile
                ? {
                      nickname: seniorProfile.nickname ?? undefined,
                      birthdate: seniorProfile.birthdate ?? undefined,
                      cognitive_level: seniorProfile.cognitiveLevel ?? undefined,
                  }
                : undefined,

            // Only pinned notes should feed the assistant's persistent prompt.
            caregiver_notes: caregiverNotes
                .map((note) => note.content?.trim())
                .filter((note): note is string => Boolean(note)),

            recent_summaries: recentConversations
                .filter((conversation) => conversation.summary?.trim())
                .map((conversation) => ({
                    date: conversation.createdAt.toISOString().slice(0, 10),
                    summary: conversation.summary as string,
                    key_points: conversation.keyPoints?.filter(Boolean) ?? [],
                    main_topics: conversation.mainTopics ?? [],
                    emotional_tone: conversation.emotionalTone ?? undefined,
                })),

            senior_likes: seniorLikes
                ? {
                      football: seniorLikes.football?.length ? seniorLikes.football : undefined,
                      music: seniorLikes.music?.length ? seniorLikes.music : undefined,
                      cinema: seniorLikes.cinema?.length ? seniorLikes.cinema : undefined,
                      gastronomy: seniorLikes.gastronomy?.length ? seniorLikes.gastronomy : undefined,
                      hobbies: seniorLikes.hobbies?.length ? seniorLikes.hobbies : undefined,
                  }
                : undefined,
        };

        this.contextCache.set(cacheKey, staticContext);
        return staticContext;
    }

    /**
     * Returns a mood-trend string when the last 5 conversations show a clear
     * pattern, or `undefined` when the signal is too weak to be actionable.
     */
    private computeMoodTrend(
        summaries?: Array<{ emotional_tone?: string }>,
    ): string | undefined {
        if (!summaries || summaries.length < 3) {
            return undefined;
        }

        const negativeKeywords = [
            "triste", "ansioso", "ansiedade", "preocupado", "irritado",
            "sad", "anxious", "worried", "upset", "negative",
        ];
        const positiveKeywords = [
            "feliz", "alegre", "animado", "bem", "contente",
            "happy", "positive", "cheerful", "excited", "good",
        ];

        let negCount = 0;
        let posCount = 0;

        for (const s of summaries) {
            const tone = (s.emotional_tone ?? "").toLowerCase();
            if (negativeKeywords.some((k) => tone.includes(k))) negCount++;
            else if (positiveKeywords.some((k) => tone.includes(k))) posCount++;
        }

        const total = summaries.length;
        if (negCount >= Math.ceil(total * 0.6)) {
            return `The resident has shown a predominantly negative emotional tone across the last ${total} conversations (e.g. sadness, anxiety, worry). Approach with extra warmth and reassurance.`;
        }
        if (posCount >= Math.ceil(total * 0.6)) {
            return `The resident has been in a positive, upbeat mood across the last ${total} conversations. Keep the energy warm and engaging.`;
        }

        return undefined;
    }
}
