import { z } from "zod";
import { withSwagger } from "@/shared/nest/zod-swagger-metadata";
import { sessionResponseSchema } from "./session";

export const MEMORY_GAME_OFFER_TEXT = "Quer jogar ao jogo da memória comigo?";

export type MemoryGameResult = {
	timeTakenSeconds: number;
	errors: number;
	totalPairs: number;
};

export type MemoryGameSessionResult = {
	games: MemoryGameResult[];
};

export const chatVoiceTurnDetectionSchema = withSwagger(
	z
		.object({
			type: withSwagger(z.literal("local_vad").default("local_vad"), {
				description: "Client-side voice activity detection strategy.",
				example: "local_vad",
			}),
			threshold: withSwagger(z.number().min(0).max(1).optional(), {
				description:
					"Normalized speech detection threshold used by the browser.",
				example: 0.08,
			}),
			prefix_padding_ms: withSwagger(
				z.number().int().nonnegative().optional(),
				{
					description: "Optional audio padding hint before detected speech.",
					example: 250,
				},
			),
			silence_duration_ms: withSwagger(z.number().int().positive().optional(), {
				description: "Silence duration required before a turn is submitted.",
				example: 1200,
			}),
			max_turn_duration_ms: withSwagger(
				z.number().int().positive().optional(),
				{
					description:
						"Hard cap for one browser-recorded turn before it is forced closed.",
					example: 15000,
				},
			),
			create_response: withSwagger(z.boolean().optional(), {
				description:
					"Whether the assistant should auto-generate a reply after each turn.",
				example: true,
			}),
			interrupt_response: withSwagger(z.boolean().optional(), {
				description: "Whether a new user turn can interrupt playback.",
				example: true,
			}),
		})
		.default({}),
	{
		description:
			"Voice activity detection settings for the browser voice loop.",
	},
);

export const chatVoiceInputTranscriptionSchema = withSwagger(
	z
		.object({
			model: withSwagger(z.string().optional(), {
				description: "Preferred ASR model identifier.",
				example: "nova-3",
			}),
			language: withSwagger(z.string().optional(), {
				description: "Expected language code for the captured audio.",
				example: "pt-PT",
			}),
			keyterms: withSwagger(
				z.array(z.string().trim().min(1).max(20)).max(50).optional(),
				{
					description:
						"Short terms to bias realtime ASR toward names, app words, and domain vocabulary.",
					example: ["Compy", "medicacao"],
				},
			),
		})
		.optional(),
	{
		description: "Audio transcription preferences.",
	},
);

export const chatVoiceAsrProviderSchema = withSwagger(z.literal("elevenlabs"), {
	description: "Configured speech-to-text provider.",
	example: "elevenlabs",
});

export const chatVoiceSessionConfigSchema = withSwagger(
	z
		.object({
			model: withSwagger(z.string().optional(), {
				description: "Preferred LLM identifier.",
				example: "eu.anthropic.claude-sonnet-4-6",
			}),
			instructions: withSwagger(z.string().optional(), {
				description:
					"Legacy client field kept for compatibility. The active system prompt is read only from SYSTEM_PROMPT on the AI service.",
				example: "Ignored by the server.",
			}),
			max_response_output_tokens: withSwagger(
				z.union([z.literal("inf"), z.number().int().positive()]).optional(),
				{
					description: "Token cap for model responses.",
					example: 300,
				},
			),
			input_audio_transcription: chatVoiceInputTranscriptionSchema,
			turn_detection: chatVoiceTurnDetectionSchema.optional(),
		})
		.default({}),
	{
		description:
			"Normalized voice-session configuration shared by frontend and AI service.",
	},
);

export const chatConversationMessageSchema = withSwagger(
	z.object({
		role: withSwagger(z.enum(["user", "assistant"]), {
			description: "Conversation role.",
			example: "user",
		}),
		content: withSwagger(z.string().trim().min(1).max(4000), {
			description: "Plain-text conversation message.",
			example: "Conta-me uma historia da tua infancia.",
		}),
	}),
	{
		description:
			"Conversation item included as history for the current voice turn.",
	},
);

