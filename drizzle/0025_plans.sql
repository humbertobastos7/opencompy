CREATE TABLE IF NOT EXISTS "plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"max_seniors" integer,
	"max_talking_minutes_per_month" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "plans_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "institutions" ADD COLUMN IF NOT EXISTS "plan_id" uuid;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "institutions" ADD CONSTRAINT "institutions_plan_id_plans_id_fk"
		FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
