import { ZodError } from "zod";
import { Inject, Injectable } from "@nestjs/common";
import type { OnModuleInit } from "@nestjs/common";
import { HttpAdapterHost } from "@nestjs/core";
import type { WebSocket } from "@fastify/websocket";
import type { FastifyRequest } from "fastify";
import { ConversationContextService } from "@/backend/conversation-context.service";
import { preTranscribeAudioWithElevenLabs } from "@/backend/integrations/elevenlabs.stt";
import { AiClientService } from "@/backend/integrations/ai.client";
import { LocalUserService } from "@/backend/modules/local-user/local-user.service";
import { ChatRepository } from "@/backend/modules/chat/chat.repository";
import {
	chatVoiceWsClientMessageSchema,
	chatVoiceInputAudioMimeTypeSchema,
	type LocalSession,
	type ChatVoiceInputAudioMimeType,
	type ChatConversationMessage,
	type ChatVoiceSessionConfig,
	type ChatVoiceLlmUsage,
	type ChatVoiceWsClientMessage,
	type ChatVoiceWsServerMessage,
	MEMORY_GAME_OFFER_TEXT,
} from "@/shared/contracts";

const MEMORY_GAME_START_REPLY = "Vamos lá jogar então.";
const VOICE_END_CONFIRMATION_REPLY =
	"De certeza? Podemos conversar mais uns minutos, se quiser.";
const VOICE_END_GOODBYE_REPLY =
	"Está bem. Foi bom conversar consigo. Até à próxima.";
const memoryGameIntroText = (seniorName: string) =>
	`${seniorName}, este é o jogo da memória. O objetivo é encontrar duas cartas com o mesmo desenho. Carregue em duas cartas para começar a jogar.`;

const BASE_ASR_KEYTERMS = [
	"Compy",
	"medicacao",
	"familia",
	"cuidador",
	"cuidadora",
	"Benfica",
	"Sporting",
	"Porto",
];

const getSeniorDisplayName = (localSession: LocalSession) =>
	localSession.user.nickname?.trim() ||
	localSession.user.name?.trim().split(/\s+/)[0] ||
	"Olá";

const addAsrKeyterm = (
	keyterms: string[],
	seen: Set<string>,
	value?: string | null,
) => {
	const normalized = value?.trim().replace(/\s+/g, " ");
	if (!normalized || normalized.length > 20) {
		return;
	}

	const key = normalized.toLocaleLowerCase("pt-PT");
	if (seen.has(key)) {
		return;
	}

	seen.add(key);
	keyterms.push(normalized);
};

const buildAsrKeyterms = (
	session: ChatVoiceSessionConfig,
	localSession: LocalSession,
	conversationHistory: ChatConversationMessage[],
) => {
	const keyterms: string[] = [];
	const seen = new Set<string>();

	for (const keyterm of [
		...BASE_ASR_KEYTERMS,
		...(session.input_audio_transcription?.keyterms ?? []),
	]) {
		addAsrKeyterm(keyterms, seen, keyterm);
	}

	addAsrKeyterm(keyterms, seen, localSession.user.nickname);
	addAsrKeyterm(keyterms, seen, localSession.user.name?.split(/\s+/)[0]);

	for (const turn of conversationHistory.slice(-6)) {
		for (const match of turn.content.matchAll(/\b[\p{Lu}][\p{L}]{2,19}\b/gu)) {
			addAsrKeyterm(keyterms, seen, match[0]);
			if (keyterms.length >= 50) {
				return keyterms;
			}
		}
	}

	return keyterms.slice(0, 50);
};

const buildAsrPreviousText = (conversationHistory: ChatConversationMessage[]) => {
	const previousTurn = [...conversationHistory]
		.reverse()
		.find((turn) => turn.role === "user" && turn.content.trim().length > 0);
	const text = previousTurn?.content.trim().replace(/\s+/g, " ");

	if (!text) {
		return undefined;
	}

	return text.length <= 50 ? text : text.slice(-50);
};

const normalizeTranscriptForComparison = (text: string) =>
	normalizeGameIntentText(text).replace(/\s+/g, " ").trim();

const shouldPreferBatchTranscript = (input: {
	realtimeTranscript: string;
	batchTranscript?: string;
}) => {
	const batchTranscript = input.batchTranscript?.trim();
	const realtimeTranscript = input.realtimeTranscript.trim();

	if (!batchTranscript) {
		return false;
	}

	if (!realtimeTranscript) {
		return true;
	}

	if (
		normalizeTranscriptForComparison(batchTranscript) ===
		normalizeTranscriptForComparison(realtimeTranscript)
	) {
		return false;
	}

	// Avoid replacing a complete realtime turn with a clearly truncated batch result.
	return batchTranscript.length >= Math.max(3, realtimeTranscript.length * 0.45);
};

const normalizeGameIntentText = (text: string) =>
	text
		.normalize("NFD")
		.replace(/\p{Diacritic}/gu, "")
		.toLocaleLowerCase("pt-PT")
		.replace(/[^\p{Letter}\p{Number}\s]/gu, " ")
		.replace(/\s+/g, " ")
		.trim();

const normalizeVoiceEndIntentText = normalizeGameIntentText;

const voiceEndActivityPattern = "(conversa|conversar|falar)";
const topicStartPattern = "(sobre|acerca\\s+de|a\\s+respeito\\s+de|de|do|da|dos|das)";

const isTopicBoundedVoiceEndPhrase = (text: string) => {
	if (/\b(de todo|de maneira nenhuma)\b/.test(text)) {
		return false;
	}

	return (
		new RegExp(
			`\\b(nao|n)\\s+(me\\s+)?(apetece|aptece|apetecia|quero|queria)\\s+${voiceEndActivityPattern}(\\s+mais)?\\s+${topicStartPattern}\\b`,
		).test(text) ||
		new RegExp(
			`\\b(ja\\s+)?(nao|n)\\s+(quero|queria)\\s+${voiceEndActivityPattern}(\\s+(mais|agora))?\\s+${topicStartPattern}\\b`,
		).test(text) ||
		new RegExp(
			`\\b(estou|tou)\\s+(farto|farta|cansado|cansada)\\s+(de\\s+)?${voiceEndActivityPattern}\\s+${topicStartPattern}\\b`,
		).test(text) ||
		new RegExp(
			`\\b(chega|basta)\\s+(de\\s+)?${voiceEndActivityPattern}\\s+${topicStartPattern}\\b`,
		).test(text)
	);
};

