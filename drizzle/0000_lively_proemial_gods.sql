CREATE TABLE "institutions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"designation" varchar(255),
	"location" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"session_token" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"email" varchar(255) NOT NULL,
	"username" varchar(100) NOT NULL,
	"password_hash" text NOT NULL,
	"role" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"ID" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"senior_id" uuid,
	"created_At" timestamp DEFAULT now() NOT NULL,
	"updated_At" timestamp,
	"closed_At" timestamp,
	"summary" text,
	"keyPoints" text[],
	"main_Topics" text[],
	"emotional_Tone" varchar(50)
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"ID" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid,
	"sender" varchar(20) NOT NULL,
	"content" text,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"sentiment_Score" integer
);
--> statement-breakpoint
CREATE TABLE "caregiver" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"full_name" text
);
--> statement-breakpoint
CREATE TABLE "senior" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"fullname" text,
	"nickname" text,
	"birthdate" date,
	"cognitive_level" integer,
	"conversations_number" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "resident_likes" (
	"ID" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"senior_id" uuid,
	"football" text[] DEFAULT '{}' NOT NULL,
	"music" text[] DEFAULT '{}' NOT NULL,
	"cinema" text[] DEFAULT '{}' NOT NULL,
	"gastronomy" text[] DEFAULT '{}' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "senior_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"senior_id" uuid NOT NULL,
	"silence_timeout_ms" integer DEFAULT 1200 NOT NULL,
	"chat_personality" varchar(20) DEFAULT 'informal' NOT NULL,
	"prefered_languages" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"preferred_voices" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"voice_rate_modifier" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "senior_settings_senior_id_unique" UNIQUE("senior_id")
);
--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_organization_id_institutions_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."institutions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_senior_id_senior_user_id_fk" FOREIGN KEY ("senior_id") REFERENCES "public"."senior"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_ID_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("ID") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "caregiver" ADD CONSTRAINT "caregiver_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "senior" ADD CONSTRAINT "senior_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resident_likes" ADD CONSTRAINT "resident_likes_senior_id_senior_user_id_fk" FOREIGN KEY ("senior_id") REFERENCES "public"."senior"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "senior_settings" ADD CONSTRAINT "senior_settings_senior_id_senior_user_id_fk" FOREIGN KEY ("senior_id") REFERENCES "public"."senior"("user_id") ON DELETE cascade ON UPDATE no action;