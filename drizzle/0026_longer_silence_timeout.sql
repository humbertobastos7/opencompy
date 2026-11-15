-- Increase the end-of-turn silence timeout from 1200ms to 2500ms.
-- Seniors pause more while speaking, so Compy was cutting in too early.
ALTER TABLE "senior_settings" ALTER COLUMN "silence_timeout_ms" SET DEFAULT 2500;--> statement-breakpoint
-- Bump existing seniors still on the old default. There is no UI to change this
-- value, so every row holds 1200; this WHERE clause is therefore exhaustive and safe.
UPDATE "senior_settings" SET "silence_timeout_ms" = 2500 WHERE "silence_timeout_ms" = 1200;