export const isVoiceEndDirectRequest = (inputText: string) => {
	const text = normalizeVoiceEndIntentText(inputText);
	if (!text) return false;

	return (
		/\b(desliga|desligar|desliga te|desligate|desliguem|desligue)\b/.test(text) ||
		/\b(fecha|fechar|encerra|encerrar)\s+(a\s+)?(app|aplicacao|sessao|conversa)?\b/.test(text) ||
		/\b(termina|terminar|acaba|acabar)\s+(a\s+)?conversa\b/.test(text) ||
		/\b(sair|logout|terminar\s+sessao|acabar\s+sessao)\b/.test(text) ||
		/\b(adeus|xau|chau|tchau|ate\s+(logo|manha|a\s+proxima))\b/.test(text)
	);
};

export const isVoiceEndRequest = (inputText: string) => {
	const text = normalizeVoiceEndIntentText(inputText);
	if (!text) return false;
	if (isTopicBoundedVoiceEndPhrase(text)) return false;

	return (
		new RegExp(
			`\\b(nao|n)\\s+(me\\s+)?(apetece|aptece|apetecia|quero|queria)\\s+${voiceEndActivityPattern}(\\s+mais|\\s+agora)?\\b`,
		).test(text) ||
		new RegExp(
			`\\b(ja\\s+)?(nao|n)\\s+(quero|queria)\\s+${voiceEndActivityPattern}(\\s+(mais|agora))?\\b`,
		).test(text) ||
		new RegExp(
			`\\b(estou|tou)\\s+(farto|farta|cansado|cansada)\\s+(de\\s+)?${voiceEndActivityPattern}\\b`,
		).test(text) ||
		/\b(vamos|podemos)\s+(parar|terminar|acabar)\b/.test(text) ||
		/\b(parar|terminar|acabar)\s+(a\s+)?(conversa|conversar)\b/.test(text) ||
		/\b(chega|basta)\s+(de\s+)?(conversa|conversar|falar)?\b/.test(text) ||
		/\b(nao|n)\s+(me\s+)?apetece\s+mais\b/.test(text)
	);
};

export const isVoiceEndConfirmationClose = (inputText: string) => {
	const text = normalizeVoiceEndIntentText(inputText);
	if (!text) return false;

	return (
		isVoiceEndRequest(text) ||
		/\b(nao|n)\s+(quero|queria)\s+(continuar|conversar|falar)\b/.test(text) ||
		/\b(nao|n)\s+(obrigado|obrigada)\b/.test(text) ||
		/\b(prefiro|quero)\s+(parar|terminar|acabar)\b/.test(text) ||
		/\b(melhor|e melhor)\s+(parar|terminar|acabar)\b/.test(text)
	);
};

const wasAssistantOfferingGame = (
	conversationHistory: ChatConversationMessage[],
) => {
	const lastAssistantTurn = [...conversationHistory]
		.reverse()
		.find((turn) => turn.role === "assistant");

	if (!lastAssistantTurn?.content) return false;

	const assistantText = normalizeGameIntentText(lastAssistantTurn.content);
	return (
		/\b(jogo|jogar|memoria|brincadeira)\b/.test(assistantText) &&
		/\b(quer|queria|gostava|vamos|podemos|apetece|jogamos|jogar)\b/.test(
			assistantText,
		)
	);
};

// Matches an assistant turn offering to play the game *again*. Patterns are
// adjacency-based (play verb next to a repeat cue, or a repeat cue next to a
// game noun) so a multi-sentence reply that merely mentions playing AND, in a
// separate clause, "mais uma história" does not falsely arm a bare "sim".
const repeatGameOfferPatterns = [
	// "jogar outra vez", "jogamos de novo", "jogar novamente", "jogar mais uma (vez)"
	/\bjog\w+\s+(outra\s+vez|de\s+novo|novamente|mais\s+uma|mais\s+um)\b/,
	// "mais um jogo", "outra partida", "nova rodada", "outra vez o jogo"
	/\b(outra|mais\s+uma|mais\s+um|nova)\s+(vez\s+)?(o\s+|a\s+)?(jog\w+|partida|rodada|ronda)\b/,
	// "repetir o jogo", "repetimos a partida"
	/\brepet\w+\s+(o\s+|a\s+)?(jog\w+|partida|brincadeira)\b/,
	// "voltar a jogar"
	/\bvoltar\s+a\s+jog\w+\b/,
];

const wasAssistantOfferingRepeatGame = (
	conversationHistory: ChatConversationMessage[],
) => {
	const lastAssistantTurn = [...conversationHistory]
		.reverse()
		.find((turn) => turn.role === "assistant");

	if (!lastAssistantTurn?.content) return false;

	const assistantText = normalizeGameIntentText(lastAssistantTurn.content);
	return repeatGameOfferPatterns.some((pattern) => pattern.test(assistantText));
};

const explicitGameAcceptancePattern = new RegExp(
	[
		"\\b(sim|claro|vamos|bora|quero|pode\\s+ser|aceito|esta\\s+bem|ok|okay|forca|alinho)\\b",
		".*",
		"\\b(jogar|jogo|memoria|brincadeira)\\b",
	].join(""),
);

const explicitGameAcceptanceReversePattern = new RegExp(
	[
		"\\b(jogar|jogo|memoria|brincadeira)\\b",
		".*",
		"\\b(sim|claro|vamos|bora|quero|pode\\s+ser|aceito|esta\\s+bem|ok|okay|forca|alinho)\\b",
	].join(""),
);

export const shouldStartMemoryGame = (
	inputText: string,
	conversationHistory: ChatConversationMessage[],
) => {
	const text = normalizeGameIntentText(inputText);
	if (!text) return false;
	if (
		/\b(nao|n)\s+(quero|queria|me\s+apetece|apetece)\s+(jogar|um\s+jogo|jogo)\b/.test(text) ||
		/\b(nao|n)\s+(jogo|jogar|joga)\b/.test(text)
	) {
		return false;
	}

	const simpleAffirmation =
		/\b(sim|claro|vamos|bora|pode\s+ser|esta\s+bem|ok|okay|forca|alinho)\b/.test(
			text,
		);

	if (simpleAffirmation && wasAssistantOfferingRepeatGame(conversationHistory)) {
		return true;
	}

	// Strong direct requests always trigger regardless of recent game history.
	const strongDirectRequest =
		/\b(vamos|bora)\s+(la\s+)?jogar\b/.test(text) ||
		/\b(comeca|comecar|inicia|iniciar|abre|abrir)\s+(o\s+|um\s+)?(jogo|jogo\s+da\s+memoria|memoria|brincadeira)\b/.test(
			text,
		) ||
		/\b(comeca|comecar|inicia|iniciar)\s+(a\s+)?(jogar|brincadeira)\b/.test(
			text,
		) ||
		/\b(quero|queria|gostava|podemos|posso|apetece)\s+(me\s+)?(de\s+)?jogar\b/.test(
			text,
		) ||
		/\b(quero|queria|gostava|podemos|posso|apetece)\s+(me\s+)?(de\s+)?(um\s+)?jogo\b/.test(
			text,
		) ||
		/\b(quero|queria|gostava|podemos|posso)\s+(o\s+)?jogo\s+da\s+memoria\b/.test(
			text,
		) ||
		/\bjogar\s+(um\s+|o\s+)?jogo\b/.test(text) ||
		/\bjogar\s+memoria\b/.test(text) ||
		// The senior explicitly asks to play *again* in their own words
		// ("(eu) jogo outra vez", "jogar de novo", "mais um jogo", "outra
		// partida"...). Reuses the replay-offer patterns against the senior's
		// utterance so it triggers however the assistant phrased (or merely
		// implied) the invitation.
		repeatGameOfferPatterns.some((pattern) => pattern.test(text));

	if (strongDirectRequest) return true;

	const explicitGameAcceptance =
		explicitGameAcceptancePattern.test(text) ||
		explicitGameAcceptanceReversePattern.test(text);

	return explicitGameAcceptance && wasAssistantOfferingGame(conversationHistory);
};

