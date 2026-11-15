-- Switch from Xenova all-MiniLM-L6-v2 (384-dim) to Cohere Embed v4 (1024-dim).
-- Old embeddings are incompatible with the new model so all rows are cleared.
DELETE FROM "senior_insights";--> statement-breakpoint
DROP INDEX IF EXISTS "senior_insights_embedding_hnsw_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "resident_memories_embedding_hnsw_idx";--> statement-breakpoint
ALTER TABLE "senior_insights" DROP COLUMN IF EXISTS "embedding";--> statement-breakpoint
ALTER TABLE "senior_insights" ADD COLUMN "embedding" vector(1536) NOT NULL;--> statement-breakpoint
CREATE INDEX "senior_insights_embedding_hnsw_idx" ON "senior_insights" USING hnsw ("embedding" vector_cosine_ops);
