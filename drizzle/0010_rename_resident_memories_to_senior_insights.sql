DO $$ BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'resident_memories') THEN
    ALTER TABLE "resident_memories" RENAME TO "senior_insights";
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'resident_memories_senior_id_idx') THEN
    ALTER INDEX "resident_memories_senior_id_idx" RENAME TO "senior_insights_senior_id_idx";
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'resident_memories_embedding_hnsw_idx') THEN
    ALTER INDEX "resident_memories_embedding_hnsw_idx" RENAME TO "senior_insights_embedding_hnsw_idx";
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_constraint WHERE conname = 'resident_memories_senior_id_senior_user_id_fk') THEN
    ALTER TABLE "senior_insights" RENAME CONSTRAINT "resident_memories_senior_id_senior_user_id_fk" TO "senior_insights_senior_id_senior_user_id_fk";
  END IF;
END $$;
