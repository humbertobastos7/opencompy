CREATE TABLE "caregiver_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"senior_id" uuid NOT NULL,
	"caregiver_id" uuid NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "caregiver_notes" ADD CONSTRAINT "caregiver_notes_senior_id_senior_user_id_fk" FOREIGN KEY ("senior_id") REFERENCES "public"."senior"("user_id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "caregiver_notes" ADD CONSTRAINT "caregiver_notes_caregiver_id_caregiver_user_id_fk" FOREIGN KEY ("caregiver_id") REFERENCES "public"."caregiver"("user_id") ON DELETE cascade ON UPDATE no action;
