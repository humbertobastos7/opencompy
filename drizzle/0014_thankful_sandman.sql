ALTER TABLE "conversations" ADD COLUMN "full_transcript" jsonb DEFAULT '[]'::jsonb NOT NULL;
--> statement-breakpoint
UPDATE "conversations" AS conversations
SET "full_transcript" = COALESCE(transcript.turns, '[]'::jsonb)
FROM (
	SELECT
		"conversation_id",
		jsonb_agg(
			jsonb_build_object(
				'role',
				"sender",
				'content',
				"content",
				'timestamp',
				"timestamp"
			)
			ORDER BY "timestamp", "ID"
		) AS turns
	FROM "messages"
	WHERE "content" IS NOT NULL
	GROUP BY "conversation_id"
) AS transcript
WHERE conversations."ID" = transcript."conversation_id";