export const chatVoiceSessionRequestSchema = withSwagger(
	z.object({
		session: chatVoiceSessionConfigSchema,
	}),
	{
		description:
			"Create or validate a voice AI session for the authenticated user.",
	},
);

export const chatVoiceProvidersSchema = withSwagger(
	z.object({
		asr: chatVoiceAsrProviderSchema,
		llm: withSwagger(z.literal("anthropic"), {
			description: "Configured large language model provider.",
			example: "anthropic",
		}),
		tts: withSwagger(z.union([z.literal("elevenlabs"), z.literal("gemini")]), {
			description: "Configured text-to-speech provider.",
			example: "gemini",
		}),
	}),
	{
		description: "External providers backing the voice experience.",
	},
);

export const chatVoiceLlmUsageSchema = withSwagger(
	z.object({
		model: z.string(),
		input_tokens: z.number().int().nonnegative(),
		output_tokens: z.number().int().nonnegative(),
		cache_creation_input_tokens: z.number().int().nonnegative().optional(),
		cache_read_input_tokens: z.number().int().nonnegative().optional(),
		total_tokens: z.number().int().nonnegative(),
		web_search: z.boolean(),
	}),
	{
		description:
			"Token usage reported by the LLM provider for one assistant turn.",
	},
);

export const chatVoiceAudioTransportSchema = withSwagger(z.literal("binary"), {
	description: "Negotiated transport used for assistant audio frames.",
	example: "binary",
});

export const chatVoiceSessionResponseSchema = withSwagger(
	z.object({
		session: chatVoiceSessionConfigSchema,
		providers: chatVoiceProvidersSchema,
		audio_transport: withSwagger(chatVoiceAudioTransportSchema, {
			description: "Negotiated transport used for assistant audio frames.",
			example: "binary",
		}),
		notes: withSwagger(z.array(z.string()), {
			description: "Normalization notes produced while creating the session.",
			example: [],
		}),
	}),
	{
		description:
			"Validated voice-session bootstrap data returned to the frontend.",
	},
);

export const chatVoiceInputAudioMimeTypes = [
	"audio/webm;codecs=opus",
	"audio/webm",
	"audio/ogg;codecs=opus",
	"audio/ogg",
	"audio/mp4",
	"audio/pcm;rate=16000",
] as const;

export const chatVoiceInputAudioMimeTypeSchema = withSwagger(
	z.enum(chatVoiceInputAudioMimeTypes),
	{
		description: "Supported MIME type for browser-recorded microphone audio.",
		example: "audio/webm;codecs=opus",
	},
);

export const chatVoiceTurnInputSchema = withSwagger(
	z
		.object({
			text: withSwagger(z.string().trim().min(1).max(4000).optional(), {
				description: "Optional text turn supplied directly by the frontend.",
				example: "Quero falar da minha familia.",
			}),
			audio_base64: withSwagger(z.string().min(1).optional(), {
				description: "Base64-encoded user audio captured in the browser.",
				example: "UklGRlQAAABXQVZFZm10...",
			}),
			audio_mime_type: withSwagger(
				chatVoiceInputAudioMimeTypeSchema.optional(),
				{
					description: "MIME type of the uploaded browser audio blob.",
					example: "audio/webm;codecs=opus",
				},
			),
			audio_language: withSwagger(z.string().optional(), {
				description:
					"Portuguese (pt-PT) language hint forwarded to the ASR provider.",
				example: "pt-PT",
			}),
		})
		.refine(
			(value) => Boolean(value.text?.trim() || value.audio_base64?.trim()),
			{
				message: "Either text or audio_base64 must be provided.",
				path: ["text"],
			},
		),
	{
		description: "Current user turn payload.",
	},
);