const appendAssistantMemoryGameOffer = (
	conversationHistory: ChatConversationMessage[],
	text: string,
) => {
	const normalizedText = text.trim() || MEMORY_GAME_OFFER_TEXT;
	conversationHistory.push({
		role: "assistant",
		content: normalizedText,
	});

	if (conversationHistory.length > 24) {
		conversationHistory.splice(0, conversationHistory.length - 24);
	}
};

const appendMemoryGameCompleted = (
	conversationHistory: ChatConversationMessage[],
	assistantTextInput: string,
) => {
	const assistantText = assistantTextInput.trim();
	if (!assistantText) {
		return;
	}

	conversationHistory.push({
		role: "assistant",
		content: assistantText,
	});

	if (conversationHistory.length > 24) {
		conversationHistory.splice(0, conversationHistory.length - 24);
	}
};

/**
 * Rebuilds the per-connection conversation history from the authoritative copy
 * the client sends with each turn. The frontend history survives reconnects and
 * HTTP fallbacks, so syncing from it keeps intent detection (e.g. accepting a
 * replay offer) and LLM context correct even when this socket missed earlier
 * turns. No-op when the client omits the field (older clients).
 */
export const applyClientConversationHistory = (
	conversationHistory: ChatConversationMessage[],
	provided: ChatConversationMessage[] | undefined,
) => {
	if (!provided) return;

	const sanitized = provided
		.map((turn) => ({ role: turn.role, content: turn.content.trim() }))
		.filter((turn) => turn.content.length > 0)
		.slice(-24);

	conversationHistory.splice(0, conversationHistory.length, ...sanitized);
};

/**
 * Hosts the backend WebSocket entrypoint that transports voice turns.
 */
@Injectable()
export class VoiceGateway implements OnModuleInit {
	constructor(
		@Inject(AiClientService)
		private readonly aiClientService: AiClientService,
		@Inject(ChatRepository)
		private readonly chatRepository: ChatRepository,
		@Inject(ConversationContextService)
		private readonly conversationContextService: ConversationContextService,
		@Inject(LocalUserService)
		private readonly localUserService: LocalUserService,
		@Inject(HttpAdapterHost)
		private readonly httpAdapterHost: HttpAdapterHost,
	) {}

	/**
	 * Registers the WebSocket route on the underlying Fastify instance.
	 */
	onModuleInit() {
		const fastify = this.httpAdapterHost.httpAdapter.getInstance();

		fastify.get(
			"/api/chat/voice/ws",
			{ websocket: true },
			(socket: WebSocket, request: FastifyRequest) => {
				void this.handleConnection(socket, request);
			},
		);
	}

