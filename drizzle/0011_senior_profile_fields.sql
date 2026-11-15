ALTER TABLE "senior" ADD COLUMN "family" text;--> statement-breakpoint
ALTER TABLE "senior" ADD COLUMN "diagnoses" text[] DEFAULT '{}'::text[];--> statement-breakpoint
ALTER TABLE "senior" ADD COLUMN "avoid_topics" text[] DEFAULT '{}'::text[];
