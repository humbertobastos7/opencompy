import {
	BadGatewayException,
	BadRequestException,
	Injectable,
	InternalServerErrorException,
} from "@nestjs/common";
import { env } from "@/env/backend";
import type {
	AiChatVoiceTurnPayload,
	LocalSession,
	ChatVoiceSessionRequest,
	ChatVoiceStreamingChunkRequest,
	ChatVoiceStreamingChunkResponse,
	ChatVoiceStreamingCloseRequest,
	ChatVoiceStreamingCloseResponse,
	ChatVoiceStreamingEventsRequest,
	ChatVoiceStreamingEventsResponse,
	ChatVoiceStreamingStartRequest,
	ChatVoiceStreamingStartResponse,
	ChatVoiceTtsRequest,
	ChatVoiceTtsResponse,
	ChatVoiceAssistantStreamingRequest,
	ChatVoiceAssistantStreamingEvent,
} from "@/shared/contracts";
import {
	ElevenLabsQuotaResponseSchema,
	aiChatVoiceSessionRequestSchema,
	aiChatVoiceStreamingChunkRequestSchema,
	aiChatVoiceStreamingCloseRequestSchema,
	aiChatVoiceStreamingEventsRequestSchema,
	aiChatVoiceStreamingStartRequestSchema,
	aiChatVoiceSummarizeRequestSchema,
	aiChatVoiceSummarizeResponseSchema,
	aiChatVoiceTurnRequestSchema,
	aiChatVoiceTtsRequestSchema,
	aiChatVoiceAssistantStreamingRequestSchema,
	chatVoiceSessionResponseSchema,
	chatVoiceStreamingChunkResponseSchema,
	chatVoiceStreamingCloseResponseSchema,
	chatVoiceStreamingEventsResponseSchema,
	chatVoiceStreamingStartResponseSchema,
	chatVoiceTtsResponseSchema,
	chatVoiceTurnResponseSchema,
} from "@/shared/contracts";
import type { ZodSchema } from "zod";

type AiErrorResponse = {
	message?: string;
	error?: string;
	statusCode?: number;
};

@Injectable()
export class AiClientService {
	private readonly aiBaseUrl = new URL("/api/", env.AI_SERVICE_URL);
	private readonly GET_TIMEOUT_MS = 10_000;
	private readonly POST_TIMEOUT_MS = 90_000;
	private readonly STREAM_TIMEOUT_MS = 180_000;

	/**
	 * Forwards session bootstrap requests to the dedicated AI service.
	 */
	async createVoiceSession(
		localSession: LocalSession,
		payload: ChatVoiceSessionRequest,
	) {
		return this.postValidated(
			"chat/voice/session",
			{
				localSession,
				payload,
			},
			aiChatVoiceSessionRequestSchema,
			chatVoiceSessionResponseSchema,
		);
	}

	/**
	 * Forwards text or audio turns to the dedicated AI service.
	 */
	async processVoiceTurn(
		localSession: LocalSession,
		payload: AiChatVoiceTurnPayload,
	) {
		return this.postValidated(
			"chat/voice/turn",
			{
				localSession,
				payload,
			},
			aiChatVoiceTurnRequestSchema,
			chatVoiceTurnResponseSchema,
		);
	}

	/**
	 * Forwards short fixed TTS requests to the AI service without invoking the LLM.
	 */
	async synthesizeAssistantSpeech(
		localSession: LocalSession,
		payload: ChatVoiceTtsRequest,
	): Promise<ChatVoiceTtsResponse> {
		return this.postValidated(
			"chat/voice/tts",
			{
				localSession,
				payload,
			},
			aiChatVoiceTtsRequestSchema,
			chatVoiceTtsResponseSchema,
		);
	}

	/**
	 * Consumes the live NDJSON assistant stream from the AI service and forwards
	 * each parsed event to the provided callback as soon as it arrives.
	 */
	async streamAssistantResponseLive(
		localSession: LocalSession,
		payload: ChatVoiceAssistantStreamingRequest,
		onEvent: (event: ChatVoiceAssistantStreamingEvent) => void,
	): Promise<void> {
		const requestBody = {
			localSession,
			payload,
		};

		const parsedRequest =
			aiChatVoiceAssistantStreamingRequestSchema.safeParse(requestBody);

		if (!parsedRequest.success) {
			throw new InternalServerErrorException(
				`AI_SERVICE_INVALID_REQUEST: chat/voice/assistant/stream/live: ${JSON.stringify(parsedRequest.error.flatten())}`,
			);
		}

		const response = await fetch(
			new URL("chat/voice/assistant/stream/live", this.aiBaseUrl),
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(parsedRequest.data),
				signal: AbortSignal.timeout(this.STREAM_TIMEOUT_MS),
			},
		);

