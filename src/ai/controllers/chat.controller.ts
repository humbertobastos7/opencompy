import { Body, Controller, Get, Inject, Post, Res } from "@nestjs/common";
import { ChatService } from "@/ai/chat/chat.service";
import {
	aiChatVoiceSessionRequestSchema,
	aiChatVoiceStreamingChunkRequestSchema,
	aiChatVoiceStreamingCloseRequestSchema,
	aiChatVoiceStreamingEventsRequestSchema,
	aiChatVoiceStreamingStartRequestSchema,
	aiChatVoiceSummarizeRequestSchema,
	aiChatVoiceTurnRequestSchema,
	aiChatVoiceTtsRequestSchema,
	aiChatVoiceAssistantStreamingRequestSchema, type ChatVoiceAssistantStreamingEvent,
} from "@/shared/contracts";
import type {
	AiChatVoiceSessionRequest,
	AiChatVoiceStreamingChunkRequest,
	AiChatVoiceStreamingCloseRequest,
	AiChatVoiceStreamingEventsRequest,
	AiChatVoiceStreamingStartRequest,
	AiChatVoiceSummarizeRequest,
	AiChatVoiceTurnRequest,
	AiChatVoiceTtsRequest,
	AiChatVoiceAssistantStreamingRequest,
} from "@/shared/contracts";
import type { FastifyReply } from "fastify";
import { ZodValidationPipe } from "@/shared/nest/zod-validation.pipe";
import { getElevenLabsSubscription } from "@/ai/integrations/elevenlabs";

/**
 * Serializes one assistant streaming event as NDJSON so the backend can parse
 * each frame incrementally over one long-lived internal HTTP response.
 */
const writeAssistantStreamingEvent = (
	reply: FastifyReply,
	event: ChatVoiceAssistantStreamingEvent,
)=> {
	reply.raw.write(`${JSON.stringify(event)}\n`);
};

@Controller("chat")
export class ChatController {
	constructor(
		@Inject(ChatService)
		private readonly chatService: ChatService,
	) {}

	/**
	 * Validates and normalizes a voice session before the frontend starts recording audio.
	 */
	@Post("voice/session")
	createVoiceSession(
		@Body(new ZodValidationPipe(aiChatVoiceSessionRequestSchema))
		body: AiChatVoiceSessionRequest,
	) {
		return this.chatService.createVoiceSession(body.localSession, body.payload);
	}

	/**
	 * Processes one user text or audio turn through the AI voice pipeline.
	 */
	@Post("voice/turn")
	processVoiceTurn(
		@Body(new ZodValidationPipe(aiChatVoiceTurnRequestSchema))
		body: AiChatVoiceTurnRequest,
	) {
		return this.chatService.processVoiceTurn(body.localSession, body.payload);
	}

	/**
	 * Synthesizes a short fixed assistant phrase without invoking the LLM.
	 */
	@Post("voice/tts")
	synthesizeAssistantSpeech(
		@Body(new ZodValidationPipe(aiChatVoiceTtsRequestSchema))
		body: AiChatVoiceTtsRequest,
	) {
		return this.chatService.synthesizeAssistantSpeech(
			body.localSession,
			body.payload,
		);
	}

	/**
	 * Streams assistant events as NDJSON so the backend can consume them
	 * incrementally instead of waiting for one buffered JSON payload.
	 */
	@Post("voice/assistant/stream/live")
	async streamAssistantResponseLive(
		@Body(new ZodValidationPipe(aiChatVoiceAssistantStreamingRequestSchema))
		body: AiChatVoiceAssistantStreamingRequest,
		@Res() reply: FastifyReply,
	) {
		reply.status(200);
		reply.header("Content-Type", "application/x-ndjson; charset=utf-8");
		reply.header("Cache-Control", "no-cache, no-transform");
		reply.header("X-Accel-Buffering", "no");
		reply.raw.flushHeaders?.();

		try {
			await this.chatService.streamAssistantResponse(body.localSession, {
				session: body.payload.session,
				conversation: body.payload.conversation,
				assistant_context: body.payload.assistant_context,
				inputText: body.payload.input_text,
				forcedAssistantText: body.payload.forced_assistant_text,
				onEvent: (event) => {
					writeAssistantStreamingEvent(reply, event);
				},
			});

			reply.raw.end();
		} catch (error) {
			console.error(
				"[chat.controller] ASSISTANT_STREAMING_FAILED",
				error instanceof Error ? error.message : error,
			);

			if (!reply.raw.headersSent) {
				throw error;
			}

			writeAssistantStreamingEvent(reply, {
				type: "error",
				message: error instanceof Error ? error.message : "ASSISTANT_STREAMING_LIVE_FAILED",
				code: "ASSISTANT_STREAMING_FAILED",
			});
			reply.raw.end();
		}
	}

	/**
	 * Opens a live ElevenLabs STT session to verify streaming bootstrap before the
	 * backend gateway starts forwarding audio chunks.
	 */
	@Post("voice/streaming/start")
	async startVoiceStreaming(
		@Body(new ZodValidationPipe(aiChatVoiceStreamingStartRequestSchema))
		body: AiChatVoiceStreamingStartRequest,
	) {
		const streamingHandle = await this.chatService.processVoiceTurnStreaming(
			body.localSession,
			{
				session: body.payload.session,
				audio_language: body.payload.audio_language,
				previous_text: body.payload.previous_text,
				keyterms: body.payload.keyterms,
				onTranscript: () => {
					// Phase 3 bootstrap only verifies that the upstream live session opens.
				},
			},
		);

		return {
			success: true,
			stream_id: streamingHandle.stream_id,
		};
	}

	/**
	 * Forwards one browser audio chunk to an already-open live ASR session.
	 */
	@Post("voice/streaming/chunk")
	sendVoiceStreamingChunk(
		@Body(new ZodValidationPipe(aiChatVoiceStreamingChunkRequestSchema))
		body: AiChatVoiceStreamingChunkRequest,
	) {
		return this.chatService.sendVoiceStreamingChunk(body.payload);
	}

	/**
	 * Closes one live ASR session and returns the final transcript accumulated so far.
	 */
	@Post("voice/streaming/close")
	closeVoiceStreaming(
		@Body(new ZodValidationPipe(aiChatVoiceStreamingCloseRequestSchema))
		body: AiChatVoiceStreamingCloseRequest,
	) {
		return this.chatService.closeVoiceStreaming(body.payload.stream_id);
	}

	/**
	 * Drains all pending transcript events accumulated so far for one live ASR session.
	 */
	@Post("voice/streaming/events")
	drainVoiceStreamingEvents(
		@Body(new ZodValidationPipe(aiChatVoiceStreamingEventsRequestSchema))
		body: AiChatVoiceStreamingEventsRequest,
	) {
		return this.chatService.drainVoiceStreamingEvents(body.payload.stream_id);
	}

	/**
	 * Generates a structured summary for a closed conversation transcript.
	 */
	@Post("voice/summarize")
	summarizeConversation(
		@Body(new ZodValidationPipe(aiChatVoiceSummarizeRequestSchema))
		body: AiChatVoiceSummarizeRequest,
	) {
		return this.chatService.summarizeConversation(
			body.messages,
			body.existing_facts,
			body.conversation_date,
		);
	}

	/**
	 * Returns the current ElevenLabs subscription quota for monitoring.
	 */
	@Get("elevenlabs-quota")
	getElevenLabsQuota() {
		return getElevenLabsSubscription();
	}
}