export const chatVoiceTurnRequestSchema = withSwagger(
	z.object({
		session: chatVoiceSessionConfigSchema,
		conversation: withSwagger(
			z.array(chatConversationMessageSchema).max(24).default([]),
			{
				description:
					"Conversation history used to keep the assistant grounded.",
			},
		),
		input: chatVoiceTurnInputSchema,
		conversation_id: withSwagger(z.string().uuid().optional(), {
			description:
				"Existing conversation ID to continue. Omit on the first turn to create a new conversation.",
			example: "123e4567-e89b-12d3-a456-426614174000",
		}),
	}),
	{
		description:
			"Process a single text or audio turn through ASR, LLM, and TTS.",
	},
);

export const chatVoiceTurnResponseSchema = withSwagger(
	z.object({
		user_text: withSwagger(z.string(), {
			description: "Normalized user text used for the turn.",
			example: "Quero falar da minha familia.",
		}),
		assistant_text: withSwagger(z.string(), {
			description: "Final assistant reply text.",
			example: "Claro. Conta-me uma memoria boa da tua familia.",
		}),
		audio_base64: withSwagger(z.string().optional(), {
			description: "Optional synthesized assistant audio encoded as base64.",
			example: "SUQzAwAAAAAAI1RTU0UAAA...",
		}),
		audio_mime_type: withSwagger(
			z.union([z.literal("audio/mpeg"), z.literal("audio/wav")]).optional(),
			{
				description: "MIME type for the synthesized audio payload.",
				example: "audio/mpeg",
			},
		),
		providers: chatVoiceProvidersSchema,
		llm_usage: chatVoiceLlmUsageSchema.optional(),
		conversation_id: withSwagger(z.string().uuid().optional(), {
			description:
				"Conversation ID created or continued in this turn. Always present when persistence is active.",
			example: "123e4567-e89b-12d3-a456-426614174000",
		}),
	}),
	{
		description:
			"End-to-end processed voice turn result returned to the frontend.",
	},
);

export const chatVoiceTtsRequestSchema = withSwagger(
	z.object({
		text: withSwagger(z.string().trim().min(1).max(1000), {
			description: "Text to synthesize with the configured Compy voice.",
			example: "Vamos lá jogar então.",
		}),
	}),
	{
		description:
			"Synthesize a short assistant phrase without invoking the LLM.",
	},
);

export const chatVoiceTtsResponseSchema = withSwagger(
	z.object({
		audio_base64: withSwagger(z.string().optional(), {
			description: "Synthesized assistant audio encoded as base64.",
			example: "SUQzAwAAAAAAI1RTU0UAAA...",
		}),
		audio_mime_type: withSwagger(
			z.union([z.literal("audio/mpeg"), z.literal("audio/wav")]).optional(),
			{
				description: "MIME type for the synthesized audio payload.",
				example: "audio/mpeg",
			},
		),
		chars: z.array(z.string()).optional(),
		startTimesMs: z.array(z.number()).optional(),
	}),
	{
		description: "Short TTS result generated by the configured voice provider.",
	},
);

export const chatVoiceStreamingStartRequestSchema = withSwagger(
	z.object({
		session: chatVoiceSessionConfigSchema,
		audio_language: withSwagger(z.string().optional(), {
			description:
				"Optional language hint for the live ASR stream when different from the session default.",
			example: "pt-PT",
		}),
		previous_text: withSwagger(z.string().trim().max(80).optional(), {
			description:
				"Short context sent with the first audio chunk to help realtime ASR continue the conversation.",
			example: "Falavamos sobre a familia.",
		}),
		keyterms: withSwagger(
			z.array(z.string().trim().min(1).max(20)).max(50).optional(),
			{
				description:
					"Short terms to bias realtime ASR toward names, app words, and domain vocabulary.",
				example: ["Compy", "jogo", "memoria"],
			},
		),
	}),
	{
		description:
			"Start a live ASR streaming session for browser audio forwarded over WebSocket.",
	},
);

export const chatVoiceStreamingEventSchema = withSwagger(
	z.discriminatedUnion("type", [
		z.object({
			type: z.literal("transcript.interim"),
			text: z.string(),
		}),
		z.object({
			type: z.literal("transcript.final"),
			text: z.string(),
		}),
	]),
	{
		description:
			"Streaming ASR event emitted while ElevenLabs STT processes live browser audio.",
	},
);