		if (!response.ok || !response.body) {
			const raw = await response.text().catch(() => "");
			const parsed = this.tryParseJson(raw);
			const parsedError = this.asAiErrorResponse(parsed);
			const message =
				parsedError?.message ||
				parsedError?.error ||
				raw ||
				"AI_SERVICE_REQUEST_FAILED";

			if (response.status >= 400 && response.status < 500) {
				throw new BadRequestException(message);
			}

			throw new BadGatewayException(message);
		}

		const decoder = new TextDecoder();
		const reader = response.body.getReader();
		let buffer = "";

		while (true) {
			const { done, value } = await reader.read();

			if (done) {
				break;
			}

			buffer += decoder.decode(value, { stream: true });

			while (true) {
				const newLineIndex = buffer.indexOf("\n");

				if (newLineIndex === -1) {
					break;
				}

				const rawLine = buffer.slice(0, newLineIndex).trim();
				buffer = buffer.slice(newLineIndex + 1);

				if (!rawLine) {
					continue;
				}

				const parsedEvent = JSON.parse(
					rawLine,
				) as ChatVoiceAssistantStreamingEvent;

				onEvent(parsedEvent);
			}
		}

		const trailingLine = buffer.trim();
		if (trailingLine) {
			const parsedEvent = JSON.parse(
				trailingLine,
			) as ChatVoiceAssistantStreamingEvent;

			onEvent(parsedEvent);
		}
	}

	/**
	 * Forwards live ASR bootstrap requests to the AI service so the backend can
	 * verify the upstream ElevenLabs STT stream opens successfully.
	 */
	async startVoiceStreaming(
		localSession: LocalSession,
		payload: ChatVoiceStreamingStartRequest,
	): Promise<ChatVoiceStreamingStartResponse> {
		return this.postValidated(
			"chat/voice/streaming/start",
			{
				localSession,
				payload,
			},
			aiChatVoiceStreamingStartRequestSchema,
			chatVoiceStreamingStartResponseSchema,
		);
	}

	/**
	 * Forwards one browser audio chunk to an already-open live ASR session in the AI service.
	 */
	async sendVoiceStreamingChunk(
		localSession: LocalSession,
		payload: ChatVoiceStreamingChunkRequest,
	): Promise<ChatVoiceStreamingChunkResponse> {
		return this.postValidated(
			"chat/voice/streaming/chunk",
			{
				localSession,
				payload,
			},
			aiChatVoiceStreamingChunkRequestSchema,
			chatVoiceStreamingChunkResponseSchema,
		);
	}

	/**
	 * Closes one live ASR session in the AI service and returns the final transcript.
	 */
	async closeVoiceStreaming(
		localSession: LocalSession,
		payload: ChatVoiceStreamingCloseRequest,
	): Promise<ChatVoiceStreamingCloseResponse> {
		return this.postValidated(
			"chat/voice/streaming/close",
			{
				localSession,
				payload,
			},
			aiChatVoiceStreamingCloseRequestSchema,
			chatVoiceStreamingCloseResponseSchema,
		);
	}

	/**
	 * Drains all transcript events accumulated so far for one live ASR session in the AI service.
	 */
	async drainVoiceStreamingEvents(
		localSession: LocalSession,
		payload: ChatVoiceStreamingEventsRequest,
	): Promise<ChatVoiceStreamingEventsResponse> {
		return this.postValidated(
			"chat/voice/streaming/events",
			{
				localSession,
				payload,
			},
			aiChatVoiceStreamingEventsRequestSchema,
			chatVoiceStreamingEventsResponseSchema,
		);
	}

	/**
	 * Fetches the current ElevenLabs subscription quota from the AI service.
	 */
	async getElevenLabsQuota() {
		return this.get("chat/elevenlabs-quota", ElevenLabsQuotaResponseSchema);
	}

	/**
	 * Forwards a conversation transcript to the AI service for summarisation.
	 */
	async summarizeConversation(
		localSession: LocalSession,
		messages: Array<{ role: "user" | "assistant"; content: string }>,
		existingFacts?: string[],
		conversationDate?: string,
	) {
		return this.postValidated(
			"chat/voice/summarize",
			{
				localSession,
				messages,
				existing_facts: existingFacts,
				conversation_date: conversationDate,
			},
			aiChatVoiceSummarizeRequestSchema,
			aiChatVoiceSummarizeResponseSchema,
		);
	}

	/**
	 * Validates one internal AI-service request before it crosses the process boundary.
	 */
	private async postValidated<TRequest, TResponse>(
		path: string,
		body: TRequest,
		requestSchema: ZodSchema<TRequest>,
		responseSchema: { parse: (value: unknown) => TResponse },
	) {
		const parsedRequest = requestSchema.safeParse(body);

		// Fail fast on backend-side wiring bugs so the frontend receives a precise
		// endpoint-scoped error instead of a generic upstream validation message.
		if (!parsedRequest.success) {
			throw new InternalServerErrorException(
				`AI_SERVICE_INVALID_REQUEST: ${path}: ${JSON.stringify(parsedRequest.error.flatten())}`,
			);
		}

		return this.post(path, parsedRequest.data, responseSchema);
	}

	/**
	 * Executes a JSON GET against the AI service and validates the response contract.
	 */
	private async get<TResponse>(
		path: string,
		responseSchema: { parse: (value: unknown) => TResponse },
	) {
		const response = await fetch(new URL(path, this.aiBaseUrl), {
			method: "GET",
			signal: AbortSignal.timeout(this.GET_TIMEOUT_MS),
		});

		const raw = await response.text();
		const parsed = this.tryParseJson(raw);

		if (!response.ok) {
			const parsedError = this.asAiErrorResponse(parsed);
			const message =
				parsedError?.message ||
				parsedError?.error ||
				raw ||
				"AI_SERVICE_REQUEST_FAILED";

			if (response.status >= 400 && response.status < 500) {
				throw new BadRequestException(message);
			}

			throw new BadGatewayException(message);
		}

		try {
			return responseSchema.parse(parsed ?? raw);
		} catch (error) {
			throw new InternalServerErrorException(
				error instanceof Error
					? `AI_SERVICE_INVALID_RESPONSE: ${error.message}`
					: "AI_SERVICE_INVALID_RESPONSE",
			);
		}
	}

	/**
	 * Executes a JSON POST against the AI service and validates the response contract.
	 */
	private async post<TResponse>(
		path: string,
		body: unknown,
		responseSchema: { parse: (value: unknown) => TResponse },
	) {
		const response = await fetch(new URL(path, this.aiBaseUrl), {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify(body),
			signal: AbortSignal.timeout(this.POST_TIMEOUT_MS),
		});

		const raw = await response.text();
		const parsed = this.tryParseJson(raw);

		if (!response.ok) {
			const parsedError = this.asAiErrorResponse(parsed);
			const message =
				parsedError?.message ||
				parsedError?.error ||
				raw ||
				"AI_SERVICE_REQUEST_FAILED";

			if (response.status >= 400 && response.status < 500) {
				throw new BadRequestException(message);
			}

			throw new BadGatewayException(message);
		}

		try {
			return responseSchema.parse(parsed ?? raw);
		} catch (error) {
			throw new InternalServerErrorException(
				error instanceof Error
					? `AI_SERVICE_INVALID_RESPONSE: ${error.message}`
					: "AI_SERVICE_INVALID_RESPONSE",
			);
		}
	}

	/**
	 * Attempts to parse JSON AI responses while gracefully preserving plain-text payloads.
	 */
	private tryParseJson(raw: string): AiErrorResponse | unknown {
		if (!raw) {
			return null;
		}

		try {
			return JSON.parse(raw);
		} catch {
			return raw;
		}
	}

	/**
	 * Narrows arbitrary upstream payloads to the shared AI error shape when possible.
	 */
	private asAiErrorResponse(value: unknown): AiErrorResponse | null {
		if (!value || typeof value !== "object") {
			return null;
		}

		return value as AiErrorResponse;
	}
}
