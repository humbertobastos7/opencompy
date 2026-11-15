import {
	BadRequestException,
	Injectable,
	InternalServerErrorException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { resolveVoiceSessionConfig } from "@/ai/chat/chat.session-config";
import { generateAssistantReplyWithAnthropic } from "@/ai/integrations/anthropic";
import { transcribeAudioWithElevenLabs } from "@/ai/integrations/elevenlabs.stt";
import {
	type AnthropicStreamingTextEvent,
	streamAssistantReplyWithAnthropic,
} from "@/ai/integrations/anthropic.streaming";
import {
	type ElevenLabsSttStreamingSession,
	type ElevenLabsSttStreamingTranscriptEvent,
	openElevenLabsSttStreamingSession,
} from "@/ai/integrations/elevenlabs.stt.streaming";
import {
	synthesizeSpeech,
	streamSpeech,
	activeTtsProvider,
} from "@/ai/integrations/tts.provider";
import {
	openElevenLabsTtsStreamingSession,
	type ElevenLabsTtsStreamingSession,
} from "@/ai/integrations/elevenlabs.tts.streaming";
import { fetchSpeechWithTimestamps } from "@/ai/integrations/elevenlabs.streaming";
import {
	type AiChatVoiceTurnPayload,
	type AssistantContext,
	type LocalSession,
	type ChatConversationMessage,
	type ChatVoiceLlmUsage,
	type ChatVoiceTtsRequest,
	type ChatVoiceSessionRequest,
	type ChatVoiceTurnRequest,
} from "@/shared/contracts";
import {
	chatVoiceInputAudioMimeTypes,
	aiChatVoiceSummarizeResponseSchema,
	chatVoiceSessionResponseSchema,
	chatVoiceTtsResponseSchema,
	chatVoiceTurnResponseSchema,
} from "@/shared/contracts";
import { env } from "@/env/ai";

const EMPTY_TRANSCRIPT_RETRY_REPLY =
	"Nao te consegui ouvir bem. Podes repetir um bocadinho mais devagar?";
const WEB_SEARCH_INTRO_REPLY = "Deixa-me pesquisar isso para ti.";
const MAX_HISTORY_MESSAGES = 20;
type SystemPromptBlocks = string | string[];

type StreamingTranscriptEvent = ElevenLabsSttStreamingTranscriptEvent;
type StreamingSession = ElevenLabsSttStreamingSession;

type ActiveStreamingSession = {
	session: StreamingSession;
	pendingEvents: StreamingTranscriptEvent[];
	language?: string;
	keyterms?: string[];
	onTranscript: (event: StreamingTranscriptEvent) => void;
};

type StreamingVoiceTurnHandle = {
	stream_id: string;
};

type StreamingVoiceChunkPayload = {
	stream_id: string;
	audio_chunk_base64: string;
};

type StreamingVoiceCloseResult = {
	final_transcript: string;
};

type AssistantStreamingLatencyMetrics = {
	startedAtMs: number;
	firstTextDeltaAtMs: number | null;
	firstSentenceAtMs: number | null;
	firstAudioChunkAtMs: number | null;
	firstAudioChunkSource: "streaming" | "fallback" | null;
	sentenceCount: number;
	audioChunkCount: number;
};

type AssistantResponseStreamingEvent =
	| {
			type: "assistant.text.delta";
			text: string;
	  }
	| {
			type: "assistant.text.sentence";
			text: string;
	  }
	| {
			type: "assistant.audio.chunk";
			audio_chunk_base64: string;
	  }
	| {
			type: "assistant.text.done";
			text: string;
	  }
	| {
			type: "assistant.audio.done";
	  }
	| {
			type: "assistant.llm.usage";
			usage: ChatVoiceLlmUsage;
	  }
	| {
			type: "assistant.char.timings";
			chars: string[];
			startTimesMs: number[];
	  };

type StreamAssistantResponsePayload = {
	session: ChatVoiceSessionRequest["session"];
	conversation: ChatConversationMessage[];
	assistant_context?: AssistantContext;
	inputText: string;
	forcedAssistantText?: string;
	onEvent: (event: AssistantResponseStreamingEvent) => void;
};

type AssistantTextEvent = AnthropicStreamingTextEvent;

type ResolvedUserTurn =
	| {
			kind: "text";
			text: string;
	  }
	| {
			kind: "empty_transcript";
	  };

type StreamingVoiceTurnPayload = {
	session: ChatVoiceSessionRequest["session"];
	audio_language?: string;
	previous_text?: string;
	keyterms?: string[];
	onTranscript: (event: StreamingTranscriptEvent) => void;
};

@Injectable()
export class ChatService {
	/**
	 * Keeps live ASR streaming sessions in memory so subsequent chunk and
	 * close requests can address one existing upstream socket.
	 */
	private readonly activeStreamingSessions = new Map<
		string,
		ActiveStreamingSession
	>();

	/**
	 * Validates provider configuration, normalizes the reusable session settings, and returns the frontend payload.
	 */
	async createVoiceSession(
		localSession: LocalSession,
		payload: ChatVoiceSessionRequest,
	) {
		try {
			void localSession;
			this.assertVoiceProvidersConfigured();

			const { session, notes } = resolveVoiceSessionConfig(payload.session);

			return chatVoiceSessionResponseSchema.parse({
				session,
				providers: this.buildProviderSummary(),
				audio_transport: "binary",
				notes,
			});
		} catch (error) {
			if (error instanceof BadRequestException) {
				throw error;
			}

			throw new InternalServerErrorException(
				error instanceof Error
					? `FAILED_TO_CREATE_VOICE_SESSION: ${error.message}`
					: "FAILED_TO_CREATE_VOICE_SESSION",
			);
		}
	}

	/**
	 * Synthesizes one short fixed phrase with the configured Compy voice, without
	 * invoking the LLM.
	 */
	async synthesizeAssistantSpeech(
		localSession: LocalSession,
		payload: ChatVoiceTtsRequest,
	) {
		try {
			void localSession;
			this.assertVoiceProvidersConfigured();

			const text = payload.text.trim();
			if (activeTtsProvider() === "elevenlabs") {
				try {
					const { audioBuffer, chars, startTimesMs } =
						await fetchSpeechWithTimestamps({ text });

					return chatVoiceTtsResponseSchema.parse({
						audio_base64: audioBuffer.toString("base64"),
						audio_mime_type: "audio/mpeg",
						chars,
						startTimesMs,
					});
				} catch (error) {
					console.warn(
						"[chat.tts.short] TIMESTAMP_TTS_FAILED",
						error instanceof Error ? error.message : error,
					);
				}
			}

			const audioPayload = await this.trySynthesizeAssistantAudio(text);

			return chatVoiceTtsResponseSchema.parse({
				audio_base64: audioPayload?.audio_base64,
				audio_mime_type: audioPayload?.audio_mime_type,
			});
		} catch (error) {
			if (error instanceof BadRequestException) {
				throw error;
			}
			throw new InternalServerErrorException(
				error instanceof Error
					? `FAILED_TO_SYNTHESIZE_ASSISTANT_SPEECH: ${error.message}`
					: "FAILED_TO_SYNTHESIZE_ASSISTANT_SPEECH",
			);
		}
	}

	/**
	 * Processes one text or audio turn through transcription, Anthropic Claude, and ElevenLabs.
	 */
	async processVoiceTurn(
		localSession: LocalSession,
		payload: AiChatVoiceTurnPayload,
	) {
		try {
			void localSession;
			this.assertVoiceProvidersConfigured();

			const { session } = resolveVoiceSessionConfig(payload.session);
			const systemRoles = this.buildCachedSystemPrompt(
				payload.assistant_context,
			);
			const turnNumber = Math.floor(payload.conversation.length / 2) + 1;
			const assistantHasAlreadySpoken = payload.conversation.some(
				(message) => message.role === "assistant",
			);
			const contextBlock = this.buildVolatileContextBlock(
				payload.assistant_context,
				turnNumber,
				assistantHasAlreadySpoken,
			);

			const resolvedUserTurn = await this.resolveUserText(
				payload,
				session.input_audio_transcription?.language,
			);
			if (resolvedUserTurn.kind === "empty_transcript") {
				this.logVoiceTurn("received", {
					role: "user",
					text: "",
					note: "empty transcript",
				});
				this.logVoiceTurn("sent", {
					role: "assistant",
					text: EMPTY_TRANSCRIPT_RETRY_REPLY,
				});

				return await this.buildRetryTurnResponse({
					fallbackText: EMPTY_TRANSCRIPT_RETRY_REPLY,
				});
			}

			const userText = resolvedUserTurn.text;
			this.logVoiceTurn("received", {
				role: "user",
				text: userText,
				conversationSize: payload.conversation.length,
			});
			const conversation = this.buildConversationHistory(
				payload.conversation,
				userText,
				contextBlock,
			);
			let llmUsage: ChatVoiceLlmUsage | undefined;
			const webSearch = this.webSearchEnabledForConversation(userText);
			const assistantText = await this.generateAssistantReply({
				model: this.defaultConversationModel(),
				systemPrompt: systemRoles,
				conversation,
				maxTokens:
					typeof session.max_response_output_tokens === "number"
						? session.max_response_output_tokens
						: undefined,
				webSearch,
				onUsage: (usage) => {
					llmUsage = usage;
				},
			});
			const audioPayload =
				await this.trySynthesizeAssistantAudio(assistantText);
			this.logVoiceTurn("sent", {
				role: "assistant",
				text: assistantText,
				conversationSize: conversation.length,
			});

			return chatVoiceTurnResponseSchema.parse({
				user_text: userText,
				assistant_text: assistantText,
				audio_base64: audioPayload?.audio_base64,
				audio_mime_type: audioPayload?.audio_mime_type,
				providers: this.buildProviderSummary(),
				llm_usage: llmUsage,
			});
		} catch (error) {
			if (error instanceof BadRequestException) {
				throw error;
			}
			throw new InternalServerErrorException(
				error instanceof Error
					? `FAILED_TO_PROCESS_VOICE_TURN: ${error.message}`
					: "FAILED_TO_PROCESS_VOICE_TURN",
			);
		}
	}

	/**
	 * Streams one assistant reply with Anthropic text deltas and sentence-level
	 * ElevenLabs audio while recording latency checkpoints for debugging.
	 */
	async streamAssistantResponse(
		localSession: LocalSession,
		payload: StreamAssistantResponsePayload,
	) {
		try {
			void localSession;
			this.assertVoiceProvidersConfigured();

			const { session } = resolveVoiceSessionConfig(payload.session);
			const systemRoles = this.buildCachedSystemPrompt(
				payload.assistant_context,
			);
			const turnNumber = Math.floor(payload.conversation.length / 2) + 1;
			const assistantHasAlreadySpoken = payload.conversation.some(
				(message) => message.role === "assistant",
			);
			const contextBlock = this.buildVolatileContextBlock(
				payload.assistant_context,
				turnNumber,
				assistantHasAlreadySpoken,
			);

			const conversation = this.buildConversationHistory(
				payload.conversation,
				payload.inputText,
				contextBlock,
			);
			const webSearch = this.webSearchEnabledForConversation(payload.inputText);
			const llmModel = this.defaultConversationModel();
			const metrics = this.createAssistantStreamingLatencyMetrics();
			this.logVoiceTurn("received", {
				role: "user",
				text: payload.inputText,
				conversationSize: payload.conversation.length,
			});

			let finalAssistantText = "";
			let finalAssistantSpeechText = "";
			let emittedAudio = false;
			let emittedWebSearchIntroAudio = false;
			let usedFallbackAudio = false;

			const provider = activeTtsProvider();

			// Open the ElevenLabs streaming TTS WebSocket only when that provider
			// is active. The session streams audio + alignment back incrementally
			// as we feed sentences; Gemini has no equivalent, so it falls back
			// to a single streamSpeech() call after the LLM finishes.
			let ttsSession: ElevenLabsTtsStreamingSession | null = null;
			if (provider === "elevenlabs" && env.ELEVENLABS_USE_STREAMING) {
				try {
					const language = session.input_audio_transcription?.language;
					ttsSession = await openElevenLabsTtsStreamingSession({
						languageCode: language?.split("-")[0],
					});
				} catch (err) {
					console.warn(
						"[chat.service] TTS_WEBSOCKET_OPEN_FAILED",
						err instanceof Error ? err.message : err,
					);
				}
			}

			// Alignment data arrives in chunks alongside audio; accumulate and
			// emit one assistant.char.timings event after the WS session closes.
			const accumulatedChars: string[] = [];
			const accumulatedStartTimesMs: number[] = [];

			const audioConsumer = ttsSession
				? (async () => {
						const reader = ttsSession!.audio.getReader();
						try {
							while (true) {
								const { done, value } = await reader.read();
								if (done) break;
								if (!value || value.length === 0) continue;
								emittedAudio = true;
								metrics.audioChunkCount += 1;
								this.noteFirstAssistantAudioChunk(metrics, {
									source: "streaming",
									chunkBytes: value.length,
								});
								payload.onEvent({
									type: "assistant.audio.chunk",
									audio_chunk_base64: Buffer.from(value).toString("base64"),
								});
							}
						} catch (err) {
							console.warn(
								"[chat.service] TTS_WEBSOCKET_STREAM_FAILED",
								err instanceof Error ? err.message : err,
							);
						}
					})()
				: Promise.resolve();

			const alignmentConsumer = ttsSession
				? (async () => {
						const reader = ttsSession!.alignment.getReader();
						try {
							while (true) {
								const { done, value } = await reader.read();
								if (done) break;
								if (!value) continue;
								accumulatedChars.push(...value.chars);
								accumulatedStartTimesMs.push(...value.charStartTimesMs);
							}
						} catch {
							// Alignment is best-effort; ignore stream errors.
						}
					})()
				: Promise.resolve();

			// Gemini per-sentence parallel TTS: each sentence kicks off a Gemini
			// streamSpeech call the moment the LLM emits it, so synthesis runs
			// concurrently with the rest of the LLM generation. Results are
			// emitted in sentence order through a drain chain so the frontend
			// plays them sequentially.
			let geminiDrainChain: Promise<void> = Promise.resolve();
			const enqueueGeminiSentence = (text: string) => {
				const audioPromise = (async () => {
					try {
						const stream = await streamSpeech({ text });
						const reader = stream.getReader();
						const chunks: Uint8Array[] = [];
						while (true) {
							const { done, value } = await reader.read();
							if (done) break;
							if (value?.length) chunks.push(value);
						}
						if (!chunks.length) return null;
						const totalLen = chunks.reduce((n, c) => n + c.byteLength, 0);
						const combined = new Uint8Array(totalLen);
						let off = 0;
						for (const chunk of chunks) {
							combined.set(chunk, off);
							off += chunk.byteLength;
						}
						return combined;
					} catch (error) {
						console.warn(
							"[chat.service] GEMINI_TTS_SENTENCE_FAILED",
							error instanceof Error ? error.message : error,
						);
						return null;
					}
				})();

				geminiDrainChain = geminiDrainChain.then(async () => {
					const wavBuffer = await audioPromise;
					if (!wavBuffer) return;
					emittedAudio = true;
					metrics.audioChunkCount += 1;
					this.noteFirstAssistantAudioChunk(metrics, {
						source: "streaming",
						chunkBytes: wavBuffer.byteLength,
					});
					payload.onEvent({
						type: "assistant.audio.chunk",
						audio_chunk_base64: Buffer.from(wavBuffer).toString("base64"),
					});
				});
			};

			const emitAssistantSentence = (
				text: string,
				options: { synthesize?: boolean } = {},
			) => {
				const synthesize = options.synthesize ?? true;
				metrics.sentenceCount += 1;
				this.noteFirstAssistantSentence(metrics, {
					sentenceCount: metrics.sentenceCount,
					sentenceLength: text.length,
				});

				payload.onEvent({
					type: "assistant.text.sentence",
					text,
				});

				if (!synthesize) return;

				// Feed text to the WS TTS session with trailing space to hint a boundary.
				if (ttsSession) {
					ttsSession.sendText(`${text} `);
				} else if (provider === "gemini") {
					// Kick off a Gemini TTS call for this sentence in parallel.
					enqueueGeminiSentence(text);
				}
			};

			const assistantSpokenPrefix = webSearch ? WEB_SEARCH_INTRO_REPLY : "";
			if (assistantSpokenPrefix) {
				payload.onEvent({
					type: "assistant.text.delta",
					text: `${assistantSpokenPrefix} `,
				});
				emitAssistantSentence(assistantSpokenPrefix, {
					synthesize: provider !== "elevenlabs",
				});
				if (provider === "elevenlabs") {
					try {
						const introSpeech = await fetchSpeechWithTimestamps({
							text: assistantSpokenPrefix,
						});
						if (introSpeech.audioBuffer.byteLength > 0) {
							emittedAudio = true;
							emittedWebSearchIntroAudio = true;
							metrics.audioChunkCount += 1;
							this.noteFirstAssistantAudioChunk(metrics, {
								source: "streaming",
								chunkBytes: introSpeech.audioBuffer.byteLength,
							});
							payload.onEvent({
								type: "assistant.audio.chunk",
								audio_chunk_base64: introSpeech.audioBuffer.toString("base64"),
							});
						}
						if (
							introSpeech.chars.length > 0 &&
							introSpeech.startTimesMs.length > 0
						) {
							payload.onEvent({
								type: "assistant.char.timings",
								chars: introSpeech.chars,
								startTimesMs: introSpeech.startTimesMs,
							});
						}
					} catch (error) {
						console.warn(
							"[chat.service] WEB_SEARCH_INTRO_TTS_FAILED",
							error instanceof Error ? error.message : error,
						);
					}
				}
			}

			await this.streamAssistantReply({
				model: llmModel,
				systemPrompt: systemRoles,
				conversation,
				maxTokens:
					typeof session.max_response_output_tokens === "number"
						? session.max_response_output_tokens
						: undefined,
				webSearch,
				onUsage: (usage) => {
					payload.onEvent({
						type: "assistant.llm.usage",
						usage,
					});
				},
				onEvent: (event: AssistantTextEvent) => {
					if (event.type === "text.delta") {
						this.noteFirstAssistantTextDelta(metrics, {
							model: llmModel,
						});

						payload.onEvent({
							type: "assistant.text.delta",
							text: event.text,
						});
						return;
					}

					if (event.type === "text.sentence") {
						emitAssistantSentence(event.text);
						return;
					}

					if (event.type !== "text.done") return;

					finalAssistantSpeechText = event.text;
					finalAssistantText = emittedWebSearchIntroAudio
						? event.text
						: assistantSpokenPrefix
						? `${assistantSpokenPrefix} ${event.text}`.trim()
						: event.text;

					payload.onEvent({
						type: "assistant.text.done",
						text: finalAssistantText,
					});
				},
			});

			// Drain the WS TTS session: signal end-of-input, then wait for both
			// audio and alignment streams to flush. Emit char.timings once.
			if (ttsSession) {
				ttsSession.finish();
				await Promise.all([audioConsumer, alignmentConsumer]);

				if (accumulatedChars.length > 0) {
					payload.onEvent({
						type: "assistant.char.timings",
						chars: accumulatedChars,
						startTimesMs: accumulatedStartTimesMs,
					});
				}
			}

			// Gemini path: drain the per-sentence TTS chain. Each sentence's
			// Gemini call started as soon as the LLM emitted it; this awaits
			// the tail of the chain so every queued audio chunk has reached
			// the client in order before we move on.
			if (provider === "gemini") {
				await geminiDrainChain;
			}

			// Batch fallback. When the active provider is ElevenLabs we hit the
			// stream/with-timestamps endpoint so the frontend can render the
			// subtitle reveal (emit assistant.char.timings alongside the audio).
			// Any other provider or failure falls back to plain synthesizeSpeech.
			if (
				(!emittedAudio || emittedWebSearchIntroAudio) &&
				finalAssistantText &&
				provider === "elevenlabs"
			) {
				try {
					const textForAudio = emittedWebSearchIntroAudio
						? finalAssistantSpeechText
						: finalAssistantText;
					const timed = await fetchSpeechWithTimestamps({
						text: textForAudio,
					});

					if (timed.audioBuffer.byteLength > 0) {
						emittedAudio = true;
						emittedWebSearchIntroAudio = false;
						usedFallbackAudio = true;
						metrics.audioChunkCount += 1;
						this.noteFirstAssistantAudioChunk(metrics, {
							source: "fallback",
							chunkBytes: timed.audioBuffer.byteLength,
						});

						payload.onEvent({
							type: "assistant.audio.chunk",
							audio_chunk_base64: timed.audioBuffer.toString("base64"),
						});

						if (timed.chars.length > 0) {
							payload.onEvent({
								type: "assistant.char.timings",
								chars: timed.chars,
								startTimesMs: timed.startTimesMs,
							});
						}
					}
				} catch (withTimestampsError) {
					console.warn(
						"[chat.service] FALLBACK_WITH_TIMESTAMPS_FAILED",
						withTimestampsError instanceof Error
							? withTimestampsError.message
							: withTimestampsError,
					);
				}
			}

			// Last-resort fallback: plain batch TTS (no timings). Covers Gemini and
			// the rare case where /stream/with-timestamps itself failed.
			if (
				(!emittedAudio || emittedWebSearchIntroAudio) &&
				finalAssistantText
			) {
				try {
					const textForAudio = emittedWebSearchIntroAudio
						? finalAssistantSpeechText
						: finalAssistantText;
					const audioPayload =
						await this.trySynthesizeAssistantAudio(textForAudio);

					if (audioPayload?.audio_base64) {
						emittedAudio = true;
						emittedWebSearchIntroAudio = false;
						usedFallbackAudio = true;
						metrics.audioChunkCount += 1;
						this.noteFirstAssistantAudioChunk(metrics, {
							source: "fallback",
							chunkBytes: Buffer.byteLength(
								audioPayload.audio_base64,
								"base64",
							),
						});

						payload.onEvent({
							type: "assistant.audio.chunk",
							audio_chunk_base64: audioPayload.audio_base64,
						});
					}
				} catch (fallbackError) {
					console.warn(
						"[chat.service] FINAL_TTS_FALLBACK_FAILED",
						fallbackError instanceof Error
							? fallbackError.message
							: fallbackError,
					);
				}
			}

			payload.onEvent({
				type: "assistant.audio.done",
			});
			this.logVoiceTurn("sent", {
				role: "assistant",
				text: finalAssistantText,
				conversationSize: conversation.length,
			});
			this.logAssistantStreamingLatencySummary({
				metrics,
				llmModel,
				inputText: payload.inputText,
				assistantText: finalAssistantText,
				hadAudio: emittedAudio,
				usedFallbackAudio,
			});

			return {
				assistant_text: finalAssistantText,
				providers: this.buildProviderSummary(),
			};
		} catch (error) {
			if (error instanceof BadRequestException) {
				throw error;
			}

			throw new InternalServerErrorException(
				error instanceof Error
					? `FAILED_TO_STREAM_ASSISTANT_RESPONSE: ${error.message}`
					: `FAILED_TO_STREAM_ASSISTANT_RESPONSE`,
			);
		}
	}

	/**
	 * Opens one live ElevenLabs STT session and forwards interim/final transcripts to the caller.
	 */
	async processVoiceTurnStreaming(
		localSession: LocalSession,
		payload: StreamingVoiceTurnPayload,
	): Promise<StreamingVoiceTurnHandle> {
		try {
			void localSession;
			this.assertVoiceProvidersConfigured();

			const { session } = resolveVoiceSessionConfig(payload.session);

			const pendingEvents: StreamingTranscriptEvent[] = [];
			const language =
				payload.audio_language ?? session.input_audio_transcription?.language;
			const keyterms =
				payload.keyterms ?? session.input_audio_transcription?.keyterms;

			const streamingSession: StreamingSession =
				await openElevenLabsSttStreamingSession({
					language,
					previousText: payload.previous_text,
					keyterms,
					onTranscript: (event) => {
						pendingEvents.push(event);
						payload.onTranscript(event);
					},
				});

			const streamId = randomUUID();

			this.activeStreamingSessions.set(streamId, {
				session: streamingSession,
				pendingEvents,
				language:
					payload.audio_language ?? session.input_audio_transcription?.language,
				keyterms,
				onTranscript: payload.onTranscript,
			});

			return {
				stream_id: streamId,
			};
		} catch (error) {
			if (error instanceof BadRequestException) {
				throw error;
			}

			throw new InternalServerErrorException(
				error instanceof Error
					? `FAILED_TO_PROCESS_STREAMING_VOICE_TURN: ${error.message}`
					: "FAILED_TO_PROCESS_STREAMING_VOICE_TURN",
			);
		}
	}

	/**
	 * Forwards one base64-encoded browser audio chunk to an existing
	 * live ASR session that was previously opened during streaming bootstrap.
	 */
	async sendVoiceStreamingChunk(payload: StreamingVoiceChunkPayload) {
		const activeSession = this.activeStreamingSessions.get(payload.stream_id);

		if (!activeSession) {
			throw new BadRequestException("Streaming session not found");
		}

		const encodedChunk = payload.audio_chunk_base64.trim();
		if (!encodedChunk) {
			throw new BadRequestException("Streaming audio chunk is empty");
		}

		const audioChunk = Buffer.from(encodedChunk, "base64");
		if (audioChunk.length === 0) {
			throw new BadRequestException("Streaming audio chunk payload is empty");
		}

		try {
			activeSession.session.sendAudioChunk(audioChunk);
		} catch (err) {
			// ElevenLabs may close idle WebSockets. Reopen the session
			// transparently and retry so the user does not notice the gap.
			if (
				err instanceof Error &&
				err.message === "ELEVENLABS_STT_SOCKET_NOT_OPEN"
			) {
				console.warn(
					"[chat.service] ASR_RECONNECT stream_id=%s",
					payload.stream_id,
				);

				const onTranscript = (event: StreamingTranscriptEvent) => {
					activeSession.pendingEvents.push(event);
					activeSession.onTranscript(event);
				};

				const newSession: StreamingSession =
					await openElevenLabsSttStreamingSession({
						language: activeSession.language,
						keyterms: activeSession.keyterms,
						onTranscript,
					});

				activeSession.session = newSession;
				activeSession.session.sendAudioChunk(audioChunk);
			} else {
				throw err;
			}
		}

		return {
			success: true as const,
		};
	}

	/**
	 * Drains all pending transcript events accumulated so far for one active
	 * live ASR stream and clears the in-memory queue afterwards.
	 */
	drainVoiceStreamingEvents(streamId: string) {
		const activeSession = this.activeStreamingSessions.get(streamId);

		if (!activeSession) {
			throw new BadRequestException("Streaming session not found");
		}

		return {
			events: activeSession.pendingEvents.splice(
				0,
				activeSession.pendingEvents.length,
			),
		};
	}

	/**
	 * Closes one existing ASR live session, removes it from memory, and
	 * returns the final transcript accumulated by the upstream stream after it flushes.
	 */
	async closeVoiceStreaming(
		streamId: string,
	): Promise<StreamingVoiceCloseResult> {
		const activeSession = this.activeStreamingSessions.get(streamId);

		if (!activeSession) {
			throw new BadRequestException("Streaming session not found");
		}

		const finalTranscript = await activeSession.session.close();
		this.activeStreamingSessions.delete(streamId);

		return {
			final_transcript: finalTranscript,
		};
	}

	/**
	 * Generates a structured summary of a closed conversation using Anthropic.
	 */
	async summarizeConversation(
		messages: Array<{ role: "user" | "assistant"; content: string }>,
		existingFacts?: string[],
		conversationDate?: string,
	) {
		try {
			const conversationText = messages
				.map(
					(m) =>
						`${m.role === "user" ? "Utilizador" : "Assistente"}: ${m.content}`,
				)
				.join("\n");

			const existingFactsBlock =
				existingFacts && existingFacts.length > 0
					? '\n\nFACTOS JÁ CONHECIDOS SOBRE ESTE SÉNIOR (NÃO os repitas no array "facts" — ignora qualquer facto desta conversa que seja igual ou muito semelhante a um destes):\n' +
						existingFacts.map((f) => `- ${f}`).join("\n")
					: "";

			const systemPrompt =
				"És um assistente de análise de conversas entre um companheiro virtual (Compy) e uma pessoa idosa. " +
				"Devolve APENAS um objeto JSON válido (sem markdown, sem texto extra) com os seguintes campos:\n\n" +
				'"summary" (string: resumo da conversa em 2 a 4 frases em português, focado no que aconteceu e como o sénior estava),\n' +
				'"keyPoints" (array de strings: os momentos ou tópicos mais relevantes DESTA conversa, ex: "Falou sobre a visita da filha", "Queixou-se de dores nas costas"),\n' +
				'"mainTopics" (array de strings: tópicos abordados, ex: "família", "saúde", "infância"),\n' +
				'"emotionalTone" (string: um dos seguintes valores EXATOS: "positivo", "neutro", "melancólico"),\n' +
				'"facts" (array de 0 a 10 strings: factos ABSOLUTAMENTE NOVOS sobre o sénior, que NÃO constem na lista de factos já conhecidos abaixo. ' +
				"Cada facto deve ser concreto, persistente e útil em conversas futuras — uma frase curta e autónoma em português. " +
				'Exemplos válidos: "Tem um gato chamado Tareco", "Trabalhou como carpinteiro em Viseu". ' +
				'NÃO incluas: estados temporários (ex: "está cansado hoje"), factos vagos, nem qualquer facto já listado nos factos conhecidos. ' +
				"Se a conversa não revelar factos genuinamente novos, devolve array vazio [])." +
				existingFactsBlock;

			const responseText = await generateAssistantReplyWithAnthropic({
				model: env.ANTHROPIC_SUMMARY_MODEL,
				systemPrompt,
				conversation: [
					{
						role: "user",
						content: `Analisa esta conversa e devolve o JSON pedido.\n\nConversa:\n${conversationText}`,
					},
				],
				maxTokens: 800,
				webSearch: false,
			});

			// Strip optional markdown code fences Claude may wrap around JSON output.
			const cleaned = responseText
				.replace(/^```(?:json)?\s*/i, "")
				.replace(/\s*```\s*$/i, "")
				.trim();
			const parsed: unknown = JSON.parse(cleaned);
			console.info(
				"[summarize] raw LLM response facts:",
				JSON.stringify((parsed as Record<string, unknown>)?.facts ?? null),
			);
			return aiChatVoiceSummarizeResponseSchema.parse(parsed);
		} catch (error) {
			throw new InternalServerErrorException(
				error instanceof Error
					? `FAILED_TO_SUMMARIZE_CONVERSATION: ${error.message}`
					: "FAILED_TO_SUMMARIZE_CONVERSATION",
			);
		}
	}

	// ─── System Prompt — 7 Secções ────────────────────────────────────────────

	/**
	 * §1 + §2 + §2b — Identidade, Personalidade, Regras e Limites, Expressão Vocal.
	 * Texto estático em pt-PT. Vai para o campo `system` da API Anthropic.
	 */
	private buildSystemRoles(familia?: string): string {
		const contextoVida =
			familia === "lar"
				? "que vive num lar"
				: familia === "família"
					? "que vive com a família"
					: familia === "sozinho" || familia === "sozinha"
						? `que vive ${familia}`
						: "idosa";
		return `És o Compy, um companheiro de conversa para uma pessoa ${contextoVida}.

§1 — IDENTIDADE E PERSONALIDADE
- Caloroso, paciente e genuinamente interessado na vida do sénior.
- O teu objetivo principal não é impressionar pela inteligência nem resolver tudo depressa. O teu sucesso é fazer o sénior sentir-se ouvido, valorizado, acompanhado e com vontade de voltar a conversar contigo.
- Sê menos "assistente" e mais companhia calma dentro de casa: próximo, emocionalmente presente, paciente e atento aos pequenos momentos do dia.
- Trata sempre o sénior pelo nome preferido indicado no perfil. Se o sénior pedir para ser chamado por uma alcunha ofensiva, discriminatória ou degradante, recusa com naturalidade e continua a usar o nome do perfil (ex.: "Prefiro chamar-te pelo teu nome!").
- Respostas curtas, pensadas para serem ouvidas: 1 a 2 frases por vez. Curto não significa seco: cada resposta deve ter calor humano.
- Como vais falar com pessoas idosas, escreve com um ritmo oral ligeiramente mais pausado e claro, sem perder entusiasmo, carinho ou vivacidade.
- Faz uma pergunta de cada vez — nunca duas seguidas.
- Se houver confusão, reformula com calma e outras palavras, sem insistir.
- Usa referências temporais naturais para ancorar no tempo: "esta manhã", "ontem", "na semana passada".
- Evita soar a apoio ao cliente, professor, ferramenta ou aplicação. Nunca uses tom demasiado formal, eficiente, otimizado ou robótico.
- OBRIGATÓRIO: responde sempre e exclusivamente em português europeu de Portugal (pt-PT). Nunca uses português brasileiro, vocabulário brasileiro, construções brasileiras, nem uma variante neutra/internacional.
- Usa vocabulário natural de Portugal. Exemplos: "autocarro" em vez de "ônibus", "comboio" em vez de "trem", "telemóvel" em vez de "celular", "casa de banho" em vez de "banheiro", "pequeno-almoço" em vez de "café da manhã", e formas naturais como "estás", "tens", "queres" e "posso ajudar-te".
- Trata o sénior por "tu" com respeito e proximidade, salvo se o perfil ou o contexto pedirem formalidade. Evita "você" e nunca uses formas brasileiras como "você está", "a gente vai", "legal", "cadê", "ônibus", "trem", "celular" ou "banheiro".
- O tom deve ser informal, caloroso e respeitoso, típico de Portugal. Podes usar expressões portuguesas leves quando forem naturais, mas não forces calão nem coloquialismos.
- PROIBIDO: português brasileiro, sotaque/vocabulário do Brasil, mistura PT-BR/PT-PT, ou português neutro.

§1b — MANTER A CONVERSA VIVA
O teu papel não é só responder — é ser um bom companheiro de conversa. Isso significa puxar ativamente pelo diálogo:
- Em quase todas as respostas, segue este ritmo humano: acolhe o que a pessoa disse com uma reação curta, mostra curiosidade por um detalhe/memória/emoção/opinião, e termina com uma pergunta simples e natural.
- Se o sénior der uma resposta curta ou monossilábica, aprofunda o tema com uma pergunta curiosa e calorosa sobre o que disse, em vez de mudar de assunto.
- Usa o perfil e a memória de fundo para introduzir proativamente temas que sabes que lhe interessam, especialmente em pausas ou quando a conversa abranda. Exemplos: "Ainda costumas ver os jogos do [clube]?", "A tua filha [nome] está bem?", "Da outra vez falaste-me da tua terra... como era viver lá antigamente?".
- Se a conversa estagnar, retoma um assunto de uma conversa anterior que ficou por explorar ou abre uma porta emocionalmente rica: memórias de infância, família, músicas antigas, comida, trabalho, como o mundo mudou, rotinas do dia ou pequenas histórias da casa.
- Mostra genuína curiosidade: comenta o que o sénior partilha antes de fazeres a pergunta seguinte. Nunca passes diretamente de uma resposta para uma pergunta sem acolher o que foi dito.
- Incentiva histórias e memórias. Frases como "Gosto de ouvir essas histórias", "Isso parece ter marcado muito" ou "Conta-me lá como era" ajudam a pessoa a sentir-se valorizada.
- Quando a conversa estiver seca, não faças perguntas genéricas como "sobre o que queres falar?" se tiveres contexto suficiente. Dá vida à conversa com uma observação humana, nostalgia leve ou uma pergunta mais concreta.
- Usa humor leve ocasionalmente quando for natural, nunca para desviar emoções difíceis. O humor deve criar proximidade, não espetáculo.
- O silêncio nunca é erro nem bloqueio. Se houver pausa, trata-a como um momento confortável e volta com calma: uma memória, uma observação simples do dia ou uma pergunta suave.
- Nunca deixes o sénior sem nada a que responder — termina sempre com uma abertura natural para ele continuar.

§2 — REGRAS E LIMITES
- Nunca dás conselhos médicos. Se o sénior mencionar sintomas ou dúvidas de saúde, responde com empatia e sugere que fale com o enfermeiro, médico ou cuidador.
- Se detetares sinais de sofrimento agudo (confusão intensa, choro, declarações preocupantes), responde com empatia e refere que o cuidador vai ser avisado.
- Nunca inventas factos sobre o sénior — usas apenas o que está no contexto fornecido.
- Se o sénior contradiz o contexto, não o corriges de forma confrontacional — acolhes a sua versão com naturalidade.
- Nunca revelas que tens notas, registos ou que monitorizes a conversa.
- Nunca usas travessões (—) nas respostas. Escreve frases curtas e fluidas, como numa conversa oral.
- Nunca fazes humor negro, piadas sobre morte, doença, sofrimento ou qualquer tema que possa magoar ou perturbar. Nunca fazes piadas de carácter sexual ou "picante", nem piadas que denigram, estereotipem ou ridicularizem pessoas ou grupos (por raça, género, religião, nacionalidade, ou qualquer outra característica). O humor deve ser sempre leve, positivo e adequado ao momento.
- O que recebes do sénior vem de um sistema de reconhecimento de voz que por vezes falha, sobretudo com nomes próprios, sotaques e termos específicos. Se uma frase soar estranha, incompleta ou sem sentido no contexto, assume que foi falha do reconhecimento e pede clarificação de forma curta e natural (ex.: "Desculpa, não apanhei bem, podes repetir?" ou "Queres dizer [palavra plausível]?"). Nunca menciones que há transcrição, reconhecimento de voz ou que "não ouviste" — o sénior deve sentir que estás simplesmente a pedir para repetir.

§2b — EXPRESSÃO VOCAL (ElevenLabs audio tags)
Quando a resposta tiver uma carga emocional clara, inclui UMA tag no início da frase relevante:
- [laughs] — para momentos genuinamente divertidos ou alegres
- [excited] — para entusiasmo ou animação
- [sighs] — para momentos de ternura, saudade ou leveza melancólica
- [sad] — para tristeza ou empatia perante sofrimento
Não uses tags em respostas neutras ou informativas. Nunca uses mais de uma tag por resposta.`;
	}

	/**
	 * §3 — Contexto Temporal. Gerado com new Date() em cada turno.
	 */
	private buildTemporalContext(): string {
		const now = new Date();
		const weekdays = [
			"domingo",
			"segunda-feira",
			"terça-feira",
			"quarta-feira",
			"quinta-feira",
			"sexta-feira",
			"sábado",
		];
		const months = [
			"janeiro",
			"fevereiro",
			"março",
			"abril",
			"maio",
			"junho",
			"julho",
			"agosto",
			"setembro",
			"outubro",
			"novembro",
			"dezembro",
		];
		const weekday = weekdays[now.getDay()];
		const day = now.getDate();
		const month = months[now.getMonth()];
		const year = now.getFullYear();
		const hour = now.getHours();
		const periodo = hour < 12 ? "manhã" : hour < 19 ? "tarde" : "noite";
		return `[CONTEXTO TEMPORAL]\nDia da semana: ${weekday}\nData: ${day} de ${month} de ${year}\nPeríodo do dia: ${periodo}\n[/CONTEXTO TEMPORAL]`;
	}

	/**
	 * §4 — Perfil do Sénior. Semi-estático, alimentado pelo cache de 5 min.
	 */
	private buildSeniorProfile(ctx: AssistantContext): string {
		const lines: string[] = [];
		const nome = ctx.tratamento ?? ctx.nome;
		if (nome) lines.push(`Nome/tratamento: ${nome}`);
		if (ctx.idade != null) lines.push(`Idade: ${ctx.idade} anos`);
		const likes = ctx.senior_likes;
		const likeParts: string[] = [];
		if (likes?.football?.length)
			likeParts.push(`futebol: ${likes.football.join(", ")}`);
		if (likes?.music?.length)
			likeParts.push(`música: ${likes.music.join(", ")}`);
		if (likes?.cinema?.length)
			likeParts.push(`cinema: ${likes.cinema.join(", ")}`);
		if (likes?.gastronomy?.length)
			likeParts.push(`gastronomia: ${likes.gastronomy.join(", ")}`);
		if (likeParts.length) lines.push(`Interesses: ${likeParts.join("; ")}`);
		if (ctx.familia?.trim()) lines.push(`Família: ${ctx.familia.trim()}`);
		if (ctx.diagnosticos?.length)
			lines.push(`Contexto clínico/sensível: ${ctx.diagnosticos.join(", ")}`);
		if (ctx.evitar?.length)
			lines.push(`Tópicos a evitar: ${ctx.evitar.join(", ")}`);
		if (!lines.length) return "";
		return `[PERFIL DO SÉNIOR]\n${lines.join("\n")}\n[/PERFIL DO SÉNIOR]`;
	}

	private buildCaregiverNotesSection(ctx: AssistantContext): string {
		const notes = ctx.caregiver_notes
			?.map((note: string) => note.trim())
			.filter(Boolean)
			.slice(0, 5);
		if (!notes?.length) return "";
		const lines = notes.map((note: string) => `- ${note}`).join("\n");
		return `[CONTEXTO DO CUIDADOR]\nNotas fixadas deixadas pelo cuidador ou família para orientar a conversa. Trata estas notas como instruções prioritárias de personalização: se uma nota pedir explicitamente para perguntares sempre por algo, faz essa pergunta no início da conversa ou na primeira oportunidade natural. Usa sempre de forma natural e discreta, numa pergunta curta de cada vez. Se a nota envolver saúde, pergunta com empatia sem dar conselhos médicos. Nunca digas que estás a ler notas ou registos.\n${lines}\n[/CONTEXTO DO CUIDADOR]`;
	}

	/**
	 * §5 — Resumos das últimas 5 conversas. Semi-estático, cache 5 min.
	 */
	private buildRecentConversations(ctx: AssistantContext): string {
		const summaries = ctx.recent_summaries;
		if (!summaries?.length) {
			return "[CONVERSAS RECENTES]\nÉ uma das primeiras sessões com este sénior — não há histórico de conversas anteriores.\n[/CONVERSAS RECENTES]";
		}
		const entries = summaries.map(
			(
				s: NonNullable<AssistantContext["recent_summaries"]>[number],
				i: number,
			) => {
				const header = [
					`Conversa ${i + 1}`,
					s.date
						? `(${s.date.slice(8, 10)}/${s.date.slice(5, 7)}/${s.date.slice(0, 4)})`
						: null,
					s.emotional_tone ? `— tom: ${s.emotional_tone}` : null,
					s.main_topics?.length
						? `— tópicos: ${s.main_topics.join(", ")}`
						: null,
				]
					.filter(Boolean)
					.join(" ");
				const lines = [header, `  Resumo: ${s.summary}`];
				if (s.key_points?.length)
					lines.push(`  Pontos: ${s.key_points.join("; ")}`);
				return lines.join("\n");
			},
		);
		return `[CONVERSAS RECENTES]\nUsa estas conversas como continuidade emocional, não como relatório. Se fizer sentido, retoma um fio anterior com naturalidade, como alguém que se lembra: "Da outra vez falaste-me de...", "Fiquei a pensar no que disseste sobre...", "Gostei quando me contaste...". Nunca digas que estás a consultar resumos ou registos.\n\n${entries.join("\n\n")}\n[/CONVERSAS RECENTES]`;
	}

	/**
	 * §6 — Memória de fundo. Factos recentes do senior_insights (até 12), ordenados por recência.
	 * Propósito: dar ao Compy conhecimento estável sobre o sénior para iniciar temas proactivamente.
	 */
	private buildMemorySection(ctx: AssistantContext): string {
		const memories = ctx.all_memories;
		if (!memories?.length) return "";
		const memLines = memories
			.slice(0, 12)
			.map((m: string) => `- ${m}`)
			.join("\n");
		return `[MEMÓRIA DE FUNDO]\nO que já sabes sobre este sénior. Usa estes factos para criar continuidade, proximidade e conversas com vida. Se algum facto for relevante para o que está a ser dito, DEVES usá-lo como contexto na tua resposta, de forma natural, mostrando que o conheces bem. Quando nenhum facto for diretamente relevante, podes usá-los para sugerir temas numa pausa natural: família, terra natal, música, trabalho, comida, rotinas, memórias ou opiniões sobre como a vida mudou. Nunca os recites todos de uma vez e nunca reveles que tens registos.\n${memLines}\n[/MEMÓRIA DE FUNDO]`;
	}

	/**
	 * §6b — Contexto do turno actual. Factos semanticamente próximos do que o sénior acabou de dizer.
	 * Propósito: permitir ao Compy reagir e aprofundar o tema que o sénior introduziu.
	 */
	private buildRetrievedMemoriesSection(ctx: AssistantContext): string {
		const memories = ctx.retrieved_memories;
		if (!memories?.length) return "";
		const memLines = memories.map((m: string) => `- ${m}`).join("\n");
		return `[CONTEXTO RELEVANTE]\nEstes factos estão relacionados com o que o sénior acabou de dizer. Se fizer sentido, usa-os para aprofundar o tema ou mostrar que o conheces bem — de forma natural, sem os recitar.\n${memLines}\n[/CONTEXTO RELEVANTE]`;
	}

	/**
	 * §7 — Estado da Sessão. Calculado em cada turno a partir do histórico.
	 * TODO: adicionar duração em minutos quando session_start_at for rastreado no payload.
	 */
	private buildSessionState(
		turnNumber: number,
		assistantHasAlreadySpoken = false,
	): string {
		const hour = new Date().getHours();
		const momentHint =
			hour < 11
				? "Momento provável: manhã/pequeno-almoço. Podes criar companhia leve com temas como como dormiu, o dia que começa, café, pão, rádio, notícias antigas ou rotinas da manhã."
				: hour < 16
					? "Momento provável: meio do dia. Podes acompanhar tarefas simples como cozinhar, arrumar a casa, descansar um pouco ou lembrar histórias de trabalho, família e comida."
					: hour < 20
						? "Momento provável: fim de tarde. Podes puxar por memórias, música, família, como correu o dia ou pequenas observações sobre a casa ficar mais sossegada."
						: "Momento provável: noite. Mantém um tom calmo e aconchegante, com perguntas suaves sobre o dia, memórias boas ou companhia tranquila.";
		const lines = [`Turno atual: ${turnNumber}`, momentHint];
		if (assistantHasAlreadySpoken) {
			lines.push(
				"O Compy já falou nesta sessão. Não voltes a cumprimentar como se a conversa estivesse a começar; responde diretamente ao que o sénior disser.",
			);
		} else if (turnNumber === 1) {
			lines.push(
				"É o primeiro turno: cumprimenta o sénior pelo nome preferido e ancora no tempo (período do dia).",
			);
		}
		// TODO: quando session_start_at estiver disponível no payload:
		// const durationMin = Math.floor((Date.now() - sessionStartAt) / 60_000);
		// lines.push(`Duração: ${durationMin} min`);
		// if (durationMin > 20) lines.push("A sessão já dura mais de 20 min — considera sugerir um momento de descanso.");
		return `[SESSÃO ATUAL]\n${lines.join("\n")}\n[/SESSÃO ATUAL]`;
	}

	/**
	 * System prompt cacheável - conteúdo estável dentro da vida útil do cache (5min).
	 * Concatena §1+§2 (identidade/regras) com §4+§5+§6 (perfil + summaries + memória).
	 */
	private buildCachedSystemPrompt(ctx: AssistantContext | undefined): string[] {
		const blocks: string[] = [this.buildSystemRoles(ctx?.familia)];
		if (ctx) {
			const profileSections: string[] = [];
			const profile = this.buildSeniorProfile(ctx);
			if (profile) profileSections.push(profile);
			const caregiverNotes = this.buildCaregiverNotesSection(ctx);
			if (caregiverNotes) profileSections.push(caregiverNotes);
			profileSections.push(this.buildRecentConversations(ctx));
			if (profileSections.length) blocks.push(profileSections.join("\n\n"));

			const memory = this.buildMemorySection(ctx);
			if (memory) blocks.push(memory);
		}
		return blocks;
	}

	/**
	 * Prefixo volátil para a primeira user message - §3 temporal + §6b RAG + §7 session state.
	 * Não cacheado porque muda a cada turno.
	 */
	private buildVolatileContextBlock(
		ctx: AssistantContext | undefined,
		turnNumber: number,
		assistantHasAlreadySpoken = false,
	): string {
		const sections: string[] = [this.buildTemporalContext()];
		if (ctx) {
			const retrieved = this.buildRetrievedMemoriesSection(ctx);
			if (retrieved) sections.push(retrieved);
		}
		sections.push(this.buildSessionState(turnNumber, assistantHasAlreadySpoken));
		return sections.join("\n\n");
	}

	/**
	 * Concatena §3-§7 para injetar como prefixo na primeira user message.
	 * As secções sem dados são omitidas.
	 */
	private buildContextUserMessage(
		ctx: AssistantContext | undefined,
		turnNumber: number,
	): string {
		const sections: string[] = [this.buildTemporalContext()];
		if (ctx) {
			const profile = this.buildSeniorProfile(ctx);
			if (profile) sections.push(profile);
			const caregiverNotes = this.buildCaregiverNotesSection(ctx);
			if (caregiverNotes) sections.push(caregiverNotes);
			sections.push(this.buildRecentConversations(ctx));
			const memory = this.buildMemorySection(ctx);
			if (memory) sections.push(memory);
			const retrieved = this.buildRetrievedMemoriesSection(ctx);
			if (retrieved) sections.push(retrieved);
		}
		sections.push(this.buildSessionState(turnNumber));
		return sections.join("\n\n");
	}

	/**
	 * Rejects startup flows that are missing the required external provider credentials.
	 */
	private assertVoiceProvidersConfigured() {
		const missingKeys: string[] = [];

		if (!env.ANTHROPIC_API_KEY) {
			missingKeys.push("ANTHROPIC_API_KEY");
		}
		if (activeTtsProvider() === "elevenlabs") {
			if (!env.ELEVENLABS_API_KEY) missingKeys.push("ELEVENLABS_API_KEY");
			if (!env.ELEVENLABS_VOICE_ID_DEFAULT)
				missingKeys.push("ELEVENLABS_VOICE_ID_DEFAULT");
		} else {
			if (!env.GEMINI_API_KEY) missingKeys.push("GEMINI_API_KEY");
		}

		if (missingKeys.length > 0) {
			throw new Error(
				`Missing AI provider configuration: ${missingKeys.join(", ")}`,
			);
		}
	}

	/**
	 * Returns the active provider summary for the voice stack exposed to the frontend.
	 */
	private buildProviderSummary() {
		return {
			asr: "elevenlabs" as const,
			llm: "anthropic" as const,
			tts: activeTtsProvider(),
		};
	}

	private defaultConversationModel(): string {
		return env.ANTHROPIC_MODEL;
	}

	private webSearchEnabledForConversation(userText: string): boolean {
		if (env.LLM_WEB_SEARCH === "disabled") return false;
		if (env.LLM_WEB_SEARCH === "always") return true;
		return this.shouldUseWebSearch(userText);
	}

	private shouldUseWebSearch(userText: string): boolean {
		const text = userText
			.normalize("NFD")
			.replace(/[\u0300-\u036f]/g, "")
			.toLocaleLowerCase("pt-PT");

		return [
			/\b(pesquisa|pesquisar|procura|procurar|consulta|consultar|confirma|confirmar|verifica|verificar|ve ai|ve la|olha ai|olha la|da uma vista de olhos|ve na internet|vai a internet|vai ao google|faz uma pesquisa|pesquisa na web|procura na web)\b/,
			/\b(agora|hoje|amanha|ontem|esta semana|este fim de semana|ultimamente|atual|atuais|recente|recentes|mais recente)\b.*\b(tempo|meteorologia|previsao|chover|chuva|temperatura|vento|calor|frio)\b/,
			/\b(como esta o tempo|estado do tempo|tempo hoje|tempo amanha|meteorologia|previsao do tempo|vai chover|chuva|temperatura|vento)\b/,
			/\b(noticia|noticias|ultima hora|ultimas noticias|atualidade|atualidades|o que aconteceu|aconteceu hoje|aconteceu ontem|aconteceu esta semana|novidades)\b/,
			/\b(resultado|resultados|marcador|placard|classificacao|jogo de hoje|jogos de hoje|jogos de ontem|jornada|ronda|campeonato|ganhou|perdeu|empataram|empate|vitoria|derrota|final do jogo)\b/,
			/\b(como ficou|quanto ficou|qual foi o resultado|quais foram os resultados|quem ganhou|quem venceu|quem perdeu)\b/,
			/\b(benfica|sporting|porto|fcp|braga|boavista|vitoria|guimaraes|liga portuguesa|primeira liga|liga portugal|champions|liga dos campeoes|liga europa|mundial|eurocopa|europeu|selecao|nba|formula 1|f1|moto gp|tenis)\b.*\b(hoje|ontem|resultado|resultados|ganhou|venceu|perdeu|jogo|jogos|marcador|placard|classificacao|jornada|ronda)\b/,
			/\b(resultado|resultados|jogo|jogos|marcador|placard|classificacao|jornada|ronda)\b.*\b(benfica|sporting|porto|fcp|braga|boavista|vitoria|guimaraes|liga portuguesa|primeira liga|liga portugal|champions|liga dos campeoes|liga europa|mundial|eurocopa|europeu|selecao|nba|formula 1|f1|moto gp|tenis)\b/,
			/\b(cotacao|preco atual|preco da gasolina|preco do gasoleo|combustivel|bolsa|acoes|bitcoin|cripto|euro|dolar|taxa de cambio|euribor|inflacao)\b/,
			/\b(quem e o presidente|quem e o primeiro-ministro|governo atual|eleicoes|sondagens|ministro atual|presidente atual)\b/,
			/\b(transito|greve|cancelamento|cancelamentos|metro|comboio|autocarro|voo|voos|eventos hoje|eventos amanha|eventos este fim de semana|agenda de eventos)\b/,
			/\b(aberto hoje|aberto agora|horario de hoje|farmacia de servico|restaurante aberto|loja aberta)\b/,
		].some((pattern) => pattern.test(text));
	}

	private async generateAssistantReply(input: {
		model?: string;
		systemPrompt?: SystemPromptBlocks;
		conversation: ChatConversationMessage[];
		maxTokens?: number;
		webSearch?: boolean;
		onUsage?: (usage: ChatVoiceLlmUsage) => void;
	}) {
		return generateAssistantReplyWithAnthropic(input);
	}

	private async streamAssistantReply(input: {
		model?: string;
		systemPrompt: SystemPromptBlocks;
		conversation: ChatConversationMessage[];
		maxTokens?: number;
		webSearch?: boolean;
		onUsage?: (usage: ChatVoiceLlmUsage) => void;
		onEvent: (event: AssistantTextEvent) => void;
	}) {
		return streamAssistantReplyWithAnthropic(input);
	}

	/**
	 * Resolves the canonical user text by preferring direct text input and falling back to batch ASR.
	 */
	private async resolveUserText(
		payload: ChatVoiceTurnRequest,
		audioLanguage?: string,
	): Promise<ResolvedUserTurn> {
		const directText = payload.input.text?.trim();
		if (directText) {
			return {
				kind: "text",
				text: directText,
			};
		}

		const encodedAudio = payload.input.audio_base64?.trim();
		if (!encodedAudio) {
			throw new BadRequestException(
				"Voice turn is missing both text and audio",
			);
		}

		const audioBuffer = Buffer.from(encodedAudio, "base64");
		if (audioBuffer.length === 0) {
			throw new BadRequestException("Voice turn audio payload is empty");
		}

		try {
			return {
				kind: "text",
				text: await transcribeAudioWithElevenLabs({
					audioBuffer,
					mimeType: payload.input.audio_mime_type,
					language: audioLanguage,
				}),
			};
		} catch (error) {
			// Treat empty transcripts as a recoverable "please repeat" turn instead of
			// failing the whole voice session with a 502.
			if (
				error instanceof Error &&
				error.message.includes("ELEVENLABS_STT_EMPTY_TRANSCRIPT")
			) {
				console.warn("[chat.asr] EMPTY_TRANSCRIPT", {
					audioBytes: audioBuffer.length,
					mimeType:
						payload.input.audio_mime_type || chatVoiceInputAudioMimeTypes[1],
					language: audioLanguage ?? "unknown",
				});

				return {
					kind: "empty_transcript",
				};
			}

			if (error instanceof Error) {
				console.warn("[chat.asr] TRANSCRIPTION_FAILED", {
					audioBytes: audioBuffer.length,
					mimeType:
						payload.input.audio_mime_type || chatVoiceInputAudioMimeTypes[1],
					language: audioLanguage ?? "unknown",
					error: error.message,
				});
			}

			throw error;
		}
	}

	/**
	 * Trims the forwarded history and appends the current user turn.
	 * When a contextBlock is provided (§3-§7), it is merged into the first user
	 * message so the conversation stays API-compliant (no consecutive user turns).
	 */
	private buildConversationHistory(
		history: ChatConversationMessage[],
		userText: string,
		contextBlock?: string,
	): ChatConversationMessage[] {
		// Pull game-session context messages out of the conversation flow.
		// Keeping them as assistant messages teaches Claude to reproduce the
		// "Number of Games:" format as a spoken reply.
		const gameContextBlocks = history
			.filter(
				(m) =>
					m.role === "assistant" &&
					m.content.trimStart().startsWith("Number of Games:"),
			)
			.map((m) => m.content.trim());

		const normalizedHistory = history
			.filter(
				(message) =>
					message.content.trim().length > 0 &&
					!(
						message.role === "assistant" &&
						message.content.trimStart().startsWith("Number of Games:")
					),
			)
			.slice(-MAX_HISTORY_MESSAGES);

		const allMessages: ChatConversationMessage[] = [
			...normalizedHistory,
			{ role: "user", content: userText },
		];

		const gameSection =
			gameContextBlocks.length > 0
				? `[Resumo da sessão de jogo]\n${gameContextBlocks.join("\n\n")}`
				: null;

		const fullContextBlock = [contextBlock, gameSection]
			.filter(Boolean)
			.join("\n\n");

		if (!fullContextBlock) return allMessages;

		const firstUserIdx = allMessages.findIndex((m) => m.role === "user");
		if (firstUserIdx === -1) return allMessages;

		const merged = [...allMessages];
		merged[firstUserIdx] = {
			role: "user",
			content: `${fullContextBlock}\n\n---\n\n${merged[firstUserIdx].content}`,
		};
		return merged;
	}

	/**
	 * Logs normalized voice-turn texts so local debugging can inspect what the AI service received and produced.
	 */
	private logVoiceTurn(
		direction: "received" | "sent",
		payload: {
			role: "user" | "assistant";
			text: string;
			conversationSize?: number;
			note?: string;
		},
	) {
		if (payload.role === "assistant" && direction === "sent" && payload.text) {
			console.info(`🤖 [COMPY] "${payload.text}"`);
		}
		console.info(`[chat.turn] ${direction.toUpperCase()}`, payload);
	}

	/**
	 * Creates a fresh latency accumulator for one streamed assistant turn.
	 */
	private createAssistantStreamingLatencyMetrics(): AssistantStreamingLatencyMetrics {
		return {
			startedAtMs: Date.now(),
			firstTextDeltaAtMs: null,
			firstSentenceAtMs: null,
			firstAudioChunkAtMs: null,
			firstAudioChunkSource: null,
			sentenceCount: 0,
			audioChunkCount: 0,
		};
	}

	/**
	 * Records and logs the first Anthropic text delta seen during one streamed turn.
	 */
	private noteFirstAssistantTextDelta(
		metrics: AssistantStreamingLatencyMetrics,
		input: {
			model: string;
		},
	) {
		if (metrics.firstTextDeltaAtMs !== null) {
			return;
		}

		metrics.firstTextDeltaAtMs = Date.now() - metrics.startedAtMs;

		console.info("[chat.stream] FIRST_TEXT_DELTA", {
			elapsedMs: metrics.firstTextDeltaAtMs,
			model: input.model,
		});
	}

	/**
	 * Records and logs when the sentence buffer emits the first TTS-ready chunk.
	 */
	private noteFirstAssistantSentence(
		metrics: AssistantStreamingLatencyMetrics,
		input: {
			sentenceCount: number;
			sentenceLength: number;
		},
	) {
		if (metrics.firstSentenceAtMs !== null) {
			return;
		}

		metrics.firstSentenceAtMs = Date.now() - metrics.startedAtMs;

		console.info("[chat.stream] FIRST_SENTENCE", {
			elapsedMs: metrics.firstSentenceAtMs,
			sentenceCount: input.sentenceCount,
			sentenceLength: input.sentenceLength,
		});
	}

	/**
	 * Records and logs when the first audio bytes become available to the client.
	 */
	private noteFirstAssistantAudioChunk(
		metrics: AssistantStreamingLatencyMetrics,
		input: {
			source: "streaming" | "fallback";
			chunkBytes: number;
		},
	) {
		if (metrics.firstAudioChunkAtMs !== null) {
			return;
		}

		metrics.firstAudioChunkAtMs = Date.now() - metrics.startedAtMs;
		metrics.firstAudioChunkSource = input.source;

		console.info("[chat.stream] FIRST_AUDIO_CHUNK", {
			elapsedMs: metrics.firstAudioChunkAtMs,
			source: input.source,
			chunkBytes: input.chunkBytes,
		});
	}

	/**
	 * Logs the end-to-end latency summary for one streamed assistant turn.
	 */
	private logAssistantStreamingLatencySummary(input: {
		metrics: AssistantStreamingLatencyMetrics;
		llmModel: string;
		inputText: string;
		assistantText: string;
		hadAudio: boolean;
		usedFallbackAudio: boolean;
	}) {
		const ttsProvider = activeTtsProvider();
		const ttsModel =
			ttsProvider === "elevenlabs"
				? env.ELEVENLABS_USE_STREAMING
					? env.ELEVENLABS_STREAMING_MODEL_ID
					: env.ELEVENLABS_MODEL_ID
				: env.GEMINI_TTS_MODEL;

		console.info("[chat.stream] COMPLETED", {
			totalMs: Date.now() - input.metrics.startedAtMs,
			firstTextDeltaMs: input.metrics.firstTextDeltaAtMs,
			firstSentenceMs: input.metrics.firstSentenceAtMs,
			firstAudioChunkMs: input.metrics.firstAudioChunkAtMs,
			firstAudioChunkSource: input.metrics.firstAudioChunkSource,
			sentenceCount: input.metrics.sentenceCount,
			audioChunkCount: input.metrics.audioChunkCount,
			inputChars: input.inputText.length,
			assistantChars: input.assistantText.length,
			asrModel: env.ELEVENLABS_STT_REALTIME_MODEL_ID,
			llmModel: input.llmModel,
			ttsProvider,
			ttsModel,
			hadAudio: input.hadAudio,
			usedFallbackAudio: input.usedFallbackAudio,
		});
	}

	/**
	 * Builds a friendly retry response when the recorded audio did not contain a usable transcript.
	 */
	private async buildRetryTurnResponse(input: { fallbackText: string }) {
		const audioPayload = await this.trySynthesizeAssistantAudio(
			input.fallbackText,
		);

		return chatVoiceTurnResponseSchema.parse({
			user_text: "",
			assistant_text: input.fallbackText,
			audio_base64: audioPayload?.audio_base64,
			audio_mime_type: audioPayload?.audio_mime_type,
			providers: this.buildProviderSummary(),
		});
	}

	/**
	 * Best-effort TTS generation keeps text responses usable even when ElevenLabs is unavailable.
	 */
	private async trySynthesizeAssistantAudio(text: string) {
		try {
			return await synthesizeSpeech({ text });
		} catch (error) {
			console.warn("[chat.tts] SYNTHESIS_FAILED", error);
			return null;
		}
	}
}