export const chatVoiceStreamingStartResponseSchema = withSwagger(
	z.object({
		success: z.literal(true),
		stream_id: z.string().uuid(),
	}),
	{
		description:
			"Confirms that one live ASR stream was opened and returns its stable stream identifier.",
	},
);

export const chatVoiceStreamingChunkRequestSchema = withSwagger(
	z.object({
		stream_id: withSwagger(z.string().uuid(), {
			description:
				"Identifier of the live ASR stream that should receive this audio chunk.",
			example: "123e4567-e89b-12d3-a456-426614174000",
		}),
		audio_chunk_base64: withSwagger(z.string().min(1), {
			description:
				"Base64-encoded browser audio chunk forwarded to the live ASR stream.",
			example: "UklGRlQAAABXQVZFZm10...",
		}),
	}),
	{
		description:
			"Forward one browser-recorded audio chunk to an existing live ASR stream.",
	},
);

export const chatVoiceStreamingChunkResponseSchema = withSwagger(
	z.object({
		success: z.literal(true),
	}),
	{
		description:
			"Confirms that one audio chunk was accepted by the live ASR stream.",
	},
);

export const chatVoiceStreamingCloseRequestSchema = withSwagger(
	z.object({
		stream_id: withSwagger(z.string().uuid(), {
			description: "Identifier of the live ASR stream to be closed.",
			example: "123e4567-e89b-12d3-a456-426614174000",
		}),
	}),
	{
		description:
			"Close one existing live ASR stream and return the final transcript accumulated so far.",
	},
);

export const chatVoiceStreamingCloseResponseSchema = withSwagger(
	z.object({
		final_transcript: z.string(),
	}),
	{
		description:
			"Final transcript collected by the live ASR stream before it was closed.",
	},
);

export const chatVoiceStreamingEventsRequestSchema = withSwagger(
	z.object({
		stream_id: withSwagger(z.string().uuid(), {
			description:
				"Identifier of the live ASR stream whose pending transcript events should be drained.",
			example: "123e4567-e89b-12d3-a456-426614174000",
		}),
	}),
	{
		description:
			"Drain all pendind transcript events accumulated so far for one live ASR stream.",
	},
);

export const chatVoiceStreamingEventsResponseSchema = withSwagger(
	z.object({
		events: z.array(chatVoiceStreamingEventSchema),
	}),
	{
		description:
			"All pending interim/final transcript events accumulated so far for one live ASR stream.",
	},
);

export const chatVoiceAssistantStreamingRequestSchema = withSwagger(
	z.object({
		session: chatVoiceSessionConfigSchema,
		conversation: withSwagger(
			z.array(chatConversationMessageSchema).max(24).default([]),
			{
				description:
					"Bounded conversation history forwarded to the streaming LLM pipeline",
			},
		),
		input_text: withSwagger(z.string().trim().min(1).max(4000), {
			description:
				"Final user transcript that should start one streamed assistant response.",
			example: "Conta-me uma historia da tua infancia.",
		}),
		assistant_context: withSwagger(
			z.lazy(() => assistantContextSchema).optional(),
			{
				description:
					"Backend-generated context that is not supplied directly by the frontend.",
			},
		),
		forced_assistant_text: withSwagger(z.string().optional(), {
			description:
				"When set, the assistant skips LLM inference and emits this text directly.",
		}),
	}),
	{
		description:
			"Starts one streamed assistant response using the current session, conversation window, and backend-owned assistant context.",
	},
);

