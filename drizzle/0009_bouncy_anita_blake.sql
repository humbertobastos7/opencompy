CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint
CREATE TABLE "resident_memories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"senior_id" uuid NOT NULL,
	"content" text NOT NULL,
	"embedding" vector(384) NOT NULL,
	"source_conversation_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "resident_memories" ADD CONSTRAINT "resident_memories_senior_id_senior_user_id_fk" FOREIGN KEY ("senior_id") REFERENCES "public"."senior"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "resident_memories_senior_id_idx" ON "resident_memories" USING btree ("senior_id");
--> statement-breakpoint
CREATE INDEX "resident_memories_embedding_hnsw_idx" ON "resident_memories" USING hnsw ("embedding" vector_cosine_ops);