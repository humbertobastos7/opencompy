CREATE TABLE "pending_registrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" text NOT NULL,
	"name" text NOT NULL,
	"verification_token" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "pending_registrations_email_unique" UNIQUE("email")
);
CREATE INDEX "pr_email_idx" ON "pending_registrations" USING btree ("email");
CREATE INDEX "pr_expires_idx" ON "pending_registrations" USING btree ("expires_at");