export const chatVoiceAssistantStreamingEventSchema = withSwagger(
	z.discriminatedUnion("type", [
		z.object({
			type: z.literal("assistant.text.delta"),
			text: z.string(),
		}),
		z.object({
			type: z.literal("assistant.text.sentence"),
			text: z.string(),
		}),
		z.object({
			type: z.literal("assistant.audio.chunk"),
			audio_chunk_base64: z.string(),
		}),
		z.object({
			type: z.literal("assistant.text.done"),
			text: z.string(),
		}),
		z.object({
			type: z.literal("assistant.audio.done"),
		}),
		z.object({
			type: z.literal("assistant.llm.usage"),
			usage: chatVoiceLlmUsageSchema,
		}),
		z.object({
			type: z.literal("assistant.char.timings"),
			chars: z.array(z.string()),
			startTimesMs: z.array(z.number()),
		}),
		z.object({
			type: z.literal("error"),
			message: z.string(),
			code: z.string().optional(),
		}),
	]),
	{
		description:
			"Streaming assistant event emitted while Anthropic and ElevenLabs produce one response incrementally.",
	},
);

export const chatVoiceCloseRequestSchema = withSwagger(
	z.object({
		conversation_id: withSwagger(z.string().uuid(), {
			description: "ID of the conversation to close and summarise.",
			example: "123e4567-e89b-12d3-a456-426614174000",
		}),
		user_outcome: withSwagger(
			z.enum(["Sucesso", "Cancelada", "Falha"]).optional(),
			{
				description: "Session outcome reported by the senior user.",
				example: "Sucesso",
			},
		),
		user_note: withSwagger(z.string().max(500).optional(), {
			description: "Optional note left by the senior user about the session.",
			example: "Estava um pouco cansado.",
		}),
	}),
	{
		description:
			"Close an active voice conversation and trigger summary generation.",
	},
);

export const chatVoiceCloseResponseSchema = withSwagger(
	z.object({ success: z.literal(true) }),
	{
		description:
			"Confirmation that the conversation was closed and summarised.",
	},
);

export const createSessionLogRequestSchema = withSwagger(
	z.object({
		outcome: withSwagger(
			z.enum(["Sucesso", "Cancelada", "Falha", "Abandonada"]),
			{
				description: "Session outcome reported by the senior.",
				example: "Sucesso",
			},
		),
		note: withSwagger(z.string().max(500).optional(), {
			description: "Optional note about the session.",
			example: "Estava um pouco cansado.",
		}),
	}),
	{
		description:
			"Payload to record a session outcome for the authenticated senior.",
	},
);

export const createSessionLogResponseSchema = withSwagger(
	z.object({ success: z.literal(true) }),
	{ description: "Confirmation that the session log was recorded." },
);

export const aiChatVoiceSummarizeRequestSchema = z.object({
	localSession: sessionResponseSchema,
	messages: z.array(
		z.object({
			role: z.enum(["user", "assistant"]),
			content: z.string(),
		}),
	),
	existing_facts: z.array(z.string()).optional(),
	conversation_date: z.string().optional(),
});

export const aiChatVoiceSummarizeResponseSchema = z.object({
	summary: z.string(),
	keyPoints: z
		.array(z.string())
		.nullish()
		.transform((v) => v ?? []),
	mainTopics: z
		.array(z.string())
		.nullish()
		.transform((v) => v ?? []),
	emotionalTone: z.string(),
	// LLM occasionally returns null instead of []; normalise to empty array.
	facts: z
		.array(z.string())
		.nullish()
		.transform((v) => v ?? []),
});

/**
 * Describes the compact senior context that the backend can attach before
 * forwarding a turn to the AI service.
 */