	/**
	 * Handles one voice WebSocket connection for the local user and routes typed
	 * client messages through the existing backend voice pipeline.
	 */
	private async handleConnection(socket: WebSocket, request: FastifyRequest) {
		// Key of the browser visit; groups every turn of this visit in one conversation.
		const visitKey = (request.query as { visit?: string } | undefined)?.visit;

		// Per-connection turn rate limiter — limits text.turn and audio.commit.
		// Binary audio chunks are not counted since they belong to a single turn.
		const TURN_RATE_LIMIT = { max: 20, windowMs: 60_000 };
		let turnCount = 0;
		let turnWindowStart = Date.now();
		const checkTurnRateLimit = (): boolean => {
			const now = Date.now();
			if (now - turnWindowStart > TURN_RATE_LIMIT.windowMs) {
				turnCount = 0;
				turnWindowStart = now;
			}
			return ++turnCount <= TURN_RATE_LIMIT.max;
		};

		let activeSession: ChatVoiceSessionConfig | null = null;
		let activeConversationId: string | undefined;
		let activeStreamingStreamId: string | undefined;
		let lastResolvedUserText: string | undefined;
		let pendingVoiceEndConfirmation = false;
		let transcriptDrainTimer: ReturnType<typeof setInterval> | null = null;
		const conversationHistory: ChatConversationMessage[] = [];

		// Buffers one browser-recorded audio turn until the client sends audio.commit.
		let activeAudioMimeType: ChatVoiceInputAudioMimeType | undefined;
		const pendingAudioChunks: Buffer[] = [];

		// Keep frames that arrive before the local user loads so `session.create` is never lost.
		const pendingMessages: Array<{
			raw: Buffer | ArrayBuffer | Buffer[];
			isBinary: boolean;
		}> = [];
		let localSession:
			| Awaited<ReturnType<typeof this.localUserService.getSession>>
			| undefined = undefined;
		let localUserResolved = false;
		let messageProcessingQueue = Promise.resolve();

		/**
		 * Opens one fresh live ASR stream for the normalized voice session so
		 * every recorded turn can forward browser chunks immediately.
		 */
		let openStreamingSession: (session: ChatVoiceSessionConfig) => Promise<void> =
			async () => {
				throw new Error("STREAMING_SESSION_NOT_READY");
			};

		// Clean up the live ElevenLabs STT session when the browser disconnects so the
		// AI service's activeStreamingSessions Map does not leak entries.
		socket.on("close", () => {
			if (activeStreamingStreamId) {
				void this.aiClientService
					.closeVoiceStreaming(
						// The local user may not have loaded yet on very early disconnects — guard.
						localSession ?? ({ user: { id: "disconnected" } } as never),
						{ stream_id: activeStreamingStreamId },
					)
					.catch(() => {
						// Best-effort — session may already be gone.
					});
				activeStreamingStreamId = undefined;
			}
		});

		/**
		 * Stops the periodic ElevenLabs STT interim drain loop for the current socket.
		 */
		const stopTranscriptDrainLoop = () => {
			if (transcriptDrainTimer) {
				clearInterval(transcriptDrainTimer);
				transcriptDrainTimer = null;
			}
		};

		const isExpectedClosedStreamingSession = (error: unknown) =>
			error instanceof Error && error.message.includes("Streaming session not found");

		/**
		 * Starts a lightweight polling loop that forwards interim transcript events
		 * without blocking each incoming audio chunk on an extra HTTP round-trip.
		 */
		const startTranscriptDrainLoop = () => {
			if (transcriptDrainTimer || !activeStreamingStreamId) {
				return;
			}

			transcriptDrainTimer = setInterval(() => {
				const streamId = activeStreamingStreamId;
				if (!streamId) {
					stopTranscriptDrainLoop();
					return;
				}

				void this.aiClientService
					.drainVoiceStreamingEvents(userSession, {
						stream_id: streamId,
					})
					.then((streamingEventsResponse) => {
						for (const event of streamingEventsResponse.events) {
							if (event.type !== "transcript.interim") {
								continue;
							}

							this.sendMessage(socket, event);
						}
					})
					.catch((error) => {
						if (isExpectedClosedStreamingSession(error)) {
							stopTranscriptDrainLoop();
							return;
						}

						console.warn(
							"[voice.gateway] TRANSCRIPT_DRAIN_FAILED",
							error instanceof Error ? error.message : error,
						);
					});
			}, 150);
		};

		const sendMemoryGameStartTurn = async (
			messageUserSession: LocalSession,
			userText: string,
		) => {
			const assistantTextDone = MEMORY_GAME_START_REPLY;
			const introText = memoryGameIntroText(
				getSeniorDisplayName(messageUserSession),
			);
			const startSpeechPromise = this.aiClientService.synthesizeAssistantSpeech(
				messageUserSession,
				{ text: assistantTextDone },
			);
			const introSpeechPromise = this.aiClientService.synthesizeAssistantSpeech(
				messageUserSession,
				{ text: introText },
			);
			const [startSpeechResult, introSpeechResult] = await Promise.allSettled([
				startSpeechPromise,
				introSpeechPromise,
			]);
			const startSpeech =
				startSpeechResult.status === "fulfilled"
					? startSpeechResult.value
					: undefined;
			const introSpeech =
				introSpeechResult.status === "fulfilled"
					? introSpeechResult.value
					: undefined;

			if (startSpeechResult.status === "rejected") {
				console.warn(
					"[voice.gateway] MEMORY_GAME_START_TTS_FAILED",
					startSpeechResult.reason,
				);
			}
			if (introSpeechResult.status === "rejected") {
				console.warn(
					"[voice.gateway] MEMORY_GAME_INTRO_TTS_FAILED",
					introSpeechResult.reason,
				);
			}

			this.sendMessage(socket, {
				type: "memory.game.start",
				game: "memory-pairs",
				intro_text: introText,
				intro_audio_base64: introSpeech?.audio_base64,
				intro_audio_mime_type: introSpeech?.audio_mime_type,
			});
			this.sendMessage(socket, {
				type: "assistant.text.done",
				text: assistantTextDone,
			});
			if (startSpeech?.chars?.length && startSpeech.startTimesMs?.length) {
				this.sendMessage(socket, {
					type: "assistant.char.timings",
					chars: startSpeech.chars,
					startTimesMs: startSpeech.startTimesMs,
				});
			}
			if (startSpeech?.audio_base64) {
				this.sendMessage(socket, {
					type: "assistant.audio.start",
					mime_type: "audio/mpeg",
				});
				socket.send(Buffer.from(startSpeech.audio_base64, "base64"));
			}
			this.sendMessage(socket, {
				type: "assistant.audio.done",
			});

			if (userText.trim()) {
				lastResolvedUserText = userText.trim();
			}

			let turnConversationId = activeConversationId;

			if (userText.trim()) {
				if (!turnConversationId) {
					const conversation = await this.chatRepository.openConversation(
						messageUserSession.user.id,
						messageUserSession.sessionId,
					);
					turnConversationId = conversation.id;
					activeConversationId = conversation.id;
				}

				await this.chatRepository.appendConversationTurns(turnConversationId, [
					{
						role: "user",
						content: userText.trim(),
					},
					{
						role: "assistant",
						content: assistantTextDone,
					},
				]);
			}

			const normalizedUserText = userText.trim();
			if (normalizedUserText) {
				conversationHistory.push({
					role: "user",
					content: normalizedUserText,
				});
				conversationHistory.push({
					role: "assistant",
					content: assistantTextDone,
				});

				if (conversationHistory.length > 24) {
					conversationHistory.splice(0, conversationHistory.length - 24);
				}
			}

			if (turnConversationId) {
				this.sendMessage(socket, {
					type: "turn.done",
					conversation_id: turnConversationId,
					retrieved_memories: [],
					all_memories: [],
					recent_summaries: [],
				});
			}
		};

		const sendFixedAssistantTurn = async (
			messageUserSession: LocalSession,
			input: {
				userText: string;
				assistantText: string;
				endConversation?: boolean;
			},
		) => {
			const assistantTextDone = input.assistantText;
			const speechResult =
				await this.aiClientService.synthesizeAssistantSpeech(
					messageUserSession,
					{ text: assistantTextDone },
				).catch((error) => {
					console.warn(
						"[voice.gateway] FIXED_ASSISTANT_TTS_FAILED",
						error instanceof Error ? error.message : error,
					);
					return undefined;
				});

			this.sendMessage(socket, {
				type: "assistant.text.done",
				text: assistantTextDone,
			});
			if (speechResult?.chars?.length && speechResult.startTimesMs?.length) {
				this.sendMessage(socket, {
					type: "assistant.char.timings",
					chars: speechResult.chars,
					startTimesMs: speechResult.startTimesMs,
				});
			}
			if (speechResult?.audio_base64) {
				this.sendMessage(socket, {
					type: "assistant.audio.start",
					mime_type: "audio/mpeg",
				});
				socket.send(Buffer.from(speechResult.audio_base64, "base64"));
			}
			this.sendMessage(socket, {
				type: "assistant.audio.done",
			});

			const normalizedUserText = input.userText.trim();
			if (normalizedUserText) {
				lastResolvedUserText = normalizedUserText;
			}

			let turnConversationId = activeConversationId;

			if (normalizedUserText) {
				if (!turnConversationId) {
					const conversation = await this.chatRepository.openConversation(
						messageUserSession.user.id,
						messageUserSession.sessionId,
					);
					turnConversationId = conversation.id;
					activeConversationId = conversation.id;
				}

				await this.chatRepository.appendConversationTurns(turnConversationId, [
					{
						role: "user",
						content: normalizedUserText,
					},
					{
						role: "assistant",
						content: assistantTextDone,
					},
				]);
			}

			if (normalizedUserText) {
				conversationHistory.push({
					role: "user",
					content: normalizedUserText,
				});
				conversationHistory.push({
					role: "assistant",
					content: assistantTextDone,
				});

				if (conversationHistory.length > 24) {
					conversationHistory.splice(0, conversationHistory.length - 24);
				}
			}

			if (input.endConversation) {
				this.sendMessage(socket, {
					type: "conversation.end.requested",
				});
			}

			if (turnConversationId) {
				this.sendMessage(socket, {
					type: "turn.done",
					conversation_id: turnConversationId,
					retrieved_memories: [],
					all_memories: [],
					recent_summaries: [],
				});
			}

			if (!input.endConversation && activeSession) {
				void openStreamingSession(activeSession).catch((error) => {
					console.warn(
						"[voice.gateway] STREAM_REOPEN_AFTER_FIXED_TURN_FAILED",
						error instanceof Error ? error.message : error,
					);
				});
			}
		};

		// Register the listener before any await so messages sent right after
		// `onopen` are buffered instead of being dropped.
		socket.on("message", (raw: Buffer | ArrayBuffer | Buffer[], isBinary: boolean) => {
			if (!localUserResolved) {
				pendingMessages.push({ raw, isBinary });
				return;
			}

			if (!localSession) {
				return;
			}

			const messageUserSession = localSession;

			/**
			 * Processes one raw WebSocket frame while preserving arrival order.
			 */
			const processQueuedMessage = async () => {
				try {
					if (isBinary) {
						if (!activeSession) {
							this.sendMessage(socket, {
								type: "error",
								message: "Voice session has not been created yet",
								code: "SESSION_NOT_READY",
							});
							return;
						}
						if (!activeAudioMimeType) {
							this.sendMessage(socket, {
								type: "error",
								message: "Audio input has not been started yet",
								code: "INVALID_MESSAGE"
							});
							return;
						}
						if (!activeStreamingStreamId) {
							try {
								await openStreamingSession(activeSession);
							} catch (err) {
								console.error(
									"[voice.gateway] STREAM_OPEN_FAILED",
									err instanceof Error ? err.message : err,
								);
								this.sendMessage(socket, {
									type: "error",
									message: "Streaming ASR session could not be opened",
									code: "STREAM_NOT_READY",
								});
								return;
							}
						}
						const streamingStreamId = activeStreamingStreamId;

						if (!streamingStreamId) {
							this.sendMessage(socket, {
								type: "error",
								message: "Streaming ASR session could not be opened",
								code: "STREAM_NOT_READY"
							});
							return;
						}
						const audioChunk = Array.isArray(raw)
							? Buffer.concat(raw)
							: raw instanceof ArrayBuffer
								? Buffer.from(raw)
								: raw

						if (audioChunk.byteLength === 0) {
							this.sendMessage(socket, {
								type: "error",
								message: "Audio chunk must not be empty",
								code: "INVALID_MESSAGE",
							});
							return;
						}


						pendingAudioChunks.push(audioChunk);

						// Forward the chunk immediately and let the background drain loop
						// batch interim transcripts. Draining again here would duplicate
						// upstream work and spam the frontend with redundant transcript
						// updates while the user is still speaking.
						await this.aiClientService.sendVoiceStreamingChunk(
							messageUserSession,
							{
								stream_id: streamingStreamId,
								audio_chunk_base64: audioChunk.toString("base64"),
							},
						);
						return;
					}

					const rawText = Array.isArray(raw)
						? Buffer.concat(raw).toString("utf8")
						: raw instanceof ArrayBuffer
							? Buffer.from(raw).toString("utf8")
							: raw.toString();

					const message = this.parseClientMessage(rawText);

					if (message.type === "session.create") {
						const sessionResponse =
							await this.aiClientService.createVoiceSession(
								messageUserSession,
								{
									session: message.session,
								},
							);

						activeSession = sessionResponse.session;

						// Send session.ready immediately so the browser can start
						// recording. The STT upstream opens in parallel; if the first
						// audio chunk arrives before it's ready, the lazy-open path
						// awaits the same in-flight promise.
						this.sendMessage(socket, {
							type: "session.ready",
							session: sessionResponse.session,
							providers: sessionResponse.providers,
							audio_transport: sessionResponse.audio_transport,
						});

						void openStreamingSession(sessionResponse.session).catch((error) => {
							console.warn(
								"[voice.gateway] STREAM_OPEN_ON_SESSION_CREATE_FAILED",
								error instanceof Error ? error.message : error,
							);
						});
						return;
					}

					if (message.type === "memory.game.offer") {
						appendAssistantMemoryGameOffer(conversationHistory, message.text);

						if (activeConversationId) {
							await this.chatRepository.appendConversationTurns(
								activeConversationId,
								[
									{
										role: "assistant",
										content: message.text.trim() || MEMORY_GAME_OFFER_TEXT,
									},
								],
							);
						}

						return;
					}

					if (message.type === "memory.game.completed") {
						appendMemoryGameCompleted(
							conversationHistory,
							message.assistant_text,
						);

						let turnConversationId = activeConversationId;
						if (!turnConversationId) {
							const conversation = await this.chatRepository.openConversation(
								messageUserSession.user.id,
								messageUserSession.sessionId,
							);
							turnConversationId = conversation.id;
							activeConversationId = conversation.id;
						}

						await this.chatRepository.appendConversationTurns(
							turnConversationId,
							[
								{
									role: "assistant",
									content: message.assistant_text.trim(),
								},
							],
						);

						return;
					}

					if (message.type === "assistant.prompt") {
						const assistantPrompt = message.text.trim();
						if (!assistantPrompt) {
							return;
						}

						conversationHistory.push({
							role: "assistant",
							content: assistantPrompt,
						});
						if (conversationHistory.length > 24) {
							conversationHistory.splice(0, conversationHistory.length - 24);
						}

						if (activeConversationId) {
							await this.chatRepository.appendConversationTurns(
								activeConversationId,
								[{ role: "assistant", content: assistantPrompt }],
							);
						}

						return;
					}

					if (message.type === "text.turn") {
						if (!checkTurnRateLimit()) {
							this.sendMessage(socket, {
								type: "error",
								message: "Too many turns. Please slow down.",
								code: "RATE_LIMITED",
							});
							return;
						}

						if (!activeSession) {
							this.sendMessage(socket, {
								type: "error",
								message: "Voice session has not been created yet",
								code: "SESSION_NOT_READY",
							});
							return;
						}

						const normalizedInputText = message.text.trim();

						if (!normalizedInputText) {
							this.sendMessage(socket, {
								type: "error",
								message: "Text turn must not be empty",
								code: "INVALID_MESSAGE",
							});
							return;
						}

						applyClientConversationHistory(
							conversationHistory,
							message.conversation,
						);

						this.sendMessage(socket, {
							type: "transcript.final",
							text: normalizedInputText,
						});

						if (isVoiceEndDirectRequest(normalizedInputText)) {
							pendingVoiceEndConfirmation = false;
							await sendFixedAssistantTurn(messageUserSession, {
								userText: normalizedInputText,
								assistantText: VOICE_END_GOODBYE_REPLY,
								endConversation: true,
							});
							return;
						}

						if (pendingVoiceEndConfirmation) {
							if (isVoiceEndConfirmationClose(normalizedInputText)) {
								pendingVoiceEndConfirmation = false;
								await sendFixedAssistantTurn(messageUserSession, {
									userText: normalizedInputText,
									assistantText: VOICE_END_GOODBYE_REPLY,
									endConversation: true,
								});
								return;
							}

							pendingVoiceEndConfirmation = false;
						} else if (isVoiceEndRequest(normalizedInputText)) {
							pendingVoiceEndConfirmation = true;
							await sendFixedAssistantTurn(messageUserSession, {
								userText: normalizedInputText,
								assistantText: VOICE_END_CONFIRMATION_REPLY,
							});
							return;
						}

						const shouldStartGameText = shouldStartMemoryGame(
							normalizedInputText,
							conversationHistory,
						);
						if (shouldStartGameText) {
							await sendMemoryGameStartTurn(
								messageUserSession,
								normalizedInputText,
							);
							return;
						}

						const assistantContext =
							await this.conversationContextService.buildAssistantContext(
								messageUserSession.user.id,
								normalizedInputText,
							);

						let assistantTextDone = "";
						let assistantAudioStarted = false;
						let llmUsage: ChatVoiceLlmUsage | undefined;

						await this.aiClientService.streamAssistantResponseLive(
							messageUserSession,
							{
								session: activeSession,
								conversation: conversationHistory,
								input_text: normalizedInputText,
								assistant_context: assistantContext,
							},
							(event) => {
								if (event.type === "assistant.text.delta") {
									this.sendMessage(socket, {
										type: "assistant.text.delta",
										delta: event.text,
									});
									return;
								}

								if (event.type === "assistant.char.timings") {
									this.sendMessage(socket, {
										type: "assistant.char.timings",
										chars: event.chars,
										startTimesMs: event.startTimesMs,
									});
									return;
								}

								if (event.type === "assistant.audio.chunk") {
									if (!assistantAudioStarted) {
										assistantAudioStarted = true;
										this.sendMessage(socket, {
											type: "assistant.audio.start",
											mime_type: "audio/mpeg",
										});
									}

									socket.send(Buffer.from(event.audio_chunk_base64, "base64"));
									return;
								}

								if (event.type === "assistant.text.done") {
									assistantTextDone = event.text;
									this.sendMessage(socket, {
										type: "assistant.text.done",
										text: event.text,
									});
									return;
								}

								if (event.type === "assistant.audio.done") {
									this.sendMessage(socket, {
										type: "assistant.audio.done",
									});
									return;
								}

								if (event.type === "assistant.llm.usage") {
									llmUsage = event.usage;
								}
							},
						);

						const aiResult = {
							user_text: normalizedInputText,
							assistant_text: assistantTextDone,
							audio_base64: undefined,
						};

						if (aiResult.user_text?.trim()) {
							lastResolvedUserText = aiResult.user_text.trim();
						}

						let turnConversationId = activeConversationId;

						if (aiResult.user_text) {
							if (!turnConversationId) {
								const conversation =
									await this.chatRepository.openConversation(
										messageUserSession.user.id,
										messageUserSession.sessionId,
									);
								turnConversationId = conversation.id;
								activeConversationId = conversation.id;
							}

							await this.chatRepository.appendConversationTurns(
								turnConversationId,
								[
									{
										role: "user",
										content: aiResult.user_text,
									},
									{
										role: "assistant",
										content: aiResult.assistant_text,
									},
								],
							);
						}

						const normalizedUserText = aiResult.user_text.trim();
						const normalizedAssistantText = aiResult.assistant_text.trim();

						// Keep only complete turns so the next LLM request receives a clean bounded history.
						if (normalizedUserText && normalizedAssistantText) {
							conversationHistory.push({
								role: "user",
								content: normalizedUserText,
							});
							conversationHistory.push({
								role: "assistant",
								content: normalizedAssistantText,
							});

							if (conversationHistory.length > 24) {
								conversationHistory.splice(
									0,
									conversationHistory.length - 24,
								);
							}
						}

						if (turnConversationId) {
							this.sendMessage(socket, {
								type: "turn.done",
								conversation_id: turnConversationId,
								retrieved_memories: assistantContext.retrieved_memories,
								all_memories: assistantContext.all_memories,
								llm_usage: llmUsage,
								recent_summaries: assistantContext.recent_summaries,
							});
						}

						void openStreamingSession(activeSession).catch((error) => {
							console.warn(
								"[voice.gateway] STREAM_REOPEN_AFTER_TEXT_FAILED",
								error instanceof Error ? error.message : error,
							);
						});

						return;
					}

					if (message.type === "audio.input.start") {
						const parsedMimeType =
							chatVoiceInputAudioMimeTypeSchema.safeParse(message.mime_type);

						if (!parsedMimeType.success) {
							this.sendMessage(socket, {
								type: "error",
								message: "Unsupported microphone audio MIME type",
								code: "INVALID_MESSAGE"
							});
							return;
						}
						activeAudioMimeType = parsedMimeType.data;
						pendingAudioChunks.length = 0;
						return;
					}

					if (message.type === "audio.commit") {
						if (!checkTurnRateLimit()) {
							this.sendMessage(socket, {
								type: "error",
								message: "Too many turns. Please slow down.",
								code: "RATE_LIMITED",
							});
							return;
						}

						applyClientConversationHistory(
							conversationHistory,
							message.conversation,
						);

						if (!activeSession) {
							this.sendMessage(socket, {
								type: "error",
								message: "Voice session has not been created yet",
								code: "SESSION_NOT_READY",
							});
							return;
						}

						if (!activeStreamingStreamId) {
							this.sendMessage(socket, {
								type: "error",
								message: "Streaming ASR session has not been created yet",
								code: "STREAM_NOT_READY",
							});
							return;
						}

						if (pendingAudioChunks.length === 0) {
							this.sendMessage(socket, {
								type: "error",
								message: "Audio commit received without buffered chunks",
								code: "INVALID_MESSAGE",
							});
							return;
						}

						/**
						 * Snapshot chunks for potenial fallback; avoid the expensive Buffer.concat +
						 * base64 round-trip on the happy path (final transcript arrives first).
						 */
						const audioChunksSnapshot = pendingAudioChunks.slice();
						const audioMimeType = activeAudioMimeType;
						const streamingStreamId = activeStreamingStreamId;

						pendingAudioChunks.length = 0;
						activeAudioMimeType = undefined;
						stopTranscriptDrainLoop();
						activeStreamingStreamId = undefined;

						const audioBuffer = Buffer.concat(audioChunksSnapshot);
						const totalAudioBytes = audioBuffer.length;

						if (totalAudioBytes === 0) {
							this.sendMessage(socket, {
								type: "error",
								message: "Buffered audio turn is empty",
								code: "INVALID_MESSAGE",
							});
							return;
						}

						const batchTranscriptPromise = preTranscribeAudioWithElevenLabs({
							audioBuffer,
							mimeType: audioMimeType,
							language: activeSession.input_audio_transcription?.language,
						});

						let finalTranscript = "";
						try {
							const streamingCloseResponse =
								await this.aiClientService.closeVoiceStreaming(
									messageUserSession,
									{
										stream_id: streamingStreamId,
									},
								);
							finalTranscript = streamingCloseResponse.final_transcript.trim();
						} catch (err) {
							console.warn(
								"[voice.gateway] STREAMING_CLOSE_FAILED — falling back to batch STT",
								err instanceof Error ? err.message : err,
							);
						}

						// Run a second STT pass over the whole utterance before the LLM sees it.
						// The realtime model may emit an early plausible word and later revise it
						// in the ElevenLabs UI; this batch pass gives us a similar correction window.
						const batchTranscript = await batchTranscriptPromise;

						const resolvedTranscript = shouldPreferBatchTranscript({
							realtimeTranscript: finalTranscript,
							batchTranscript,
						})
							? batchTranscript?.trim() ?? ""
							: finalTranscript;

						if (
							batchTranscript &&
							finalTranscript &&
							batchTranscript.trim() !== finalTranscript.trim()
						) {
							console.info("[voice.gateway] ASR_SECOND_PASS", {
								realtime_chars: finalTranscript.length,
								batch_chars: batchTranscript.length,
								selected:
									resolvedTranscript === batchTranscript.trim()
										? "batch"
										: "realtime",
							});
						}

						const memoryQuery =
							resolvedTranscript || lastResolvedUserText || undefined;

						this.sendMessage(socket, {
							type: "transcript.final",
							text: resolvedTranscript,
						});

						if (!resolvedTranscript) {
							this.sendMessage(socket, {
								type: "error",
								message: "Could not transcribe audio",
								code: "TRANSCRIPTION_FAILED",
							});
							void openStreamingSession(activeSession).catch(() => {});
							return;
						}

						if (isVoiceEndDirectRequest(resolvedTranscript)) {
							pendingVoiceEndConfirmation = false;
							await sendFixedAssistantTurn(messageUserSession, {
								userText: resolvedTranscript,
								assistantText: VOICE_END_GOODBYE_REPLY,
								endConversation: true,
							});
							return;
						}

						if (pendingVoiceEndConfirmation) {
							if (isVoiceEndConfirmationClose(resolvedTranscript)) {
								pendingVoiceEndConfirmation = false;
								await sendFixedAssistantTurn(messageUserSession, {
									userText: resolvedTranscript,
									assistantText: VOICE_END_GOODBYE_REPLY,
									endConversation: true,
								});
								return;
							}

							pendingVoiceEndConfirmation = false;
						} else if (isVoiceEndRequest(resolvedTranscript)) {
							pendingVoiceEndConfirmation = true;
							await sendFixedAssistantTurn(messageUserSession, {
								userText: resolvedTranscript,
								assistantText: VOICE_END_CONFIRMATION_REPLY,
							});
							return;
						}

						const shouldStartGameAudio = shouldStartMemoryGame(
							resolvedTranscript,
							conversationHistory,
						);
						if (shouldStartGameAudio) {
							await sendMemoryGameStartTurn(
								messageUserSession,
								resolvedTranscript,
							);
							return;
						}

						const assistantContext =
							await this.conversationContextService.buildAssistantContext(
								messageUserSession.user.id,
								memoryQuery,
							);

						let assistantTextDone = "";
						let assistantAudioStarted = false;
						let llmUsage: ChatVoiceLlmUsage | undefined;

						await this.aiClientService.streamAssistantResponseLive(
							messageUserSession,
							{
								session: activeSession,
								conversation: conversationHistory,
								input_text: resolvedTranscript,
								assistant_context: assistantContext,
							},
							(event) => {
								if (event.type === "assistant.text.delta") {
									this.sendMessage(socket, {
										type: "assistant.text.delta",
										delta: event.text,
									});
									return;
								}

								if (event.type === "assistant.char.timings") {
									this.sendMessage(socket, {
										type: "assistant.char.timings",
										chars: event.chars,
										startTimesMs: event.startTimesMs,
									});
									return;
								}

								if (event.type === "assistant.audio.chunk") {
									if (!assistantAudioStarted) {
										assistantAudioStarted = true;
										this.sendMessage(socket, {
											type: "assistant.audio.start",
											mime_type: "audio/mpeg",
										});
									}

									socket.send(Buffer.from(event.audio_chunk_base64, "base64"));
									return;
								}

								if (event.type === "assistant.text.done") {
									assistantTextDone = event.text;
									this.sendMessage(socket, {
										type: "assistant.text.done",
										text: event.text,
									});
									return;
								}

								if (event.type === "assistant.audio.done") {
									this.sendMessage(socket, {
										type: "assistant.audio.done",
									});
									return;
								}

								if (event.type === "assistant.llm.usage") {
									llmUsage = event.usage;
								}
							},
						);

						const aiResult = {
							user_text: resolvedTranscript,
							assistant_text: assistantTextDone,
							audio_base64: undefined,
						};

						if (aiResult.user_text?.trim()) {
							lastResolvedUserText = aiResult.user_text.trim();
						}

						let turnConversationId = activeConversationId;

						if (aiResult.user_text) {
							if (!turnConversationId) {
								const conversation =
									await this.chatRepository.openConversation(
										messageUserSession.user.id,
										messageUserSession.sessionId,
									);
								turnConversationId = conversation.id;
								activeConversationId = conversation.id;
							}

							await this.chatRepository.appendConversationTurns(
								turnConversationId,
								[
									{
										role: "user",
										content: aiResult.user_text,
									},
									{
										role: "assistant",
										content: aiResult.assistant_text,
									},
								],
							);
						}

						const normalizedUserText = aiResult.user_text.trim();
						const normalizedAssistantText = aiResult.assistant_text.trim();

						if (normalizedUserText && normalizedAssistantText) {
							conversationHistory.push({
								role: "user",
								content: normalizedUserText,
							});
							conversationHistory.push({
								role: "assistant",
								content: normalizedAssistantText,
							});

							if (conversationHistory.length > 24) {
								conversationHistory.splice(
									0,
									conversationHistory.length - 24,
								);
							}
						}

						if (turnConversationId) {
							this.sendMessage(socket, {
								type: "turn.done",
								conversation_id: turnConversationId,
								retrieved_memories: assistantContext.retrieved_memories,
								all_memories: assistantContext.all_memories,
								llm_usage: llmUsage,
								recent_summaries: assistantContext.recent_summaries,
							});
						}

						void openStreamingSession(activeSession).catch((error) => {
							console.warn(
								"[voice.gateway] STREAM_REOPEN_AFTER_AUDIO_FAILED",
								error instanceof Error ? error.message : error,
							);
						});

						return;
					}

					if (message.type === "conversation.close") {
						const conversation =
							await this.chatRepository.findConversation(
								message.conversation_id,
							);

						if (
							!conversation ||
							conversation.seniorId !== messageUserSession.user.id
						) {
							this.sendMessage(socket, {
								type: "error",
								message: "Conversation not found",
								code: "NOT_FOUND",
							});
							return;
						}

						const transcriptMessages =
							await this.chatRepository.findConversationMessagesForSummary(
								message.conversation_id,
							);

						// Empty conversations are deleted instead of being kept as ghost
						// rows with no real dialogue content.
						if (transcriptMessages.length === 0) {
							await this.chatRepository.deleteConversation(
								message.conversation_id,
							);

							if (activeConversationId === message.conversation_id) {
								activeConversationId = undefined;
								conversationHistory.splice(
									0,
									conversationHistory.length,
								);
							}

							this.sendMessage(socket, {
								type: "conversation.closed",
								conversation_id: message.conversation_id,
							});
							return;
						}

						let summaryData: {
							summary: string;
							keyPoints: string[];
							mainTopics: string[];
							emotionalTone: string;
							facts: string[];
						} = {
							summary: "",
							keyPoints: [],
							mainTopics: [],
							emotionalTone: "neutral",
							facts: [],
						};

						const messages = transcriptMessages;

						try {
							const existingFacts = await this.chatRepository.getAllMemories(
								messageUserSession.user.id,
							);
							summaryData =
								await this.aiClientService.summarizeConversation(
									messageUserSession,
									messages,
									existingFacts,
								);
							console.info(
								"[voice.gateway] facts extracted by LLM:",
								JSON.stringify(summaryData.facts),
							);
						} catch (error) {
							// Summarization is best-effort: the conversation must still close.
							console.warn(
								"[voice.gateway] SUMMARIZE_FAILED",
								error instanceof Error ? error.message : error,
							);
						}

						await this.chatRepository.closeConversation(
							message.conversation_id,
							{
								...summaryData,
								userOutcome: message.user_outcome,
								userNote: message.user_note,
							},
						);

						// Save extracted facts as atomic memories — best-effort, non-blocking.
						if (summaryData.facts?.length) {
							console.info(
								`[voice.gateway] saving ${summaryData.facts.length} facts to senior_insights`,
							);
							try {
								await this.chatRepository.saveExtractedFacts(
									messageUserSession.user.id,
									summaryData.facts,
									message.conversation_id,
								);
							} catch (error) {
								console.warn(
									"[voice.gateway] SAVE_FACTS_FAILED",
									error instanceof Error ? error.message : error,
								);
							}
						} else {
							console.info(
								"[voice.gateway] no new facts to save (facts array is empty)",
							);
						}

						this.conversationContextService.invalidateContext(messageUserSession.user.id);

						if (activeConversationId === message.conversation_id) {
							activeConversationId = undefined;
							conversationHistory.splice(0, conversationHistory.length);
						}

						this.sendMessage(socket, {
							type: "conversation.closed",
							conversation_id: message.conversation_id,
						});
						return;
					}

					if (message.type === "response.cancel") {
						// Current turn execution is still blocking, so cancel is advisory
						// until finer-grained Anthropic/TTS interruption is implemented.
						return;
					}

					if (message.type === "keepalive") {
						// markActivity() already called above for every message.
						return;
					}

					this.sendMessage(socket, {
						type: "error",
						message: "Unsupported message type",
						code: "UNSUPPORTED_MESSAGE",
					});
				} catch (error) {
					const isClientError = error instanceof SyntaxError || error instanceof ZodError;
					this.sendMessage(socket, {
						type: "error",
						message: isClientError
							? (error instanceof Error ? error.message : "Invalid message format")
							: "An error occurred while processing your message",
						code: isClientError ? "INVALID_MESSAGE" : "MESSAGE_PROCESSING_FAILED",
					});
					if (!isClientError) {
						console.error(
							"[voice.gateway] unexpected error processing message",
							error,
						);
					}
				}
			};

			// Process frames in strict arrival order so `audio.commit` can never
			// overtake earlier binary audio chunks forwarded to the AI service.
			messageProcessingQueue = messageProcessingQueue
				.then(processQueuedMessage)
				.catch((error) => {
					console.error(
						"[voice.gateway] MESSAGE_QUEUE_FAILED",
						error instanceof Error ? error.message : error,
					);
				});
		});

		// Load the local user after registering the listener so no messages are lost.
		try {
			localSession = await this.localUserService.getSession(visitKey);
		} catch (error) {
			console.error(
				"[voice.gateway] LOCAL_USER_LOAD_FAILED",
				error instanceof Error ? error.message : error,
			);
		}
		localUserResolved = true;

		if (!localSession) {
			this.sendMessage(socket, {
				type: "error",
				message: "Local user is unavailable",
				code: "INTERNAL_ERROR",
			});
			socket.close(1011, "Local user is unavailable");
			return;
		}

		const userSession = localSession;

		// Tracks an in-flight open so concurrent callers (proactive open after
		// session.ready + lazy open on first audio chunk) share the same upstream.
		let openStreamingSessionInFlight: Promise<void> | null = null;

		openStreamingSession = (session: ChatVoiceSessionConfig) => {
			if (activeStreamingStreamId) return Promise.resolve();
			if (openStreamingSessionInFlight) return openStreamingSessionInFlight;

			openStreamingSessionInFlight = (async () => {
				try {
					stopTranscriptDrainLoop();

					const streamingStartResponse =
						await this.aiClientService.startVoiceStreaming(userSession, {
							session,
							audio_language: session.input_audio_transcription?.language,
							previous_text: buildAsrPreviousText(conversationHistory),
							keyterms: buildAsrKeyterms(
								session,
								userSession,
								conversationHistory,
							),
						});

					activeStreamingStreamId = streamingStartResponse.stream_id;
					startTranscriptDrainLoop();
				} finally {
					openStreamingSessionInFlight = null;
				}
			})();

			return openStreamingSessionInFlight;
		};

		// Replay any messages that arrived while the local user was loading.
		for (const buffered of pendingMessages) {
			socket.emit("message", buffered.raw, buffered.isBinary);
		}

		socket.on("close", () => {
			stopTranscriptDrainLoop();
		});
	}

	/**
	 * Sends one typed JSON message through the WebSocket connection.
	 */
	private sendMessage(socket: WebSocket, message: ChatVoiceWsServerMessage) {
		socket.send(JSON.stringify(message));
	}

	/**
	 * Parses raw WebSocket frames into the typed client message union.
	 */
	private parseClientMessage(raw: string): ChatVoiceWsClientMessage {
		return chatVoiceWsClientMessageSchema.parse(JSON.parse(raw));
	}
}
