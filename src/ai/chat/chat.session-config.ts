import { env } from "@/env/ai";
import type { ChatVoiceSessionConfig } from "@/shared/contracts";

const MIN_RESPONSE_OUTPUT_TOKENS = 80;
const MAX_RESPONSE_OUTPUT_TOKENS = 200;
const MIN_VAD_THRESHOLD = 0.03;
const MAX_VAD_THRESHOLD = 0.25;
const MIN_SILENCE_DURATION_MS = 700;
const DEFAULT_SILENCE_DURATION_MS = 1000;
const MAX_SILENCE_DURATION_MS = 3000;
const MIN_TURN_DURATION_MS = 3000;
const DEFAULT_MAX_TURN_DURATION_MS = 15000;
const MAX_TURN_DURATION_MS = 30000;
const MAX_PREFIX_PADDING_MS = 1200;
const DEFAULT_VAD_THRESHOLD = 0.07;
const PORTUGUESE_EUROPEAN_LOCALE = "pt-PT";
const DEFAULT_ASR_KEYTERMS = [
	"Compy",
	"medicacao",
	"familia",
	"cuidador",
	"cuidadora",
	"Benfica",
	"Sporting",
	"Porto",
];

export type ResolvedVoiceSessionConfig = {
	session: ChatVoiceSessionConfig;
	notes: string[];
	systemPrompt: string;
};

/**
 * Clamps numeric session settings so downstream providers always receive safe
 * ranges even when the browser sends overly aggressive VAD values.
 */
const clamp = (value: number, min: number, max: number) =>
	Math.min(max, Math.max(min, value));

/**
 * Normalizes the optional output token cap while keeping the provider request finite.
 */
const normalizeMaxResponseOutputTokens = (
	maxTokens?: ChatVoiceSessionConfig["max_response_output_tokens"],
) => {
	if (typeof maxTokens === "number") {
		return clamp(
			Math.trunc(maxTokens),
			MIN_RESPONSE_OUTPUT_TOKENS,
			MAX_RESPONSE_OUTPUT_TOKENS,
		);
	}

	if (maxTokens === "inf") {
		return MAX_RESPONSE_OUTPUT_TOKENS;
	}

	return undefined;
};

/**
 * Reads the single server-owned system prompt from the AI service environment.
 */
const resolveSystemPrompt = () => env.SYSTEM_PROMPT?.trim() || "";

/**
 * Normalizes the client session payload for provider compatibility while keeping prompt ownership on the server.
 */
export const resolveVoiceSessionConfig = (
	requested: ChatVoiceSessionConfig = {},
): ResolvedVoiceSessionConfig => {
	const requestedTurnDetection = (requested.turn_detection ?? {}) as {
		threshold?: number;
		prefix_padding_ms?: number;
		silence_duration_ms?: number;
		max_turn_duration_ms?: number;
		create_response?: boolean;
		interrupt_response?: boolean;
	};

	return {
		session: {
			model: requested.model?.trim() || undefined,
			max_response_output_tokens: normalizeMaxResponseOutputTokens(
				requested.max_response_output_tokens,
			),
			input_audio_transcription: {
				model: env.ELEVENLABS_STT_REALTIME_MODEL_ID,
				language: PORTUGUESE_EUROPEAN_LOCALE,
				keyterms: DEFAULT_ASR_KEYTERMS,
			},
			turn_detection: {
				type: "local_vad",
				threshold:
					typeof requestedTurnDetection.threshold === "number"
						? clamp(
								requestedTurnDetection.threshold,
								MIN_VAD_THRESHOLD,
								MAX_VAD_THRESHOLD,
							)
						: DEFAULT_VAD_THRESHOLD,
				prefix_padding_ms:
					typeof requestedTurnDetection.prefix_padding_ms === "number"
						? clamp(
								Math.trunc(requestedTurnDetection.prefix_padding_ms),
								0,
								MAX_PREFIX_PADDING_MS,
							)
						: undefined,
				silence_duration_ms:
					typeof requestedTurnDetection.silence_duration_ms === "number"
						? clamp(
								Math.trunc(requestedTurnDetection.silence_duration_ms),
								MIN_SILENCE_DURATION_MS,
								MAX_SILENCE_DURATION_MS,
							)
						: DEFAULT_SILENCE_DURATION_MS,
				max_turn_duration_ms:
					typeof requestedTurnDetection.max_turn_duration_ms === "number"
						? clamp(
								Math.trunc(requestedTurnDetection.max_turn_duration_ms),
								MIN_TURN_DURATION_MS,
								MAX_TURN_DURATION_MS,
							)
						: DEFAULT_MAX_TURN_DURATION_MS,
				create_response:
					typeof requestedTurnDetection.create_response === "boolean"
						? requestedTurnDetection.create_response
						: true,
				interrupt_response:
					typeof requestedTurnDetection.interrupt_response === "boolean"
						? requestedTurnDetection.interrupt_response
						: true,
			},
		},
		notes: [],
		systemPrompt: resolveSystemPrompt(),
	};
};
