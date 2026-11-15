ALTER TABLE "resident_likes" ADD COLUMN IF NOT EXISTS "hobbies" text[] NOT NULL DEFAULT '{}';