export const assistantContextSchema = withSwagger(
	z.object({
		senior_profile: withSwagger(
			z
				.object({
					nickname: z.string().optional(),
					birthdate: z.string().optional(),
					cognitive_level: z.number().optional(),
				})
				.optional(),
			{
				description: "Compact senior profile used to personalize replies.",
			},
		),
		nome: withSwagger(z.string().optional(), {
			description: "Resident's full name.",
		}),
		tratamento: withSwagger(z.string().optional(), {
			description: "How to address the resident (nickname or preferred name).",
		}),
		idade: withSwagger(z.number().optional(), {
			description: "Resident's age in years.",
		}),
		familia: withSwagger(z.string().optional(), {
			description: "Family description for the resident.",
		}),
		diagnosticos: withSwagger(z.array(z.string()).optional(), {
			description: "Medical diagnoses relevant to conversation style.",
		}),
		evitar: withSwagger(z.array(z.string()).optional(), {
			description: "Topics to avoid completely during conversation.",
		}),
		caregiver_notes: withSwagger(z.array(z.string()).optional(), {
			description:
				"Pinned caregiver or family notes that should be baked into the assistant system prompt.",
		}),
		recent_summaries: withSwagger(
			z
				.array(
					z.object({
						date: z.string().optional(),
						summary: z.string(),
						key_points: z.array(z.string()).optional(),
						main_topics: z.array(z.string()),
						emotional_tone: z.string().optional(),
					}),
				)
				.optional(),
			{
				description: "Recent conversation summaries when available.",
			},
		),
		senior_likes: withSwagger(
			z
				.object({
					football: z.array(z.string()).optional(),
					music: z.array(z.string()).optional(),
					cinema: z.array(z.string()).optional(),
					gastronomy: z.array(z.string()).optional(),
					hobbies: z.array(z.string()).optional(),
				})
				.optional(),
			{
				description: "Senior's registered interests and likes.",
			},
		),
		all_memories: withSwagger(z.array(z.string()).optional(), {
			description:
				"All known facts for this senior from senior_insights (up to 30), used to populate §6 of the system prompt.",
		}),
		retrieved_memories: withSwagger(z.array(z.string()).optional(), {
			description:
				"Semantically relevant memories retrieved via RAG for this turn (legacy — superseded by all_memories in §6).",
		}),
		mood_trend: withSwagger(z.string().optional(), {
			description:
				"Cross-session mood trend derived from recent emotional tones.",
		}),
	}),
	{
		description:
			"Internal assistant context built by the backend before forwarding the turn to the AI service.",
	},
);

/**
 * Extends the public voice-turn payload with backend-only assistant context.
 */
export const aiChatVoiceTurnPayloadSchema = chatVoiceTurnRequestSchema.extend({
	assistant_context: withSwagger(assistantContextSchema.optional(), {
		description:
			"Backend-generated context that is not supplied directly by the frontend.",
	}),
});

export const aiChatVoiceSessionRequestSchema = z.object({
	localSession: sessionResponseSchema,
	payload: chatVoiceSessionRequestSchema,
});

export const aiChatVoiceTurnRequestSchema = z.object({
	localSession: sessionResponseSchema,
	payload: aiChatVoiceTurnPayloadSchema,
});

export const aiChatVoiceTtsRequestSchema = z.object({
	localSession: sessionResponseSchema,
	payload: chatVoiceTtsRequestSchema,
});

export const aiChatVoiceStreamingStartRequestSchema = z.object({
	localSession: sessionResponseSchema,
	payload: chatVoiceStreamingStartRequestSchema,
});

export const aiChatVoiceStreamingChunkRequestSchema = z.object({
	localSession: sessionResponseSchema,
	payload: chatVoiceStreamingChunkRequestSchema,
});

export const aiChatVoiceStreamingCloseRequestSchema = z.object({
	localSession: sessionResponseSchema,
	payload: chatVoiceStreamingCloseRequestSchema,
});

export const aiChatVoiceStreamingEventsRequestSchema = z.object({
	localSession: sessionResponseSchema,
	payload: chatVoiceStreamingEventsRequestSchema,
});

export const aiChatVoiceAssistantStreamingRequestSchema = z.object({
	localSession: sessionResponseSchema,
	payload: chatVoiceAssistantStreamingRequestSchema,
});

export type ChatVoiceSessionConfig = z.infer<
	typeof chatVoiceSessionConfigSchema
>;
export type ChatConversationMessage = z.infer<
	typeof chatConversationMessageSchema
>;
export type ChatVoiceSessionRequest = z.infer<
	typeof chatVoiceSessionRequestSchema
>;
export type ChatVoiceAudioTransport = z.infer<
	typeof chatVoiceAudioTransportSchema
