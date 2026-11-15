import { Body, Controller, Inject, Logger, NotFoundException, Post } from "@nestjs/common";
import {
	ApiBadRequestResponse,
	ApiBody,
	ApiOkResponse,
	ApiOperation,
	ApiTags,
	ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { CurrentSession } from "@/backend/common/current-session.decorator";
import { InMemoryRateLimitService } from "@/backend/common/in-memory-rate-limit.service";
import { AiClientService } from "@/backend/integrations/ai.client";
import { ChatRepository } from "@/backend/modules/chat/chat.repository";
import { ConversationContextService } from "@/backend/conversation-context.service";
import {
	ErrorResponseSchema,
	type ChatVoiceCloseRequest,
	type ChatVoiceSessionRequest,
	type ChatVoiceTtsRequest,
	type ChatVoiceTurnRequest,
	type CreateSessionLogRequest,
	type AiChatVoiceSummarizeResponse,
	chatVoiceCloseRequestSchema,
	chatVoiceCloseResponseSchema,
	chatVoiceSessionRequestSchema,
	chatVoiceSessionResponseSchema,
	chatVoiceTtsRequestSchema,
	chatVoiceTtsResponseSchema,
	chatVoiceTurnRequestSchema,
	chatVoiceTurnResponseSchema,
	createSessionLogRequestSchema,
	createSessionLogResponseSchema,
} from "@/shared/contracts";
import type { LocalSession } from "@/shared/contracts";
import {
	swaggerRequestBody,
	swaggerResponse,
} from "@/shared/nest/zod-openapi";
import { ZodValidationPipe } from "@/shared/nest/zod-validation.pipe";

@ApiTags("chat")
@Controller("chat")
export class ChatController {
	private readonly logger = new Logger(ChatController.name);
	private readonly TURN_RATE_LIMIT = { max: 30, windowMs: 60_000 }; // 30 turns/min per user
	private readonly TTS_RATE_LIMIT = { max: 20, windowMs: 60_000 }; // short fixed prompts only

	constructor(
		@Inject(AiClientService)
		private readonly aiClientService: AiClientService,
		@Inject(ChatRepository)
		private readonly chatRepository: ChatRepository,
		@Inject(ConversationContextService)
		private readonly conversationContextService: ConversationContextService,
		@Inject(InMemoryRateLimitService)
		private readonly rateLimitService: InMemoryRateLimitService,
	) {}

	/**
	 * Validates the voice session configuration that the frontend will reuse for subsequent turns.
	 */
	@Post("voice/session")
	@ApiOperation({
		summary: "Create a voice AI session for the current user",
		description:
			"Validates the requested voice session through the AI service and returns the normalized configuration the frontend should reuse.",
	})
	@ApiBody(swaggerRequestBody(chatVoiceSessionRequestSchema))
	@ApiOkResponse(
		swaggerResponse(chatVoiceSessionResponseSchema, {
			description: "Voice session bootstrap payload.",
		}),
	)
	@ApiBadRequestResponse(
		swaggerResponse(ErrorResponseSchema, {
			description: "Validation error or upstream AI request problem.",
		}),
	)
	@ApiUnauthorizedResponse(
		swaggerResponse(ErrorResponseSchema, {
			description: "Authentication is required.",
		}),
	)
	async createVoiceSession(
		@CurrentSession() session: LocalSession,
		@Body(new ZodValidationPipe(chatVoiceSessionRequestSchema))
		body: ChatVoiceSessionRequest,
	) {
		return chatVoiceSessionResponseSchema.parse(
			await this.aiClientService.createVoiceSession(session, body),
		);
	}

	/**
	 * Sends one text or audio turn to the AI service, persists both messages, and returns text plus synthesized speech.
	 */
	@Post("voice/turn")
	@ApiOperation({
		summary: "Process a single voice chat turn",
		description:
			"Transcribes the optional audio input, generates an assistant reply with the server-owned SYSTEM_PROMPT, persists both messages, and returns synthesized audio when available.",
	})
	@ApiBody(swaggerRequestBody(chatVoiceTurnRequestSchema))
	@ApiOkResponse(
		swaggerResponse(chatVoiceTurnResponseSchema, {
			description: "Processed voice turn payload.",
		}),
	)
	@ApiBadRequestResponse(
		swaggerResponse(ErrorResponseSchema, {
			description: "Validation error or upstream AI request problem.",
		}),
	)
	@ApiUnauthorizedResponse(
		swaggerResponse(ErrorResponseSchema, {
			description: "Authentication is required.",
		}),
	)
	async processVoiceTurn(
		@CurrentSession() session: LocalSession,
		@Body(new ZodValidationPipe(chatVoiceTurnRequestSchema))
		body: ChatVoiceTurnRequest,
	) {
		this.rateLimitService.enforce(
			`voice:turn:${session.user.id}`,
			this.TURN_RATE_LIMIT.max,
			this.TURN_RATE_LIMIT.windowMs,
		);
		const assistantContext =
			await this.conversationContextService.buildAssistantContext(
				session.user.id,
			);

		const aiResult = await this.aiClientService.processVoiceTurn(session, {
			...body,
			assistant_context: assistantContext,
		});

		let conversationId = body.conversation_id;

		// Only create/persist when there is a real transcript — empty-transcript retry
		// turns must never produce a conversation row in the database.
		if (aiResult.user_text) {
			if (!conversationId) {
				const conversation = await this.chatRepository.openConversation(session.user.id, session.sessionId);
				conversationId = conversation.id;
			}

			await this.chatRepository.appendConversationTurns(conversationId, [
				{ role: "user", content: aiResult.user_text },
				{ role: "assistant", content: aiResult.assistant_text },
			]);
		}

		return chatVoiceTurnResponseSchema.parse({ ...aiResult, conversation_id: conversationId });
	}

	/**
	 * Synthesizes a short fixed assistant phrase using the configured Compy voice without calling the LLM.
	 */
	@Post("voice/tts")
	@ApiOperation({
		summary: "Synthesize a short voice prompt",
		description:
			"Generates audio for fixed UI prompts using the configured assistant TTS voice without invoking the language model.",
	})
	@ApiBody(swaggerRequestBody(chatVoiceTtsRequestSchema))
	@ApiOkResponse(
		swaggerResponse(chatVoiceTtsResponseSchema, {
			description: "Synthesized assistant speech payload.",
		}),
	)
	@ApiBadRequestResponse(
		swaggerResponse(ErrorResponseSchema, {
			description: "Validation error or upstream AI request problem.",
		}),
	)
	@ApiUnauthorizedResponse(
		swaggerResponse(ErrorResponseSchema, {
			description: "Authentication is required.",
		}),
	)
	async synthesizeAssistantSpeech(
		@CurrentSession() session: LocalSession,
		@Body(new ZodValidationPipe(chatVoiceTtsRequestSchema))
		body: ChatVoiceTtsRequest,
	) {
		this.rateLimitService.enforce(
			`voice:tts:${session.user.id}`,
			this.TTS_RATE_LIMIT.max,
			this.TTS_RATE_LIMIT.windowMs,
		);

		return chatVoiceTtsResponseSchema.parse(
			await this.aiClientService.synthesizeAssistantSpeech(session, body),
		);
	}

	/**
	 * Closes an active conversation and triggers summary generation via the AI service.
	 */
	@Post("voice/close")
	@ApiOperation({
		summary: "Close a voice conversation and generate a summary",
		description:
			"Marks the conversation as closed, generates a summary with key points, topics, and emotional tone, and persists it for RAG retrieval.",
	})
	@ApiBody(swaggerRequestBody(chatVoiceCloseRequestSchema))
	@ApiOkResponse(
		swaggerResponse(chatVoiceCloseResponseSchema, {
			description: "Conversation closed and summarised.",
		}),
	)
	@ApiBadRequestResponse(
		swaggerResponse(ErrorResponseSchema, {
			description: "Validation error or upstream AI request problem.",
		}),
	)
	@ApiUnauthorizedResponse(
		swaggerResponse(ErrorResponseSchema, {
			description: "Authentication is required.",
		}),
	)
	async closeVoiceConversation(
		@CurrentSession() session: LocalSession,
		@Body(new ZodValidationPipe(chatVoiceCloseRequestSchema))
		body: ChatVoiceCloseRequest,
	) {
		const conversation = await this.chatRepository.findConversation(body.conversation_id);

		if (!conversation || conversation.seniorId !== session.user.id) {
			throw new NotFoundException("Conversation not found");
		}

		const transcriptMessages =
			await this.chatRepository.findConversationMessagesForSummary(
				body.conversation_id,
			);

		// Empty conversation — no real transcript was ever persisted. Delete it
		// rather than keeping a ghost record with no usable dialogue content.
		if (transcriptMessages.length === 0) {
			await this.chatRepository.deleteConversation(body.conversation_id);
			return chatVoiceCloseResponseSchema.parse({ success: true });
		}

		let summaryData: AiChatVoiceSummarizeResponse = {
			summary: "",
			keyPoints: [],
			mainTopics: [],
			emotionalTone: "neutral",
			facts: [],
		};

		const messages = transcriptMessages;

		try {
			const existingFacts = await this.chatRepository.getAllMemories(session.user.id);
			summaryData = await this.aiClientService.summarizeConversation(session, messages, existingFacts);
			this.logger.log(`[closeVoiceConversation] facts extracted by LLM: ${JSON.stringify(summaryData.facts)}`);
		} catch (error) {
			// Summarization is best-effort: log the failure but always close the conversation.
			this.logger.warn(`Summarization failed: ${error instanceof Error ? error.message : error}`);
		}

		await this.chatRepository.closeConversation(body.conversation_id, {
			...summaryData,
			userOutcome: body.user_outcome,
			userNote: body.user_note,
		});

		if (summaryData.facts?.length) {
			this.logger.log(`[closeVoiceConversation] saving ${summaryData.facts.length} facts to senior_insights`);
			await this.chatRepository.saveExtractedFacts(
				session.user.id,
				summaryData.facts,
				body.conversation_id,
			);
		} else {
			this.logger.log("[closeVoiceConversation] no new facts to save (facts array is empty)");
		}

		this.conversationContextService.invalidateContext(session.user.id);

		return chatVoiceCloseResponseSchema.parse({ success: true });
	}

	/**
	 * Records a user-reported session outcome (Sucesso, Cancelada, Falha, Abandonada).
	 * This is completely separate from the AI conversation summary flow.
	 */
	@Post("session-log")
	@ApiOperation({
		summary: "Record a session outcome for the current senior",
		description:
			"Stores the senior's self-reported session outcome and optional note in the session_logs table. Called after voice/close when the senior selects Sucesso, Cancelada, or Falha. Abandonada is sent automatically via sendBeacon on tab close.",
	})
	@ApiBody(swaggerRequestBody(createSessionLogRequestSchema))
	@ApiOkResponse(
		swaggerResponse(createSessionLogResponseSchema, {
			description: "Session log recorded.",
		}),
	)
	@ApiBadRequestResponse(
		swaggerResponse(ErrorResponseSchema, {
			description: "Validation error.",
		}),
	)
	@ApiUnauthorizedResponse(
		swaggerResponse(ErrorResponseSchema, {
			description: "Authentication is required.",
		}),
	)
	async createSessionLog(
		@CurrentSession() session: LocalSession,
		@Body(new ZodValidationPipe(createSessionLogRequestSchema))
		body: CreateSessionLogRequest,
	) {
		await this.chatRepository.createSessionLog({
			seniorId: session.user.id,
			outcome: body.outcome,
			note: body.note,
		});
		return createSessionLogResponseSchema.parse({ success: true });
	}
}
