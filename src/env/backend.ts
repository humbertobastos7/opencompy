import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
	server: {
		PORT: z.coerce.number().int().positive().default(3000),
		AI_SERVICE_URL: z.string().url().default("http://127.0.0.1:3001"),
		DATABASE_URL: z.string().url(),
		CORS_ORIGINS: z.string().optional(),
		OPENAI_API_KEY: z.string().optional(),
		ELEVENLABS_API_KEY: z.string().optional(),
		ELEVENLABS_BASE_URL: z.string().url().default("https://api.elevenlabs.io"),
		ELEVENLABS_STT_BATCH_MODEL_ID: z.string().default("scribe_v2"),
		SENTRY_DSN: z.string().url().optional(),
		NODE_ENV: z
			.enum(["development", "production", "test"])
			.default("development"),
	},
	runtimeEnv: process.env,
	emptyStringAsUndefined: true,
});
