DROP TABLE IF EXISTS "atlas_geo_locations" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "medication" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "medication_administration" CASCADE;--> statement-breakpoint
ALTER TABLE "caregiver_notes" ADD COLUMN IF NOT EXISTS "category" varchar(32);--> statement-breakpoint
ALTER TABLE "caregiver_notes" ADD COLUMN IF NOT EXISTS "pinned" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "session_token" text;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'conversations_session_token_sessions_session_token_fk'
  ) THEN
    ALTER TABLE "conversations" ADD CONSTRAINT "conversations_session_token_sessions_session_token_fk"
      FOREIGN KEY ("session_token") REFERENCES "public"."sessions"("session_token") ON DELETE set null ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "conversations_senior_id_created_at_idx" ON "conversations" USING btree ("senior_id","created_At");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "conversations_session_token_unique" ON "conversations" USING btree ("session_token");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "messages_conversation_id_timestamp_idx" ON "messages" USING btree ("conversation_id","timestamp");