>;
export type ChatVoiceInputAudioMimeType = z.infer<
	typeof chatVoiceInputAudioMimeTypeSchema
>;
export type ChatVoiceSessionResponse = z.infer<
	typeof chatVoiceSessionResponseSchema
>;
export type ChatVoiceTurnRequest = z.infer<typeof chatVoiceTurnRequestSchema>;
export type ChatVoiceTurnResponse = z.infer<typeof chatVoiceTurnResponseSchema>;
export type ChatVoiceLlmUsage = z.infer<typeof chatVoiceLlmUsageSchema>;
export type ChatVoiceTtsRequest = z.infer<typeof chatVoiceTtsRequestSchema>;
export type ChatVoiceTtsResponse = z.infer<typeof chatVoiceTtsResponseSchema>;
export type ChatVoiceStreamingStartRequest = z.infer<
	typeof chatVoiceStreamingStartRequestSchema
>;
export type ChatVoiceStreamingEvent = z.infer<
	typeof chatVoiceStreamingEventSchema
>;
export type ChatVoiceStreamingStartResponse = z.infer<
	typeof chatVoiceStreamingStartResponseSchema
>;
export type ChatVoiceStreamingChunkRequest = z.infer<
	typeof chatVoiceStreamingChunkRequestSchema
>;
export type ChatVoiceStreamingChunkResponse = z.infer<
	typeof chatVoiceStreamingChunkResponseSchema
>;
export type ChatVoiceStreamingCloseRequest = z.infer<
	typeof chatVoiceStreamingCloseRequestSchema
>;
export type ChatVoiceStreamingCloseResponse = z.infer<
	typeof chatVoiceStreamingCloseResponseSchema
>;
export type ChatVoiceStreamingEventsRequest = z.infer<
	typeof chatVoiceStreamingEventsRequestSchema
>;
export type ChatVoiceStreamingEventsResponse = z.infer<
	typeof chatVoiceStreamingEventsResponseSchema
>;
export type ChatVoiceAssistantStreamingRequest = z.infer<
	typeof chatVoiceAssistantStreamingRequestSchema
>;
export type ChatVoiceAssistantStreamingEvent = z.infer<
	typeof chatVoiceAssistantStreamingEventSchema
>;
export type ChatVoiceCloseRequest = z.infer<typeof chatVoiceCloseRequestSchema>;

export type ChatVoiceCloseResponse = z.infer<
	typeof chatVoiceCloseResponseSchema
>;
export type AiChatVoiceSessionRequest = z.infer<
	typeof aiChatVoiceSessionRequestSchema
>;
export type AiChatVoiceTurnRequest = z.infer<
	typeof aiChatVoiceTurnRequestSchema
>;
export type AiChatVoiceTtsRequest = z.infer<typeof aiChatVoiceTtsRequestSchema>;
export type AiChatVoiceStreamingStartRequest = z.infer<
	typeof aiChatVoiceStreamingStartRequestSchema
>;
export type AiChatVoiceStreamingChunkRequest = z.infer<
	typeof aiChatVoiceStreamingChunkRequestSchema
>;
export type AiChatVoiceStreamingCloseRequest = z.infer<
	typeof aiChatVoiceStreamingCloseRequestSchema
>;
export type AiChatVoiceStreamingEventsRequest = z.infer<
	typeof aiChatVoiceStreamingEventsRequestSchema
>;
export type AiChatVoiceAssistantStreamingRequest = z.infer<
	typeof aiChatVoiceAssistantStreamingRequestSchema
>;
export type AiChatVoiceSummarizeRequest = z.infer<
	typeof aiChatVoiceSummarizeRequestSchema
>;
export type AiChatVoiceSummarizeResponse = z.infer<
	typeof aiChatVoiceSummarizeResponseSchema
>;
export type AssistantContext = z.infer<typeof assistantContextSchema>;

export type AiChatVoiceTurnPayload = z.infer<
	typeof aiChatVoiceTurnPayloadSchema
