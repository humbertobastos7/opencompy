-- Compy no longer has accounts or login: a single local user owns all data.
-- Drops the login tables and columns. CASCADE also removes the foreign key
-- from conversations.session_token, which is kept as a plain per-visit key.
DROP TABLE IF EXISTS "sessions" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "password_reset_tokens" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "pending_registrations" CASCADE;
--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN IF EXISTS "email_verified_at";
--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN IF EXISTS "email_verification_token";
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL;
--> statement-breakpoint
-- Facts the person shares during onboarding are stored as pinned notes with
-- no caregiver behind them.
ALTER TABLE "caregiver_notes" ALTER COLUMN "caregiver_id" DROP NOT NULL;
