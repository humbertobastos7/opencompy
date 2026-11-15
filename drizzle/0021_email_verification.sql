-- Add email verification columns.
-- Backfill existing rows so all current accounts are considered verified.
ALTER TABLE "users" ADD COLUMN "email_verified_at" timestamp;
ALTER TABLE "users" ADD COLUMN "email_verification_token" text;
UPDATE "users" SET "email_verified_at" = NOW() WHERE "email_verified_at" IS NULL;