>;
export type CreateSessionLogRequest = z.infer<
	typeof createSessionLogRequestSchema
>;
export type CreateSessionLogResponse = z.infer<
	typeof createSessionLogResponseSchema
>;
/**
 * Describes the stable provider summary used by the WebSocket voice transport.
 */
export type ChatVoiceWsProviders = {
	asr: z.infer<typeof chatVoiceAsrProviderSchema>;
	llm: "anthropic";
	tts: "elevenlabs" | "gemini";
};

export const chatVoiceWsClientMessageSchema = z.discriminatedUnion("type", [
	z.object({
		type: z.literal("session.create"),
		session: chatVoiceSessionConfigSchema,
	}),
	z.object({
		type: z.literal("audio.input.start"),
		mime_type: chatVoiceInputAudioMimeTypeSchema,
	}),
	z.object({
		type: z.literal("audio.commit"),
		// Authoritative conversation history from the client, mirroring the HTTP
		// turn payload. The backend rebuilds its per-connection history from this
		// so intent detection and LLM context survive reconnects and HTTP fallbacks.
		conversation: z.array(chatConversationMessageSchema).max(24).optional(),
	}),
	z.object({
		type: z.literal("text.turn"),
		text: z.string().trim().min(1),
		conversation_id: z.string().optional(),
		conversation: z.array(chatConversationMessageSchema).max(24).optional(),
	}),
	z.object({
		type: z.literal("memory.game.offer"),
		text: z.string().trim().min(1).max(300),
	}),
	z.object({
		type: z.literal("memory.game.completed"),
		assistant_text: z.string().trim().min(1).max(1000),
	}),
	z.object({
		type: z.literal("assistant.prompt"),
		text: z.string().trim().min(1).max(400),
	}),
	z.object({
		type: z.literal("response.cancel"),
	}),
	z.object({
		type: z.literal("keepalive"),
	}),
	z.object({
		type: z.literal("conversation.close"),
		conversation_id: z.string(),
		user_outcome: z.enum(["Sucesso", "Cancelada", "Falha"]).optional(),
		user_note: z.string().optional(),
	}),
]);

/**
 * Enumerates all client-to-server WebSocket messages supported by the voice transport.
 */
export type ChatVoiceWsClientMessage = z.infer<
	typeof chatVoiceWsClientMessageSchema
>;

/**
 * Enumerates all server-to-client WebSocket messages emitted by the voice transport.
 */
export type ChatVoiceWsServerMessage =
	| {
			type: "session.ready";
			session: ChatVoiceSessionConfig;
			providers: ChatVoiceWsProviders;
			audio_transport: ChatVoiceAudioTransport;
	  }
	| {
			type: "transcript.interim";
			text: string;
	  }
	| {
			type: "transcript.final";
			text: string;
	  }
	| {
			type: "assistant.text.delta";
			delta: string;
	  }
	| {
			type: "assistant.text.done";
			text: string;
	  }
	| {
			type: "assistant.audio.start";
			mime_type: "audio/mpeg";
	  }
	| {
			type: "assistant.audio.done";
	  }
	| {
			type: "memory.game.start";
			game: "memory-pairs";
			intro_text: string;
			intro_audio_base64?: string;
			intro_audio_mime_type?: "audio/mpeg" | "audio/wav";
	  }
	| {
			type: "conversation.end.requested";
	  }
	| {
			type: "turn.done";
			conversation_id: string;
			retrieved_memories?: string[];
			all_memories?: string[];
			llm_usage?: ChatVoiceLlmUsage;
			recent_summaries?: Array<{
				date?: string;
				summary: string;
				key_points?: string[];
				main_topics: string[];
				emotional_tone?: string;
			}>;
	  }
	| {
			type: "conversation.closed";
			conversation_id: string;
	  }
	| {
			type: "conversation.end_confirmed";
	  }
	| {
			type: "assistant.char.timings";
			chars: string[];
			startTimesMs: number[];
	  }
	| {
			type: "error";
			message: string;
			code?: string;
	  };
