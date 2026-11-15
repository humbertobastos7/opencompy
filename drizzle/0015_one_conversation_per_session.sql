-- Migration: one conversation row per login session
--
-- Replaces the wrong per-day approach with per-session:
-- 1. Drop the conversation_date column and its unique index
-- 2. Add session_token column (nullable FK → sessions.session_token)
-- 3. Add partial unique index so each non-null session_token appears at most once
--> statement-breakpoint
DROP INDEX IF EXISTS "conversations_senior_day_unique";
--> statement-breakpoint
ALTER TABLE "conversations" DROP COLUMN IF EXISTS "conversation_date";
--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "session_token" text REFERENCES "sessions"("session_token") ON DELETE SET NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "conversations_session_token_unique" ON "conversations" ("session_token") WHERE "session_token" IS NOT NULL;
