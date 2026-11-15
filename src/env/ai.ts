import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
	server: {
		PORT: z.coerce.number().int().positive().default(3001),
		NODE_ENV: z
			.enum(["development", "production", "test"])
			.default("development"),
		SYSTEM_PROMPT: z.string().default(""),
		ELEVENLABS_API_KEY: z.string().optional(),
		ELEVENLABS_BASE_URL: z.string().url().default("https://api.elevenlabs.io"),
		ELEVENLABS_MODEL_ID: z.string().default("eleven_v3"),
		ELEVENLABS_STREAMING_MODEL_ID: z.string().default("eleven_v3"),
		ELEVENLABS_USE_STREAMING: z
			.enum(["true", "false"])
			.default("true")
			.transform((v) => v === "true"),
		ELEVENLABS_OUTPUT_FORMAT: z.string().default("mp3_44100_128"),
		ELEVENLABS_STABILITY: z.coerce.number().min(0).max(1).default(0.6),
		ELEVENLABS_SIMILARITY_BOOST: z.coerce.number().min(0).max(1).default(0.5),
		ELEVENLABS_VOICE_ID_DEFAULT: z.string().optional(),
		LLM_WEB_SEARCH: z
			.preprocess(
				(v) => (v === "enabled" ? "always" : v),
				z.enum(["disabled", "auto", "always"]),
			)
			.default("auto"),
		ANTHROPIC_API_KEY: z.string().optional(),
		ANTHROPIC_MODEL: z.string().default("claude-sonnet-4-6"),
		ANTHROPIC_SUMMARY_MODEL: z.string().default("claude-haiku-4-5-20251001"),
		ELEVENLABS_STT_REALTIME_MODEL_ID: z.string().default("scribe_v2_realtime"),
		ELEVENLABS_STT_BATCH_MODEL_ID: z.string().default("scribe_v2"),
		GEMINI_API_KEY: z.string().optional(),
		GEMINI_TTS_BASE_URL: z
			.string()
			.url()
			.default("https://generativelanguage.googleapis.com"),
		GEMINI_TTS_MODEL: z.string().default("gemini-2.5-flash-preview-tts"),
		GEMINI_TTS_VOICE_NAME: z.string().default("Aoede"),
		GEMINI_TTS_LANGUAGE_CODE: z.string().default("pt-PT"),
		GEMINI_TTS_STYLE_PROMPT: z
			.string()
			.default(
				"Speak only in European Portuguese from Portugal (pt-PT), with a clear Portuguese accent and intonation. " +
					"Do not use Brazilian Portuguese pronunciation, rhythm, vocabulary, or neutral Portuguese. " +
					"Use a warm, gentle, and patient tone suitable for elderly people. " +
					"Speak clearly and at a calm, measured pace. " +
					"Never rush. Sound like a caring and trustworthy companion.",
			),
		TTS_PROVIDER: z.enum(["gemini", "elevenlabs"]).default("elevenlabs"),
	},
	runtimeEnv: process.env,
	emptyStringAsUndefined: true,
});
