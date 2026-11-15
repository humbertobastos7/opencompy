CREATE TABLE "session_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"senior_id" uuid NOT NULL,
	"outcome" varchar(20) NOT NULL,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "session_logs" ADD CONSTRAINT "session_logs_senior_id_senior_user_id_fk" FOREIGN KEY ("senior_id") REFERENCES "public"."senior"("user_id") ON DELETE cascade ON UPDATE no action;