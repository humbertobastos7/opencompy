import {
	chatVoiceInputAudioMimeTypes,
	type ChatVoiceInputAudioMimeType,
	type ChatConversationMessage,
	type ChatVoiceAudioTransport,
	type ChatVoiceLlmUsage,
	type ChatVoiceSessionConfig,
	type ChatVoiceWsClientMessage,
	type ChatVoiceWsProviders,
	type ChatVoiceWsServerMessage,
} from "@/shared/contracts";
import {
	closeVoiceConversation,
	createVoiceSession,
	submitVoiceTurn,
	type SessionOutcome,
} from "@/frontend/lib/speech";
import { ProgressiveAudioPlayer } from "@/frontend/lib/audio-player";
import { VISIT_KEY } from "@/frontend/utils/visit";

type RealtimeEvent = {
	type: string;
	[key: string]: unknown;
};

type MediaPipeline = {
	stream: MediaStream;
	audioContext: AudioContext;
	analyser: AnalyserNode;
	sampleBuffer: Uint8Array;
	mimeType?: ChatVoiceInputAudioMimeType;
	pcmWorkletNode?: AudioWorkletNode;
};

const PCM_WORKLET_TARGET_CHUNK_MS = 80;
const PCM_PREROLL_MS = 320;
const PCM_PREROLL_CHUNKS = Math.ceil(
	PCM_PREROLL_MS / PCM_WORKLET_TARGET_CHUNK_MS,
);
const PCM_PREROLL_READY_CHUNKS = Math.max(1, PCM_PREROLL_CHUNKS - 1);
const PCM_PREROLL_READY_TIMEOUT_MS =
	PCM_PREROLL_MS + PCM_WORKLET_TARGET_CHUNK_MS;
const FINALIZE_WITHOUT_TURN_DONE_MS = 2000;
const WEBSOCKET_TURN_DONE_GRACE_MS = 1200;

/**
 * Inline AudioWorklet processor that converts Float32 samples from the
 * microphone into Int16 PCM LE at 16 kHz (downsampling as needed) and
 * posts them back to the main thread in small batches. Batching inside the
 * worklet reduces the amount of audio message handling the browser main
 * thread must do while the senior screen is animating.
 */
const PCM_WORKLET_CODE = `
const TARGET_RATE = 16000;
const TARGET_CHUNK_SAMPLES = Math.max(
	1,
	Math.round((TARGET_RATE * ${PCM_WORKLET_TARGET_CHUNK_MS}) / 1000),
);
class PCMCaptureProcessor extends AudioWorkletProcessor {
	constructor() {
		super();
		this.ratio = sampleRate / TARGET_RATE;
		this.carry = [];
		this.pendingChunks = [];
		this.pendingSamples = 0;
	}
	flushPending() {
		if (this.pendingSamples === 0) return;
		const merged = new Int16Array(this.pendingSamples);
		let offset = 0;
		for (const chunk of this.pendingChunks) {
			merged.set(chunk, offset);
			offset += chunk.length;
		}
		this.pendingChunks = [];
		this.pendingSamples = 0;
		this.port.postMessage(merged.buffer, [merged.buffer]);
	}
	process(inputs) {
		const input = inputs[0];
		if (!input || !input[0] || input[0].length === 0) return true;
		const channel = input[0];
		// Merge any carried-over samples with this block for continuous resampling.
		let src;
		if (this.carry.length > 0) {
			src = new Float32Array(this.carry.length + channel.length);
			src.set(this.carry, 0);
			src.set(channel, this.carry.length);
			this.carry = [];
		} else {
			src = channel;
		}

		const ratio = this.ratio;
		const outLen = Math.floor(src.length / ratio);
		const int16 = new Int16Array(outLen);
		for (let i = 0; i < outLen; i++) {
			const start = Math.floor(i * ratio);
			const end = Math.floor((i + 1) * ratio);
			let sum = 0;
			for (let j = start; j < end; j++) sum += src[j];
			const avg = sum / (end - start);
			const s = Math.max(-1, Math.min(1, avg));
			int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
		}

		// Keep the leftover source samples (beyond the last full output sample)
		// so we do not drop audio on non-integer ratios (e.g. 48000 / 16000 = 3).
		const consumed = Math.floor(outLen * ratio);
		if (consumed < src.length) {
			this.carry = Array.from(src.slice(consumed));
		}

		if (int16.length > 0) {
			this.pendingChunks.push(int16);
			this.pendingSamples += int16.length;
		}
		if (this.pendingSamples >= TARGET_CHUNK_SAMPLES) {
			this.flushPending();
		}
		return true;
	}
}
registerProcessor('pcm-capture-processor', PCMCaptureProcessor);
`;

const registeredWorkletContexts = new WeakSet<AudioContext>();

const registerPcmWorklet = async (audioContext: AudioContext) => {
	if (registeredWorkletContexts.has(audioContext)) return;
	const blob = new Blob([PCM_WORKLET_CODE], { type: "application/javascript" });
	const url = URL.createObjectURL(blob);
	await audioContext.audioWorklet.addModule(url);
	URL.revokeObjectURL(url);
	registeredWorkletContexts.add(audioContext);
};

type RealtimeWebSocketState = {
	socket: WebSocket;
	session: ChatVoiceSessionConfig;
	providers: ChatVoiceWsProviders;
	audioTransport: ChatVoiceAudioTransport;
};

type RecentSummary = {
	date?: string;
	summary: string;
	key_points?: string[];
	main_topics: string[];
	emotional_tone?: string;
};

type RealtimeWebSocketTextTurnResult = {
	user_text: string;
	assistant_text: string;
	audio_blob?: Blob;
	audio_was_streamed: boolean;
	voice_end_confirmed?: boolean;
	suppress_speech_fallback?: boolean;
	conversation_id?: string;
	retrieved_memories?: string[];
	all_memories?: string[];
	llm_usage?: ChatVoiceLlmUsage;
	recent_summaries?: RecentSummary[];
};

type RealtimeWebSocketAudioStreamHandlers = {
	onAudioChunk: (
		audioChunk: Uint8Array,
		segment: "prelude" | "response",
	) => void;
	onAudioDone: () => void;
};

type ActiveLiveAudioUpload = {
	chunks: Blob[];
	mimeType: ChatVoiceInputAudioMimeType;
	uploadChain: Promise<void>;
	uploadError: Error | null;
};

export type RealtimeSessionOptions = ChatVoiceSessionConfig;

export type StartRealtimeVoiceSessionOptions = {
	session?: RealtimeSessionOptions;
	/** Pre-created AudioContext from a user gesture — required on iOS to unlock audio playback. */
	audioContext?: AudioContext;
	onEvent?: (event: RealtimeEvent) => void;
	onUserTranscript?: (text: string) => void;
	onAssistantTranscriptDelta?: (textDelta: string) => void;
	onAssistantTranscriptDone?: (text: string) => void;
	onMemoriesUpdate?: (data: {
		retrieved: string[];
		all: string[];
		recentSummaries: RecentSummary[];
	}) => void;
	onListeningChange?: (listening: boolean) => void;
	onThinkingChange?: (thinking: boolean) => void;
	onSpeakingChange?: (speaking: boolean) => void;
	onAudioPlaybackStarted?: () => void;
	onPreludeAudioPlaybackEnded?: () => void;
	onResponseAudioPlaybackStarted?: () => void;
	onCharTimings?: (chars: string[], startTimesMs: number[]) => void;
	onVoiceEndConfirmed?: () => void | Promise<void>;
	onError?: (error: unknown) => void;
};

export type RealtimeVoiceController = {
	startListening: () => Promise<void>;
	stop: (outcome?: SessionOutcome) => Promise<void>;
	cancelResponse: () => void;
	sendTextMessage: (text: string) => Promise<void>;
	noteMemoryGameOffer: (text: string) => void;
	noteMemoryGameCompleted: (assistantText: string) => void;
	noteAssistantPrompt: (text: string) => void;
	playAssistantPrompt: (
		audioBase64: string,
		mimeType?: "audio/mpeg" | "audio/wav",
	) => Promise<void>;
	pauseMic: () => void;
	sendKeepalive: () => void;
};

let websocketAudioInputStarted = false;

const AUDIO_MIME_CANDIDATES = chatVoiceInputAudioMimeTypes;
const isRealtimeLoggingEnabled = import.meta.env.DEV;

const buildVoiceWebSocketUrl = () => {
	const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
	const url = new URL(`${protocol}//${window.location.host}/api/chat/voice/ws`);
	// Same visit key as the HTTP API so voice and text share one conversation.
	url.searchParams.set("visit", VISIT_KEY);
	return url;
};

/**
 * Sends one typed JSON message through the active voice WebSocket connection.
 */
const sendWebSocketMessage = (
	socket: WebSocket,
	message: ChatVoiceWsClientMessage,
) => {
	socket.send(JSON.stringify(message));
};

/**
 * Sends one recorded browser chunk immediatly through the active voice
 * WebSocket so backend ASR can start processing before the turn ends.
 */
const sendAudioChunkOverWebSocket = async (
	websocketState: RealtimeWebSocketState,
	chunk: Blob,
	mimeType: ChatVoiceInputAudioMimeType,
) => {
	if (websocketState.socket.readyState !== WebSocket.OPEN) {
		throw new Error("VOICE_WEBSOCKET_NOT_OPEN");
	}

	if (!websocketAudioInputStarted) {
		websocketAudioInputStarted = true;
		sendWebSocketMessage(websocketState.socket, {
			type: "audio.input.start",
			mime_type: mimeType,
		});
	}

	websocketState.socket.send(await chunk.arrayBuffer());
};

/**
 * Opens the backend voice WebSocket and resolves only after the session is acknowledged.
 */
const connectVoiceWebSocket = async (
	session: ChatVoiceSessionConfig,
	onEvent?: (event: RealtimeEvent) => void,
): Promise<RealtimeWebSocketState> => {
	const socketUrl = buildVoiceWebSocketUrl();

	return await new Promise<RealtimeWebSocketState>((resolve, reject) => {
		const socket = new WebSocket(socketUrl);
		socket.binaryType = "arraybuffer";
		let settled = false;

		const cleanupBootstrapHandlers = () => {
			socket.onopen = null;
			socket.onmessage = null;
			socket.onerror = null;
			socket.onclose = null;
		};

		const rejectOnce = (error: Error) => {
			if (settled) {
				return;
			}

			settled = true;
			cleanupBootstrapHandlers();

			if (
				socket.readyState === WebSocket.OPEN ||
				socket.readyState === WebSocket.CONNECTING
			) {
				socket.close();
			}
			reject(error);
		};

		socket.onopen = () => {
			sendWebSocketMessage(socket, {
				type: "session.create",
				session,
			});
		};

		socket.onerror = () => {
			rejectOnce(new Error("VOICE_WEBSOCKET_CONNECTION_FAILED"));
		};

		socket.onclose = () => {
			rejectOnce(new Error("VOICE_WEBSOCKET_CLOSED_DURING_BOOTSTRAP"));
		};

		socket.onmessage = (event) => {
			try {
				if (typeof event.data !== "string") {
					rejectOnce(new Error("VOICE_WEBSOCKET_INVALID_MESSAGE"));
					return;
				}

				const message = JSON.parse(event.data) as ChatVoiceWsServerMessage;
				onEvent?.(message as RealtimeEvent);

				if (message.type === "error") {
					rejectOnce(
						new Error(
							message.code
								? `${message.code}: ${message.message}`
								: message.message,
						),
					);
					return;
				}
				if (message.type !== "session.ready") {
					return;
				}
				if (settled) {
					return;
				}
				settled = true;
				cleanupBootstrapHandlers();
				resolve({
					socket,
					session: message.session,
					providers: message.providers,
					audioTransport: message.audio_transport,
				});
			} catch (error) {
				rejectOnce(
					error instanceof Error
						? error
						: new Error("VOICE_WEBSOCKET_MESSAGE_HANDLING_FAILED"),
				);
			}
		};
	});
};

/**
 * Sends one text turn through the backend voice WebSocket and waits for the full reply.
 */
const submitTextTurnOverWebSocket = async (
	websocketState: RealtimeWebSocketState,
	text: string,
	conversationId: string | undefined,
	conversation: ChatConversationMessage[],
	onEvent?: (event: RealtimeEvent) => void,
	audioStreamHandlers?: RealtimeWebSocketAudioStreamHandlers,
	onCharTimings?: (chars: string[], startTimesMs: number[]) => void,
	onAssistantTextDelta?: (textDelta: string) => void,
): Promise<RealtimeWebSocketTextTurnResult> => {
	if (websocketState.socket.readyState !== WebSocket.OPEN) {
		throw new Error("VOICE_WEBSOCKET_NOT_OPEN");
	}

	return await new Promise<RealtimeWebSocketTextTurnResult>(
		(resolve, reject) => {
			let settled = false;
			let userText = "";
			let assistantText = "";
			let audioWasStreamed = false;
			let voiceEndConfirmed = false;
			let suppressSpeechFallback = false;
			let expectingBinaryAssistantAudio = false;
			const audioChunks: Uint8Array[] = [];
			let finalizeWithoutTurnDoneTimer: number | null = null;
			let retrievedMemories: string[] | undefined;
			let allMemories: string[] | undefined;
			let llmUsage: ChatVoiceLlmUsage | undefined;
			let recentSummaries: RecentSummary[] | undefined;
			let conversationEndRequested = false;
			let responseTextDoneReceived = false;

			const cleanup = () => {
				if (finalizeWithoutTurnDoneTimer !== null) {
					window.clearTimeout(finalizeWithoutTurnDoneTimer);
					finalizeWithoutTurnDoneTimer = null;
				}
				websocketState.socket.removeEventListener("message", handleMessage);
				websocketState.socket.removeEventListener("error", handleError);
				websocketState.socket.removeEventListener("close", handleClose);
			};

			const rejectOnce = (error: Error) => {
				if (settled) {
					return;
				}

				settled = true;
				cleanup();
				reject(error);
			};

			const handleError = (_event: Event) => {
				rejectOnce(new Error("VOICE_WEBSOCKET_TEXT_TURN_FAILED"));
			};

			const handleClose = (_event: CloseEvent) => {
				rejectOnce(new Error("VOICE_WEBSOCKET_CLOSED_DURING_TEXT_TURN"));
			};

			const resolveWithCurrentPayload = (conversationId?: string) => {
				if (settled) {
					return;
				}

				settled = true;
				cleanup();

				const audioBlob =
					audioChunks.length > 0
						? new Blob(audioChunks, { type: "audio/mpeg" })
						: undefined;

				resolve({
					user_text: userText,
					assistant_text: assistantText,
					audio_blob: audioBlob,
					audio_was_streamed: audioWasStreamed,
					voice_end_confirmed: voiceEndConfirmed,
					suppress_speech_fallback: suppressSpeechFallback,
					conversation_id: conversationId,
					retrieved_memories: retrievedMemories,
					all_memories: allMemories,
					llm_usage: llmUsage,
					recent_summaries: recentSummaries,
				});
			};

			const handleMessage = async (event: MessageEvent) => {
				try {
					if (event.data instanceof ArrayBuffer || event.data instanceof Blob) {
						if (!expectingBinaryAssistantAudio) {
							rejectOnce(
								new Error("VOICE_WEBSOCKET_UNEXPECTED_BINARY_MESSAGE"),
							);
							return;
						}

						const binaryChunk =
							event.data instanceof ArrayBuffer
								? new Uint8Array(event.data)
								: new Uint8Array(await event.data.arrayBuffer());

						if (audioStreamHandlers) {
							audioWasStreamed = true;
							audioStreamHandlers.onAudioChunk(
								binaryChunk,
								responseTextDoneReceived ? "response" : "prelude",
							);
							return;
						}

						audioChunks.push(binaryChunk);
						return;
					}

					if (typeof event.data !== "string") {
						rejectOnce(new Error("VOICE_WEBSOCKET_INVALID_MESSAGE"));
						return;
					}

					const message = JSON.parse(event.data) as ChatVoiceWsServerMessage;
					onEvent?.(message as RealtimeEvent);

					if (message.type === "error") {
						rejectOnce(
							new Error(
								message.code
									? `${message.code}: ${message.message}`
									: message.message,
							),
						);
						return;
					}

					if (message.type === "transcript.final") {
						userText = message.text;
						return;
					}

					if (message.type === "assistant.text.delta") {
						onAssistantTextDelta?.(message.delta);
						return;
					}

					if (message.type === "assistant.text.done") {
						responseTextDoneReceived = true;
						assistantText = message.text;
						return;
					}

					if (message.type === "assistant.char.timings") {
						onCharTimings?.(message.chars, message.startTimesMs);
						return;
					}

					if (message.type === "conversation.end_confirmed") {
						console.warn("[realtime] received conversation.end_confirmed");
						voiceEndConfirmed = true;
						return;
					}

					if (message.type === "assistant.audio.start") {
						expectingBinaryAssistantAudio = true;
						return;
					}

					if (message.type === "memory.game.start") {
						suppressSpeechFallback = true;
						return;
					}

					if (message.type === "conversation.end.requested") {
						conversationEndRequested = true;
						return;
					}

					if (message.type === "assistant.audio.done") {
						expectingBinaryAssistantAudio = false;
						if (audioWasStreamed) {
							audioStreamHandlers?.onAudioDone();
						}

						// Some backend branches intentionally end the turn without
						// creating/persisting a conversation, so `turn.done` never comes.
						if (conversationEndRequested || assistantText || userText) {
							finalizeWithoutTurnDoneTimer = window.setTimeout(() => {
								resolveWithCurrentPayload();
							}, WEBSOCKET_TURN_DONE_GRACE_MS);
						}
						return;
					}

					if (message.type !== "turn.done") {
						return;
					}

					retrievedMemories = message.retrieved_memories;
					allMemories = message.all_memories;
					llmUsage = message.llm_usage;
					recentSummaries = message.recent_summaries;
					resolveWithCurrentPayload(message.conversation_id);
				} catch (error) {
					rejectOnce(
						error instanceof Error
							? error
							: new Error("VOICE_WEBSOCKET_MESSAGE_HANDLING_FAILED"),
					);
				}
			};

			websocketState.socket.addEventListener("message", handleMessage);
			websocketState.socket.addEventListener("error", handleError);
			websocketState.socket.addEventListener("close", handleClose);

			sendWebSocketMessage(websocketState.socket, {
				type: "text.turn",
				text,
				conversation_id: conversationId,
				conversation,
			});
		},
	);
};

/**
 * Sends one recorded audio turn through the backend voice WebSocket and waits
 * for the full reply payload.
 */
const submitAudioTurnOverWebSocket = async (
	websocketState: RealtimeWebSocketState,
	audioChunks: Blob[],
	mimeType: ChatVoiceInputAudioMimeType,
	conversation: ChatConversationMessage[],
	onEvent?: (event: RealtimeEvent) => void,
	audioStreamHandlers?: RealtimeWebSocketAudioStreamHandlers,
	onCharTimings?: (chars: string[], startTimesMs: number[]) => void,
	onAssistantTextDelta?: (textDelta: string) => void,
): Promise<RealtimeWebSocketTextTurnResult> => {
	if (websocketState.socket.readyState !== WebSocket.OPEN) {
		throw new Error("VOICE_WEBSOCKET_NOT_OPEN");
	}

	return await new Promise<RealtimeWebSocketTextTurnResult>(
		(resolve, reject) => {
			let settled = false;
			let userText = "";
			let assistantText = "";
			let audioWasStreamed = false;
			let voiceEndConfirmed = false;
			let suppressSpeechFallback = false;
			let expectingBinaryAssistantAudio = false;
			const providerAudioChunks: Uint8Array[] = [];
			let finalizeWithoutTurnDoneTimer: number | null = null;
			let retrievedMemories: string[] | undefined;
			let allMemories: string[] | undefined;
			let llmUsage: ChatVoiceLlmUsage | undefined;
			let recentSummaries: RecentSummary[] | undefined;
			let conversationEndRequested = false;
			let responseTextDoneReceived = false;

			const cleanup = () => {
				if (finalizeWithoutTurnDoneTimer !== null) {
					window.clearTimeout(finalizeWithoutTurnDoneTimer);
					finalizeWithoutTurnDoneTimer = null;
				}
				websocketState.socket.removeEventListener("message", handleMessage);
				websocketState.socket.removeEventListener("error", handleError);
				websocketState.socket.removeEventListener("close", handleClose);
			};

			const rejectOnce = (error: Error) => {
				if (settled) {
					return;
				}

				settled = true;
				cleanup();
				reject(error);
			};

			const handleError = (_event: Event) => {
				rejectOnce(new Error("VOICE_WEBSOCKET_AUDIO_TURN_FAILED"));
			};

			const handleClose = (_event: CloseEvent) => {
				rejectOnce(new Error("VOICE_WEBSOCKET_CLOSED_DURING_AUDIO_TURN"));
			};

			const resolveWithCurrentPayload = (conversationId?: string) => {
				if (settled) {
					return;
				}

				settled = true;
				cleanup();

				const audioBlob =
					providerAudioChunks.length > 0
						? new Blob(providerAudioChunks, { type: "audio/mpeg" })
						: undefined;

				resolve({
					user_text: userText,
					assistant_text: assistantText,
					audio_blob: audioBlob,
					audio_was_streamed: audioWasStreamed,
					voice_end_confirmed: voiceEndConfirmed,
					suppress_speech_fallback: suppressSpeechFallback,
					conversation_id: conversationId,
					retrieved_memories: retrievedMemories,
					all_memories: allMemories,
					llm_usage: llmUsage,
					recent_summaries: recentSummaries,
				});
			};

			const handleMessage = async (event: MessageEvent) => {
				try {
					if (event.data instanceof ArrayBuffer || event.data instanceof Blob) {
						if (!expectingBinaryAssistantAudio) {
							rejectOnce(
								new Error("VOICE_WEBSOCKET_UNEXPECTED_BINARY_MESSAGE"),
							);
							return;
						}

						const binaryChunk =
							event.data instanceof ArrayBuffer
								? new Uint8Array(event.data)
								: new Uint8Array(await event.data.arrayBuffer());

						if (audioStreamHandlers) {
							audioWasStreamed = true;
							audioStreamHandlers.onAudioChunk(
								binaryChunk,
								responseTextDoneReceived ? "response" : "prelude",
							);
							return;
						}

						providerAudioChunks.push(binaryChunk);
						return;
					}

					if (typeof event.data !== "string") {
						rejectOnce(new Error("VOICE_WEBSOCKET_INVALID_MESSAGE"));
						return;
					}

					const message = JSON.parse(event.data) as ChatVoiceWsServerMessage;
					onEvent?.(message as RealtimeEvent);

					if (message.type === "error") {
						rejectOnce(
							new Error(
								message.code
									? `${message.code}: ${message.message}`
									: message.message,
							),
						);
						return;
					}

					if (message.type === "transcript.final") {
						userText = message.text;
						return;
					}

					if (message.type === "assistant.text.delta") {
						onAssistantTextDelta?.(message.delta);
						return;
					}

					if (message.type === "assistant.text.done") {
						responseTextDoneReceived = true;
						assistantText = message.text;
						return;
					}

					if (message.type === "assistant.char.timings") {
						onCharTimings?.(message.chars, message.startTimesMs);
						return;
					}

					if (message.type === "conversation.end_confirmed") {
						console.warn("[realtime] received conversation.end_confirmed");
						voiceEndConfirmed = true;
						return;
					}

					if (message.type === "assistant.audio.start") {
						expectingBinaryAssistantAudio = true;
						return;
					}

					if (message.type === "memory.game.start") {
						suppressSpeechFallback = true;
						return;
					}

					if (message.type === "conversation.end.requested") {
						conversationEndRequested = true;
						return;
					}

					if (message.type === "assistant.audio.done") {
						expectingBinaryAssistantAudio = false;
						if (audioWasStreamed) {
							audioStreamHandlers?.onAudioDone();
						}

						// Empty-transcript retry prompts do not always persist a
						// conversation, so this becomes the terminal frame.
						if (conversationEndRequested || assistantText || userText) {
							finalizeWithoutTurnDoneTimer = window.setTimeout(() => {
								resolveWithCurrentPayload();
							}, WEBSOCKET_TURN_DONE_GRACE_MS);
						}
						return;
					}

					if (message.type !== "turn.done") {
						return;
					}

					retrievedMemories = message.retrieved_memories;
					allMemories = message.all_memories;
					llmUsage = message.llm_usage;
					recentSummaries = message.recent_summaries;
					resolveWithCurrentPayload(message.conversation_id);
				} catch (error) {
					rejectOnce(
						error instanceof Error
							? error
							: new Error("VOICE_WEBSOCKET_MESSAGE_HANDLING_FAILED"),
					);
				}
			};

			websocketState.socket.addEventListener("message", handleMessage);
			websocketState.socket.addEventListener("error", handleError);
			websocketState.socket.addEventListener("close", handleClose);

			sendWebSocketMessage(websocketState.socket, {
				type: "audio.commit",
				conversation,
			});

			websocketAudioInputStarted = false;
		},
	);
};

/**
 * Closes the active conversation through the backend voice WebSocket and waits
 * for the server confirmation.
 */
const closeConversationOverWebSocket = async (
	websocketState: RealtimeWebSocketState,
	conversationId: string,
	onEvent?: (event: RealtimeEvent) => void,
	outcome?: SessionOutcome,
) => {
	if (websocketState.socket.readyState !== WebSocket.OPEN) {
		throw new Error("VOICE_WEBSOCKET_NOT_OPEN");
	}

	return await new Promise<void>((resolve, reject) => {
		let settled = false;

		const cleanup = () => {
			websocketState.socket.removeEventListener("message", handleMessage);
			websocketState.socket.removeEventListener("error", handleError);
			websocketState.socket.removeEventListener("close", handleClose);
		};

		const resolveOnce = () => {
			if (settled) {
				return;
			}

			settled = true;
			cleanup();
			resolve();
		};

		const rejectOnce = (error: Error) => {
			if (settled) {
				return;
			}

			settled = true;
			cleanup();
			reject(error);
		};

		const handleError = (_event: Event) => {
			rejectOnce(new Error("VOICE_WEBSOCKET_CLOSE_FAILED"));
		};

		const handleClose = (_event: CloseEvent) => {
			rejectOnce(new Error("VOICE_WEBSOCKET_CLOSED_DURING_CONVERSATION_CLOSE"));
		};

		const handleMessage = (event: MessageEvent) => {
			try {
				if (typeof event.data !== "string") {
					rejectOnce(new Error("VOICE_WEBSOCKET_INVALID_MESSAGE"));
					return;
				}

				const message = JSON.parse(event.data) as ChatVoiceWsServerMessage;
				onEvent?.(message as RealtimeEvent);

				if (message.type === "error") {
					rejectOnce(
						new Error(
							message.code
								? `${message.code}: ${message.message}`
								: message.message,
						),
					);
					return;
				}

				if (message.type !== "conversation.closed") {
					return;
				}

				if (message.conversation_id !== conversationId) {
					return;
				}

				resolveOnce();
			} catch (error) {
				rejectOnce(
					error instanceof Error
						? error
						: new Error("VOICE_WEBSOCKET_MESSAGE_HANDLING_FAILED"),
				);
			}
		};

		websocketState.socket.addEventListener("message", handleMessage);
		websocketState.socket.addEventListener("error", handleError);
		websocketState.socket.addEventListener("close", handleClose);

		sendWebSocketMessage(websocketState.socket, {
			type: "conversation.close",
			conversation_id: conversationId,
			...(outcome?.userOutcome && { user_outcome: outcome.userOutcome }),
			...(outcome?.userNote && { user_note: outcome.userNote }),
		});
	});
};

/**
 * Detects the best recording MIME type supported by the current browser.
 */
const getSupportedRecorderMimeType = () =>
	AUDIO_MIME_CANDIDATES.find((mimeType) =>
		typeof MediaRecorder !== "undefined" &&
		typeof MediaRecorder.isTypeSupported === "function"
			? MediaRecorder.isTypeSupported(mimeType)
			: mimeType === AUDIO_MIME_CANDIDATES[1],
	);

const normalizeRecorderMimeType = (
	mimeType?: string,
): ChatVoiceInputAudioMimeType =>
	AUDIO_MIME_CANDIDATES.find((candidate) => candidate === mimeType) ??
	AUDIO_MIME_CANDIDATES[1];

/**
 * Converts a recorded browser blob into base64 so it can be transported in JSON.
 */
const blobToBase64 = async (blob: Blob) => {
	const arrayBuffer = await blob.arrayBuffer();
	let binary = "";
	const bytes = new Uint8Array(arrayBuffer);

	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}

	return btoa(binary);
};

/**
 * Converts a synthesized base64 audio payload back into a Blob for playback.
 */
const base64ToBlob = (base64: string, mimeType?: string) => {
	const binary = atob(base64);
	const bytes = new Uint8Array(binary.length);

	for (let index = 0; index < binary.length; index += 1) {
		bytes[index] = binary.charCodeAt(index);
	}

	return new Blob([bytes], { type: mimeType || "audio/mpeg" });
};

/**
 * Computes a normalized RMS-like microphone level from the analyser time-domain data.
 */
const getAudioLevel = (pipeline: MediaPipeline) => {
	pipeline.analyser.getByteTimeDomainData(pipeline.sampleBuffer);

	let sum = 0;
	for (const sample of pipeline.sampleBuffer) {
		const normalized = (sample - 128) / 128;
		sum += normalized * normalized;
	}

	return Math.sqrt(sum / pipeline.sampleBuffer.length);
};

/**
 * Detects abort-like errors emitted by fetch or media playback cancellation paths.
 */
const isAbortError = (error: unknown) =>
	error instanceof DOMException
		? error.name === "AbortError"
		: error instanceof Error
			? error.name === "AbortError"
			: false;

/**
 * Synthesizes a local speech fallback when no provider audio is available.
 */
const speakFallback = async (text: string) => {
	if (typeof window === "undefined" || !("speechSynthesis" in window)) {
		return;
	}

	await new Promise<void>((resolve) => {
		try {
			window.speechSynthesis.cancel();
			const utterance = new SpeechSynthesisUtterance(text);
			utterance.lang = "pt-PT";
			utterance.onend = () => resolve();
			utterance.onerror = () => resolve();
			window.speechSynthesis.speak(utterance);
		} catch {
			resolve();
		}
	});
};

/**
 * Converts transcript text into safe console metadata without exposing the content itself.
 */
const toRedactedTranscriptLog = (text: string | null | undefined) => {
	// Treat whitespace-only values as empty so logs only reflect meaningful transcript content.
	const normalizedText = text?.trim() ?? "";

	return normalizedText.length > 0
		? { redacted: "[redacted]", chars: normalizedText.length }
		: { redacted: null, chars: 0 };
};

/**
 * Logs browser-side voice turn metadata in development without exposing transcript contents.
 */
const logRealtimeTurn = (
	direction: "outbound" | "inbound",
	payload: Record<string, unknown>,
) => {
	// Keep verbose turn diagnostics available locally without leaking them in production builds.
	if (!isRealtimeLoggingEnabled) {
		return;
	}

	console.info(`[realtime.turn] ${direction.toUpperCase()}`, payload);
};

/**
 * Builds a reusable voice-session controller backed by local recording and backend turn processing.
 */
export const startRealtimeVoiceSession = async (
	options: StartRealtimeVoiceSessionOptions = {},
): Promise<RealtimeVoiceController> => {
	let websocketState: RealtimeWebSocketState | null = null;
	let normalizedSession: ChatVoiceSessionConfig;

	try {
		websocketState = await connectVoiceWebSocket(
			options.session ?? {},
			options.onEvent,
		);
		normalizedSession = websocketState.session;
		options.onEvent?.({
			type: "session.ready",
			providers: websocketState.providers,
			audio_transport: websocketState.audioTransport,
		});
	} catch {
		const sessionResponse = await createVoiceSession(options.session);
		normalizedSession = sessionResponse.session;
		options.onEvent?.({
			type: "session.ready",
			providers: sessionResponse.providers,
			audio_transport: sessionResponse.audio_transport,
			notes: sessionResponse.notes,
		});
	}

	let mediaPipeline: MediaPipeline | null = null;
	let monitorFrame = 0;
	let activeRecorder: MediaRecorder | null = null;
	let discardRecording = false;
	let activeAudio: HTMLAudioElement | AudioBufferSourceNode | null = null;
	let pendingAbortController: AbortController | null = null;
	let resumeAfterAbort = false;
	let autoListenRequested = false;
	let destroyed = false;
	let listening = false;
	let thinking = false;
	let speaking = false;
	let processingTurn = false;
	let activeConversationId: string | undefined = undefined;
	let progressiveAudioPlayer: ProgressiveAudioPlayer | null = null;
	let activeLiveAudioUpload: ActiveLiveAudioUpload | null = null;
	const pcmPreRollBuffers: ArrayBuffer[] = [];
	let activeTurnGeneration = 0;
	const canceledTurnGenerations = new Set<number>();
	const conversationHistory: ChatConversationMessage[] = [];

	const emitRealtimeEvent = (event: RealtimeEvent) => {
		if (event.type === "conversation.end.requested") {
			autoListenRequested = false;
			resumeAfterAbort = false;
		}

		options.onEvent?.(event);
	};

	/**
	 * Synchronizes listening state updates so the UI only re-renders when necessary.
	 */
	const setListeningState = (nextValue: boolean) => {
		if (listening === nextValue) {
			return;
		}

		listening = nextValue;
		options.onListeningChange?.(nextValue);
	};

	/**
	 * Synchronizes thinking state updates so the UI can reflect network/LLM latency.
	 */
	const setThinkingState = (nextValue: boolean) => {
		if (thinking === nextValue) {
			return;
		}

		thinking = nextValue;
		options.onThinkingChange?.(nextValue);
	};

	/**
	 * Synchronizes speaking state updates while assistant audio is playing.
	 */
	const setSpeakingState = (nextValue: boolean) => {
		if (speaking === nextValue) {
			return;
		}

		speaking = nextValue;
		options.onSpeakingChange?.(nextValue);
	};

	/**
	 * Cancels any outstanding animation-frame monitor loop.
	 */
	const stopMonitoring = () => {
		if (monitorFrame) {
			window.cancelAnimationFrame(monitorFrame);
			monitorFrame = 0;
		}
	};

	/**
	 * Lazily acquires the microphone and analyser nodes used for local VAD.
	 */
	const ensureMediaPipeline = async () => {
		if (mediaPipeline) {
			return mediaPipeline;
		}

		if (
			typeof window === "undefined" ||
			typeof navigator === "undefined" ||
			!navigator.mediaDevices?.getUserMedia
		) {
			throw new Error("Browser audio capture is not available");
		}

		if (typeof MediaRecorder === "undefined") {
			throw new Error("MediaRecorder is not available in this browser");
		}

		const usesPcm = websocketState?.providers.asr === "elevenlabs";

		// Use the caller-provided AudioContext (created during user gesture on mobile) or make one.
		// When ASR is ElevenLabs, force 16 kHz so the PCM worklet outputs native 16 kHz samples.
		const audioContext =
			options.audioContext ??
			new AudioContext(usesPcm ? { sampleRate: 16000 } : undefined);
		// Resume if suspended — required on iOS when AudioContext was created before user gesture.
		if (audioContext.state === "suspended") {
			await audioContext.resume().catch(() => {});
		}
		const stream = await navigator.mediaDevices.getUserMedia({
			audio: {
				echoCancellation: true,
				noiseSuppression: true,
				autoGainControl: true,
				channelCount: 1,
			},
		});
		const source = audioContext.createMediaStreamSource(stream);
		const analyser = audioContext.createAnalyser();
		analyser.fftSize = 2048;
		source.connect(analyser);

		let pcmWorkletNode: AudioWorkletNode | undefined;
		if (usesPcm) {
			console.info(
				"[realtime] PCM capture — audioContext sampleRate=%d (target 16000)",
				audioContext.sampleRate,
			);
			await registerPcmWorklet(audioContext);
			pcmWorkletNode = new AudioWorkletNode(
				audioContext,
				"pcm-capture-processor",
			);
			source.connect(pcmWorkletNode);
		}

		mediaPipeline = {
			stream,
			audioContext,
			analyser,
			sampleBuffer: new Uint8Array(analyser.fftSize),
			mimeType: usesPcm
				? "audio/pcm;rate=16000"
				: getSupportedRecorderMimeType(),
			pcmWorkletNode,
		};

		return mediaPipeline;
	};

	/**
	 * Stops microphone recording or passive monitoring without tearing down the entire session.
	 */
	const pauseListeningLoop = (shouldDiscardRecording: boolean) => {
		stopMonitoring();
		setListeningState(false);

		if (!activeRecorder || activeRecorder.state === "inactive") {
			return;
		}

		discardRecording = shouldDiscardRecording;
		activeRecorder.stop();
	};

	/**
	 * Plays provider audio from a ready-made Blob and resolves only after
	 * playback finishes or fails.
	 */
	const playAssistantAudioBlob = async (audioBlob: Blob) => {
		const pipeline = mediaPipeline;

		if (pipeline) {
			const ctx = pipeline.audioContext;

			// Resume AudioContext if suspended (can happen after page visibility changes).
			if (ctx.state === "suspended") {
				await ctx.resume().catch(() => {});
			}

			const arrayBuffer = await audioBlob.arrayBuffer();

			let audioBuffer: AudioBuffer;
			try {
				audioBuffer = await ctx.decodeAudioData(arrayBuffer);
			} catch {
				// Unsupported format — fall through to HTML Audio fallback below.
				return playAssistantAudioBlobFallback(audioBlob);
			}

			const source = ctx.createBufferSource();
			source.buffer = audioBuffer;
			source.connect(ctx.destination);
			activeAudio = source;
			setSpeakingState(true);
			options.onAudioPlaybackStarted?.();
			options.onResponseAudioPlaybackStarted?.();

			try {
				await new Promise<void>((resolve, reject) => {
					source.onended = () => {
						// Distinguish a normal end from an external stop() call (cancellation).
						if (activeAudio === source) {
							resolve();
						} else {
							reject(new DOMException("Playback aborted", "AbortError"));
						}
					};
					source.start();
				});
			} finally {
				if (activeAudio === source) {
					activeAudio = null;
				}
				setSpeakingState(false);
			}
			return;
		}

		await playAssistantAudioBlobFallback(audioBlob);
	};

	/**
	 * Converts a base64 assistant payload into a Blob and reuses the shared
	 * playback path used by the WebSocket binary transport.
	 */
	const playAssistantAudio = async (audioBase64: string, mimeType?: string) => {
		await playAssistantAudioBlob(base64ToBlob(audioBase64, mimeType));
	};

	/**
	 * Falls back to an HTMLAudioElement when Web Audio decoding is unavailable.
	 */
	const playAssistantAudioBlobFallback = async (audioBlob: Blob) => {
		const audioUrl = URL.createObjectURL(audioBlob);
		const audio = new Audio(audioUrl);
		activeAudio = audio;
		audio.autoplay = true;

		setSpeakingState(true);
		options.onAudioPlaybackStarted?.();
		options.onResponseAudioPlaybackStarted?.();

		try {
			await new Promise<void>((resolve, reject) => {
				const cleanup = () => {
					audio.onended = null;
					audio.onerror = null;
					audio.onpause = null;
				};

				audio.onended = () => {
					cleanup();
					resolve();
				};
				audio.onerror = () => {
					cleanup();
					reject(new Error("Assistant audio playback failed"));
				};
				audio.onpause = () => {
					if (!audio.ended) {
						cleanup();
						reject(new DOMException("Playback aborted", "AbortError"));
					}
				};

				void audio.play().catch((error) => {
					cleanup();
					reject(error);
				});
			});
		} finally {
			if (activeAudio === audio) {
				activeAudio = null;
			}
			setSpeakingState(false);
			URL.revokeObjectURL(audioUrl);
		}
	};

	/**
	 * Starts or reuses one progressive Web Audio playback session for streamed
	 * assistant audio chunks coming from the voice WebSocket transport.
	 */
	const getOrCreateProgressiveAudioPlayer = () => {
		if (!ProgressiveAudioPlayer.isSupported()) {
			return null;
		}

		if (!progressiveAudioPlayer) {
			progressiveAudioPlayer = new ProgressiveAudioPlayer({
				audioContext: mediaPipeline?.audioContext,
			});
		}

		return progressiveAudioPlayer;
	};

	/**
	 * Stops any in-flight fetch or audio playback, optionally resuming passive listening afterwards.
	 */
	const cancelCurrentWork = (shouldResumeListening: boolean) => {
		resumeAfterAbort = shouldResumeListening;
		pendingAbortController?.abort();
		pendingAbortController = null;
		activeLiveAudioUpload = null;
		if (processingTurn) {
			canceledTurnGenerations.add(activeTurnGeneration);
		}

		if (websocketState && websocketState.socket.readyState === WebSocket.OPEN) {
			sendWebSocketMessage(websocketState.socket, {
				type: "response.cancel",
			});
		}

		if (progressiveAudioPlayer) {
			progressiveAudioPlayer.stop();
			progressiveAudioPlayer = null;
		}

		if (activeAudio) {
			const audio = activeAudio;
			activeAudio = null; // Null first so onended/onpause handlers detect cancellation.
			if (audio instanceof HTMLAudioElement) {
				audio.pause();
				audio.currentTime = 0;
			} else {
				try {
					audio.stop();
				} catch {
					/* already stopped */
				}
			}
		}

		if (typeof window !== "undefined" && "speechSynthesis" in window) {
			window.speechSynthesis.cancel();
		}

		setThinkingState(false);
		setSpeakingState(false);
	};

	/**
	 * Adds the latest user/assistant messages to the local conversation window kept in the browser.
	 */
	const appendConversationTurn = (userText: string, assistantText: string) => {
		const normalizedUserText = userText.trim();
		const normalizedAssistantText = assistantText.trim();

		// Keep only complete user/assistant exchanges so ASR retry prompts do not
		// pollute the history sent back to the LLM on the next turn.
		if (!normalizedUserText || !normalizedAssistantText) {
			return;
		}

		conversationHistory.push({ role: "user", content: normalizedUserText });
		conversationHistory.push({
			role: "assistant",
			content: normalizedAssistantText,
		});

		if (conversationHistory.length > 24) {
			conversationHistory.splice(0, conversationHistory.length - 24);
		}
	};

	/**
	 * Restarts passive microphone monitoring so the next spoken turn can be captured.
	 */
	const beginWaitingForSpeech = async () => {
		if (destroyed || !autoListenRequested || processingTurn || activeAudio) {
			return;
		}

		await ensureMediaPipeline();
		stopMonitoring();

		if (mediaPipeline?.pcmWorkletNode) {
			pcmPreRollBuffers.length = 0;
			mediaPipeline.pcmWorkletNode.port.onmessage = (
				event: MessageEvent<ArrayBuffer>,
			) => {
				if (event.data.byteLength === 0) return;
				pcmPreRollBuffers.push(event.data);
				if (pcmPreRollBuffers.length > PCM_PREROLL_CHUNKS) {
					pcmPreRollBuffers.splice(
						0,
						pcmPreRollBuffers.length - PCM_PREROLL_CHUNKS,
					);
				}
			};

			if (pcmPreRollBuffers.length < PCM_PREROLL_READY_CHUNKS) {
				await new Promise<void>((resolve) => {
					const startedAt = performance.now();
					const waitForPreRoll = () => {
						if (
							destroyed ||
							!autoListenRequested ||
							processingTurn ||
							activeRecorder ||
							activeAudio ||
							!mediaPipeline?.pcmWorkletNode ||
							pcmPreRollBuffers.length >= PCM_PREROLL_READY_CHUNKS ||
							performance.now() - startedAt >= PCM_PREROLL_READY_TIMEOUT_MS
						) {
							resolve();
							return;
						}

						monitorFrame = window.requestAnimationFrame(waitForPreRoll);
					};

					monitorFrame = window.requestAnimationFrame(waitForPreRoll);
				});
				stopMonitoring();
			}
		}

		if (
			destroyed ||
			!autoListenRequested ||
			processingTurn ||
			activeRecorder ||
			activeAudio ||
			!mediaPipeline
		) {
			return;
		}

		setListeningState(true);
		options.onEvent?.({ type: "input_audio_buffer.ready" });

		const threshold = normalizedSession.turn_detection?.threshold ?? 0.08;
		const waitForSpeech = () => {
			if (
				destroyed ||
				!autoListenRequested ||
				processingTurn ||
				activeRecorder ||
				activeAudio ||
				!mediaPipeline
			) {
				return;
			}

			if (getAudioLevel(mediaPipeline) >= threshold) {
				void startCapture();
				return;
			}

			monitorFrame = window.requestAnimationFrame(waitForSpeech);
		};

		monitorFrame = window.requestAnimationFrame(waitForSpeech);
	};

	/**
	 * Captures one spoken turn as raw PCM via AudioWorklet for ElevenLabs STT.
	 * Equivalent to the MediaRecorder path but produces Int16 PCM chunks.
	 */
	const startPcmCapture = async (pipeline: MediaPipeline) => {
		const workletNode = pipeline.pcmWorkletNode!;
		stopMonitoring();

		const preRollBuffers = pcmPreRollBuffers.splice(
			0,
			pcmPreRollBuffers.length,
		);
		const pcmChunkBuffers: ArrayBuffer[] = [...preRollBuffers];
		const pcmMimeType: ChatVoiceInputAudioMimeType = "audio/pcm;rate=16000";
		let pcmCapturing = true;

		const activeWebSocketState = websocketState;
		let uploadChain = Promise.resolve();
		let uploadError: Error | null = null;

		const threshold = normalizedSession.turn_detection?.threshold ?? 0.08;
		const silenceDurationMs =
			normalizedSession.turn_detection?.silence_duration_ms ?? 2500;
		const maxTurnDurationMs =
			normalizedSession.turn_detection?.max_turn_duration_ms ?? 15000;
		let silenceStartedAt: number | null = null;
		const captureStartedAt = performance.now();

		// Use a dummy MediaRecorder-shaped object so the rest of the state machine
		// (pauseListeningLoop, cancelCurrentWork) can call activeRecorder.stop().
		const pseudoRecorder = {
			state: "recording" as string,
			stop: () => {
				/* filled in below */
			},
		};

		discardRecording = false;
		options.onEvent?.({ type: "input_audio_buffer.speech_started" });

		if (
			!websocketAudioInputStarted &&
			activeWebSocketState?.socket.readyState === WebSocket.OPEN
		) {
			websocketAudioInputStarted = true;
			sendWebSocketMessage(activeWebSocketState.socket, {
				type: "audio.input.start",
				mime_type: pcmMimeType,
			});
			for (const preRollBuffer of preRollBuffers) {
				if (preRollBuffer.byteLength === 0) continue;
				try {
					activeWebSocketState.socket.send(preRollBuffer);
				} catch (error) {
					uploadError =
						error instanceof Error
							? error
							: new Error("VOICE_WEBSOCKET_PCM_PREROLL_UPLOAD_FAILED");
					break;
				}
			}
		}

		// Receive already-batched PCM samples from the worklet so the main thread
		// can forward them directly without one more merge step per flush.
		workletNode.port.onmessage = (event: MessageEvent<ArrayBuffer>) => {
			if (!pcmCapturing) return;
			if (event.data.byteLength === 0) return;

			pcmChunkBuffers.push(event.data);

			// Send synchronously to the WebSocket — WebSocket.send() is non-blocking
			// and internally buffers. Skipping the promise chain avoids allocating
			// a new microtask per 80ms chunk (~12 allocations/s).
			if (activeWebSocketState?.socket.readyState === WebSocket.OPEN) {
				try {
					activeWebSocketState.socket.send(event.data);
				} catch (error) {
					uploadError =
						error instanceof Error
							? error
							: new Error("VOICE_WEBSOCKET_PCM_CHUNK_UPLOAD_FAILED");
				}
			}
		};

		const stopPcm = () => {
			if (!pcmCapturing) return;
			pcmCapturing = false;
			pseudoRecorder.state = "inactive";
			workletNode.port.onmessage = null;
			activeRecorder = null;
			setListeningState(false);
			options.onEvent?.({ type: "input_audio_buffer.speech_stopped" });

			if (destroyed || discardRecording) {
				activeLiveAudioUpload = null;
				discardRecording = false;
				if (!processingTurn && autoListenRequested) {
					void beginWaitingForSpeech();
				}
				return;
			}

			const captureDurationMs = Math.max(
				0,
				Math.round(performance.now() - captureStartedAt),
			);

			// Create blobs only at end-of-turn to avoid per-chunk allocations
			// during capture (was ~12 Blob allocations/s while speaking).
			const totalBytes = pcmChunkBuffers.reduce(
				(acc, buf) => acc + buf.byteLength,
				0,
			);
			if (totalBytes === 0) {
				activeLiveAudioUpload = null;
				if (!processingTurn && autoListenRequested) {
					void beginWaitingForSpeech();
				}
				return;
			}

			const finalizeRecordedTurn = async () => {
				if (uploadError) throw uploadError;
				const pcmBlobs = pcmChunkBuffers.map((buf) => new Blob([buf]));
				await processAudioTurnWithWebSocket(
					pcmBlobs,
					pcmMimeType,
					captureDurationMs,
				);
			};

			activeLiveAudioUpload = null;

			void finalizeRecordedTurn().catch((error) => {
				if (!isAbortError(error)) {
					options.onError?.(error);
				}

				if (!destroyed && !isAbortError(error)) {
					options.onEvent?.({ type: "response.failed" });
				}

				processingTurn = false;
				setThinkingState(false);

				if (
					!destroyed &&
					autoListenRequested &&
					!activeAudio &&
					resumeAfterAbort
				) {
					void beginWaitingForSpeech();
				}
			});
		};

		pseudoRecorder.stop = stopPcm;
		activeRecorder = pseudoRecorder as unknown as MediaRecorder;

		// Silence / max-duration monitoring — same as MediaRecorder path.
		const monitorPcmCapture = () => {
			if (!mediaPipeline || destroyed || !pcmCapturing) {
				return;
			}

			if (getAudioLevel(mediaPipeline) >= threshold) {
				silenceStartedAt = null;
			} else {
				silenceStartedAt ??= performance.now();
				if (performance.now() - silenceStartedAt >= silenceDurationMs) {
					stopPcm();
					return;
				}
			}

			if (performance.now() - captureStartedAt >= maxTurnDurationMs) {
				options.onEvent?.({
					type: "input_audio_buffer.max_duration_reached",
					max_duration_ms: maxTurnDurationMs,
				});
				stopPcm();
				return;
			}

			monitorFrame = window.requestAnimationFrame(monitorPcmCapture);
		};

		monitorFrame = window.requestAnimationFrame(monitorPcmCapture);
	};

	/**
	 * Records one spoken turn after speech has been detected locally.
	 */
	const startCapture = async () => {
		const pipeline = await ensureMediaPipeline();
		if (destroyed || activeRecorder || processingTurn) {
			return;
		}

		// Use PCM capture via AudioWorklet when ElevenLabs STT is active.
		if (pipeline.pcmWorkletNode) {
			return startPcmCapture(pipeline);
		}

		stopMonitoring();

		const recorder = pipeline.mimeType
			? new MediaRecorder(pipeline.stream, { mimeType: pipeline.mimeType })
			: new MediaRecorder(pipeline.stream);
		const chunks: Blob[] = [];
		const liveUploadState: ActiveLiveAudioUpload | null =
			websocketState && websocketState.socket.readyState === WebSocket.OPEN
				? {
						chunks,
						mimeType: normalizeRecorderMimeType(
							recorder.mimeType || pipeline.mimeType,
						),
						uploadChain: Promise.resolve(),
						uploadError: null,
					}
				: null;
		activeLiveAudioUpload = liveUploadState;
		const threshold = normalizedSession.turn_detection?.threshold ?? 0.08;
		const silenceDurationMs =
			normalizedSession.turn_detection?.silence_duration_ms ?? 2500;
		const maxTurnDurationMs =
			normalizedSession.turn_detection?.max_turn_duration_ms ?? 15000;
		let silenceStartedAt: number | null = null;
		const captureStartedAt = performance.now();

		activeRecorder = recorder;
		discardRecording = false;
		options.onEvent?.({ type: "input_audio_buffer.speech_started" });

		recorder.ondataavailable = (event) => {
			if (event.data.size === 0) {
				return;
			}

			chunks.push(event.data);

			const activeWebSocketState = websocketState;

			if (!liveUploadState || !activeWebSocketState) {
				return;
			}

			const chunkToUpload = event.data;

			liveUploadState.uploadChain = liveUploadState.uploadChain
				.then(async () => {
					await sendAudioChunkOverWebSocket(
						activeWebSocketState,
						chunkToUpload,
						liveUploadState.mimeType,
					);
				})
				.catch((error) => {
					liveUploadState.uploadError =
						error instanceof Error
							? error
							: new Error("VOICE_WEBSOCKET_AUDIO_CHUNK_UPLOAD_FAILED");
				});
		};

		recorder.onstop = () => {
			activeRecorder = null;
			setListeningState(false);
			options.onEvent?.({ type: "input_audio_buffer.speech_stopped" });

			if (destroyed || discardRecording) {
				if (activeLiveAudioUpload === liveUploadState) {
					activeLiveAudioUpload = null;
				}

				discardRecording = false;
				if (!processingTurn && autoListenRequested) {
					void beginWaitingForSpeech();
				}
				return;
			}

			const blob = new Blob(chunks, {
				type: normalizeRecorderMimeType(recorder.mimeType || pipeline.mimeType),
			});
			const captureDurationMs = Math.max(
				0,
				Math.round(performance.now() - captureStartedAt),
			);
			if (blob.size === 0) {
				if (activeLiveAudioUpload === liveUploadState) {
					activeLiveAudioUpload = null;
				}

				if (!processingTurn && autoListenRequested) {
					void beginWaitingForSpeech();
				}
				return;
			}

			const finalizeRecordedTurn = async () => {
				if (liveUploadState) {
					await liveUploadState.uploadChain;

					if (liveUploadState.uploadError) {
						throw liveUploadState.uploadError;
					}
				}

				await processAudioTurnWithWebSocket(
					chunks,
					normalizeRecorderMimeType(recorder.mimeType || pipeline.mimeType),
					captureDurationMs,
				);
			};

			if (activeLiveAudioUpload === liveUploadState) {
				activeLiveAudioUpload = null;
			}

			void finalizeRecordedTurn().catch((error) => {
				if (!isAbortError(error)) {
					options.onError?.(error);
				}

				if (!destroyed && !isAbortError(error)) {
					options.onEvent?.({ type: "response.failed" });
				}

				processingTurn = false;
				setThinkingState(false);

				if (
					!destroyed &&
					autoListenRequested &&
					!activeAudio &&
					resumeAfterAbort
				) {
					void beginWaitingForSpeech();
				}
			});
		};

		recorder.start(250);

		const monitorCapture = () => {
			if (!mediaPipeline || destroyed || !activeRecorder) {
				return;
			}

			if (getAudioLevel(mediaPipeline) >= threshold) {
				silenceStartedAt = null;
			} else {
				silenceStartedAt ??= performance.now();
				if (performance.now() - silenceStartedAt >= silenceDurationMs) {
					recorder.stop();
					return;
				}
			}

			// Force-close very long turns so the browser cannot keep uploading
			// an ever-growing blob that later times out at the ASR provider.
			if (performance.now() - captureStartedAt >= maxTurnDurationMs) {
				options.onEvent?.({
					type: "input_audio_buffer.max_duration_reached",
					max_duration_ms: maxTurnDurationMs,
				});
				recorder.stop();
				return;
			}

			monitorFrame = window.requestAnimationFrame(monitorCapture);
		};

		monitorFrame = window.requestAnimationFrame(monitorCapture);
	};

	/**
	 * Sends one text or audio turn to the backend pipeline and handles the returned text/audio.
	 */
	const processTurn = async (
		input: {
			text?: string;
			audio_base64?: string;
			audio_mime_type?: ChatVoiceInputAudioMimeType;
			audio_language?: string;
		},
		audioBlob: Blob | null,
		emitUserTranscript: boolean,
		diagnostics: {
			audioDurationMs?: number;
		} = {},
	) => {
		if (destroyed) {
			return;
		}

		try {
			processingTurn = true;
			pauseListeningLoop(Boolean(audioBlob));
			setThinkingState(true);
			options.onEvent?.({ type: "response.created" });

			const audioBase64 = audioBlob ? await blobToBase64(audioBlob) : undefined;
			const abortController = new AbortController();
			pendingAbortController = abortController;
			resumeAfterAbort = autoListenRequested;
			const sanitizedConversation = conversationHistory.filter(
				(message) => message.content.trim().length > 0,
			);
			const outboundTextLog = toRedactedTranscriptLog(input.text);
			logRealtimeTurn("outbound", {
				text: outboundTextLog.redacted,
				text_chars: outboundTextLog.chars,
				audio_bytes: audioBlob?.size ?? 0,
				audio_duration_ms: diagnostics.audioDurationMs ?? 0,
				conversation_size: sanitizedConversation.length,
			});

			const result = await submitVoiceTurn({
				session: normalizedSession,
				// Re-sanitize the outbound history so one stale empty turn can never
				// invalidate the whole request at the backend schema boundary.
				conversation: sanitizedConversation,
				conversation_id: activeConversationId,
				input: {
					...input,
					audio_base64: audioBase64,
				},
				signal: abortController.signal,
			});

			if (result.conversation_id) {
				activeConversationId = result.conversation_id;
			}

			pendingAbortController = null;
			setThinkingState(false);
			const userTextLog = toRedactedTranscriptLog(result.user_text);
			const assistantTextLog = toRedactedTranscriptLog(result.assistant_text);
			logRealtimeTurn("inbound", {
				user_text: userTextLog.redacted,
				user_text_chars: userTextLog.chars,
				assistant_text: assistantTextLog.redacted,
				assistant_text_chars: assistantTextLog.chars,
				has_audio: Boolean(result.audio_base64),
			});

			if (emitUserTranscript) {
				options.onUserTranscript?.(result.user_text);
			}

			appendConversationTurn(result.user_text, result.assistant_text);
			options.onAssistantTranscriptDelta?.(result.assistant_text);
			options.onAssistantTranscriptDone?.(result.assistant_text);

			if (result.audio_base64) {
				await playAssistantAudio(result.audio_base64, result.audio_mime_type);
			} else {
				setSpeakingState(true);
				await speakFallback(result.assistant_text);
				setSpeakingState(false);
			}

			options.onEvent?.({ type: "response.done" });
		} catch (error) {
			if (!isAbortError(error)) {
				options.onError?.(error);
			}

			if (!destroyed && !isAbortError(error)) {
				options.onEvent?.({ type: "response.failed" });
			}
		} finally {
			pendingAbortController = null;
			processingTurn = false;
			setThinkingState(false);

			if (
				!destroyed &&
				autoListenRequested &&
				!activeAudio &&
				resumeAfterAbort
			) {
				void beginWaitingForSpeech();
			}
		}
	};

	/**
	 * Sends a text-only turn through WebSocket when available and falls back to
	 * the existing HTTP turn pipeline otherwise.
	 */
	const processTextTurnWithWebSocket = async (text: string) => {
		const activeWebSocketState = websocketState;

		if (
			!activeWebSocketState ||
			activeWebSocketState.socket.readyState !== WebSocket.OPEN
		) {
			await processTurn(
				{
					text,
					audio_language: normalizedSession.input_audio_transcription?.language,
				},
				null,
				false,
			);
			return;
		}

		try {
			const turnGeneration = ++activeTurnGeneration;
			const isCanceledTurn = () =>
				destroyed || canceledTurnGenerations.has(turnGeneration);
			processingTurn = true;
			pauseListeningLoop(true);
			setThinkingState(true);
			resumeAfterAbort = autoListenRequested;
			options.onEvent?.({ type: "response.created" });

			const sanitizedConversation = conversationHistory.filter(
				(message) => message.content.trim().length > 0,
			);
			const outboundTextLog = toRedactedTranscriptLog(text);

			logRealtimeTurn("outbound", {
				text: outboundTextLog.redacted,
				text_chars: outboundTextLog.chars,
				audio_bytes: 0,
				audio_duration_ms: 0,
				conversation_size: sanitizedConversation.length,
				transport: "websocket",
			});

			const progressivePlayer = getOrCreateProgressiveAudioPlayer();
			let progressivePlaybackChain = Promise.resolve();
			let progressivePlaybackPromise: Promise<void> | null = null;
			let receivedProgressiveAudio = false;
			let receivedAssistantTextDelta = false;
			let preludePlaybackEndNotified = false;
			let responsePlaybackStartNotified = false;
			let startedProgressivePlayback = false;

			const result = await submitTextTurnOverWebSocket(
				activeWebSocketState,
				text,
				activeConversationId,
				sanitizedConversation,
				(event) => {
					if (isCanceledTurn()) return;
					emitRealtimeEvent(event);
				},
				progressivePlayer
					? {
							onAudioChunk: (audioChunk, segment) => {
								if (isCanceledTurn()) {
									return;
								}
								if (!receivedProgressiveAudio) {
									receivedProgressiveAudio = true;
									progressivePlayer.playbackStartCallback = () => {
										startedProgressivePlayback = true;
										setSpeakingState(true);
										options.onAudioPlaybackStarted?.();
									};
								}

								progressivePlaybackChain = progressivePlaybackChain.then(() =>
									progressivePlayer.enqueueBinaryChunk(audioChunk, {
										onPlaybackStart:
											segment === "response"
												? () => {
														if (
															!isCanceledTurn() &&
															!responsePlaybackStartNotified
														) {
															responsePlaybackStartNotified = true;
															options.onResponseAudioPlaybackStarted?.();
														}
													}
												: undefined,
										onPlaybackEnd:
											segment === "prelude"
												? () => {
														if (
															!isCanceledTurn() &&
															!preludePlaybackEndNotified
														) {
															preludePlaybackEndNotified = true;
															options.onPreludeAudioPlaybackEnded?.();
														}
													}
												: undefined,
									}),
								);
							},

							onAudioDone: () => {
								if (isCanceledTurn()) {
									return;
								}
								progressivePlaybackPromise = progressivePlaybackChain
									.then(() => progressivePlayer.complete())
									.finally(() => {
										if (progressiveAudioPlayer === progressivePlayer) {
											progressiveAudioPlayer = null;
										}

										if (startedProgressivePlayback) {
											setSpeakingState(false);
										}
									});
							},
						}
					: undefined,
				(chars, startTimesMs) => {
					if (!isCanceledTurn()) {
						options.onCharTimings?.(chars, startTimesMs);
					}
				},
				(delta) => {
					if (isCanceledTurn()) return;
					receivedAssistantTextDelta = true;
					options.onAssistantTranscriptDelta?.(delta);
				},
			);

			if (isCanceledTurn()) {
				canceledTurnGenerations.delete(turnGeneration);
				return;
			}

			if (result.conversation_id) {
				activeConversationId = result.conversation_id;
			}

			setThinkingState(false);

			const userTextLog = toRedactedTranscriptLog(result.user_text);
			const assistantTextLog = toRedactedTranscriptLog(result.assistant_text);

			logRealtimeTurn("inbound", {
				user_text: userTextLog.redacted,
				user_text_chars: userTextLog.chars,
				assistant_text: assistantTextLog.redacted,
				assistant_text_chars: assistantTextLog.chars,
				has_audio: Boolean(result.audio_blob || result.audio_was_streamed),
				transport: "websocket",
			});

			appendConversationTurn(result.user_text, result.assistant_text);
			if (!receivedAssistantTextDelta) {
				options.onAssistantTranscriptDelta?.(result.assistant_text);
			}
			options.onAssistantTranscriptDone?.(result.assistant_text);
			if (
				result.retrieved_memories !== undefined ||
				result.all_memories !== undefined ||
				result.recent_summaries !== undefined
			) {
				options.onMemoriesUpdate?.({
					retrieved: result.retrieved_memories ?? [],
					all: result.all_memories ?? [],
					recentSummaries: result.recent_summaries ?? [],
				});
			}

			if (result.audio_was_streamed) {
				await (progressivePlaybackPromise ?? progressivePlaybackChain);
			} else if (result.audio_blob) {
				await playAssistantAudioBlob(result.audio_blob);
			} else if (!result.suppress_speech_fallback) {
				setSpeakingState(true);
				await speakFallback(result.assistant_text);
				setSpeakingState(false);
			}

			if (result.voice_end_confirmed) {
				console.warn(
					"[realtime] voice_end_confirmed in result, calling onVoiceEndConfirmed",
				);
				await options.onVoiceEndConfirmed?.();
			}

			options.onEvent?.({ type: "response.done" });
			canceledTurnGenerations.delete(turnGeneration);
		} catch (error) {
			if (activeWebSocketState.socket.readyState !== WebSocket.OPEN) {
				websocketState = null;
			}

			if (!isAbortError(error)) {
				options.onError?.(error);
			}

			if (!destroyed && !isAbortError(error)) {
				options.onEvent?.({ type: "response.failed" });
			}
		} finally {
			processingTurn = false;
			setThinkingState(false);

			if (
				!destroyed &&
				autoListenRequested &&
				!activeAudio &&
				resumeAfterAbort
			) {
				void beginWaitingForSpeech();
			}
		}
	};

	/**
	 * Sends one recorded audio turn through WebSocket when available and falls
	 * back to the existing HTTP turn pipeline otherwise.
	 */
	const processAudioTurnWithWebSocket = async (
		recordedChunks: Blob[],
		mimeType: ChatVoiceInputAudioMimeType,
		audioDurationMs: number,
	) => {
		const activeWebSocketState = websocketState;
		const audioBlob = new Blob(recordedChunks, { type: mimeType });

		if (
			!activeWebSocketState ||
			activeWebSocketState.socket.readyState !== WebSocket.OPEN
		) {
			await processTurn(
				{
					audio_mime_type: mimeType,
					audio_language: normalizedSession.input_audio_transcription?.language,
				},
				audioBlob,
				true,
				{
					audioDurationMs,
				},
			);
			return;
		}

		try {
			const turnGeneration = ++activeTurnGeneration;
			const isCanceledTurn = () =>
				destroyed || canceledTurnGenerations.has(turnGeneration);
			processingTurn = true;
			pauseListeningLoop(true);
			setThinkingState(true);
			resumeAfterAbort = autoListenRequested;
			options.onEvent?.({ type: "response.created" });

			const sanitizedConversation = conversationHistory.filter(
				(message) => message.content.trim().length > 0,
			);

			logRealtimeTurn("outbound", {
				text: null,
				text_chars: 0,
				audio_bytes: audioBlob.size,
				audio_duration_ms: audioDurationMs,
				conversation_size: sanitizedConversation.length,
				transport: "websocket",
			});

			const progressivePlayer = getOrCreateProgressiveAudioPlayer();
			let progressivePlaybackChain = Promise.resolve();
			let progressivePlaybackPromise: Promise<void> | null = null;
			let receivedProgressiveAudio = false;
			let receivedAssistantTextDelta = false;
			let preludePlaybackEndNotified = false;
			let responsePlaybackStartNotified = false;
			let startedProgressivePlayback = false;

			const result = await submitAudioTurnOverWebSocket(
				activeWebSocketState,
				recordedChunks,
				mimeType,
				sanitizedConversation,
				(event) => {
					if (isCanceledTurn()) return;
					emitRealtimeEvent(event);
				},
				progressivePlayer
					? {
							onAudioChunk: (audioChunk, segment) => {
								if (isCanceledTurn()) {
									return;
								}
								if (!receivedProgressiveAudio) {
									receivedProgressiveAudio = true;
									progressivePlayer.playbackStartCallback = () => {
										startedProgressivePlayback = true;
										setSpeakingState(true);
										options.onAudioPlaybackStarted?.();
									};
								}

								progressivePlaybackChain = progressivePlaybackChain.then(() =>
									progressivePlayer.enqueueBinaryChunk(audioChunk, {
										onPlaybackStart:
											segment === "response"
												? () => {
														if (
															!isCanceledTurn() &&
															!responsePlaybackStartNotified
														) {
															responsePlaybackStartNotified = true;
															options.onResponseAudioPlaybackStarted?.();
														}
													}
												: undefined,
										onPlaybackEnd:
											segment === "prelude"
												? () => {
														if (
															!isCanceledTurn() &&
															!preludePlaybackEndNotified
														) {
															preludePlaybackEndNotified = true;
															options.onPreludeAudioPlaybackEnded?.();
														}
													}
												: undefined,
									}),
								);
							},
							onAudioDone: () => {
								if (isCanceledTurn()) {
									return;
								}
								progressivePlaybackPromise = progressivePlaybackChain
									.then(() => progressivePlayer.complete())
									.finally(() => {
										if (progressiveAudioPlayer === progressivePlayer) {
											progressiveAudioPlayer = null;
										}

										if (startedProgressivePlayback) {
											setSpeakingState(false);
										}
									});
							},
						}
					: undefined,
				(chars, startTimesMs) => {
					if (!isCanceledTurn()) {
						options.onCharTimings?.(chars, startTimesMs);
					}
				},
				(delta) => {
					if (isCanceledTurn()) return;
					receivedAssistantTextDelta = true;
					options.onAssistantTranscriptDelta?.(delta);
				},
			);

			if (isCanceledTurn()) {
				canceledTurnGenerations.delete(turnGeneration);
				return;
			}

			if (result.conversation_id) {
				activeConversationId = result.conversation_id;
			}

			setThinkingState(false);

			const userTextLog = toRedactedTranscriptLog(result.user_text);
			const assistantTextLog = toRedactedTranscriptLog(result.assistant_text);

			logRealtimeTurn("inbound", {
				user_text: userTextLog.redacted,
				user_text_chars: userTextLog.chars,
				assistant_text: assistantTextLog.redacted,
				assistant_text_chars: assistantTextLog.chars,
				has_audio: Boolean(result.audio_blob || result.audio_was_streamed),
				transport: "websocket",
			});

			options.onUserTranscript?.(result.user_text);
			appendConversationTurn(result.user_text, result.assistant_text);
			if (!receivedAssistantTextDelta) {
				options.onAssistantTranscriptDelta?.(result.assistant_text);
			}
			options.onAssistantTranscriptDone?.(result.assistant_text);
			if (
				result.retrieved_memories !== undefined ||
				result.all_memories !== undefined ||
				result.recent_summaries !== undefined
			) {
				options.onMemoriesUpdate?.({
					retrieved: result.retrieved_memories ?? [],
					all: result.all_memories ?? [],
					recentSummaries: result.recent_summaries ?? [],
				});
			}

			if (result.audio_was_streamed) {
				await (progressivePlaybackPromise ?? progressivePlaybackChain);
			} else if (result.audio_blob) {
				await playAssistantAudioBlob(result.audio_blob);
			} else if (!result.suppress_speech_fallback) {
				setSpeakingState(true);
				await speakFallback(result.assistant_text);
				setSpeakingState(false);
			}

			if (result.voice_end_confirmed) {
				console.warn(
					"[realtime] voice_end_confirmed in result, calling onVoiceEndConfirmed",
				);
				await options.onVoiceEndConfirmed?.();
			}

			options.onEvent?.({ type: "response.done" });
			canceledTurnGenerations.delete(turnGeneration);
		} catch (error) {
			if (activeWebSocketState.socket.readyState !== WebSocket.OPEN) {
				websocketState = null;
			}

			if (!isAbortError(error)) {
				options.onError?.(error);
			}

			if (!destroyed && !isAbortError(error)) {
				options.onEvent?.({ type: "response.failed" });
			}
		} finally {
			processingTurn = false;
			setThinkingState(false);

			if (
				!destroyed &&
				autoListenRequested &&
				!activeAudio &&
				resumeAfterAbort
			) {
				void beginWaitingForSpeech();
			}
		}
	};

	/**
	 * Starts passive listening so the next user utterance is recorded automatically.
	 */
	const startListening = async () => {
		if (destroyed) {
			return;
		}

		autoListenRequested = true;
		resumeAfterAbort = true;
		await beginWaitingForSpeech();
	};

	/**
	 * Sends a direct text turn while keeping the same conversation history and response playback flow.
	 */
	const sendTextMessage = async (text: string) => {
		const trimmed = text.trim();
		if (!trimmed || destroyed) {
			return;
		}

		if (processingTurn || activeAudio) {
			if (normalizedSession.turn_detection?.interrupt_response === false) {
				return;
			}

			cancelCurrentWork(false);
		}

		await processTextTurnWithWebSocket(trimmed);
	};

	const noteMemoryGameOffer = (text: string) => {
		const trimmed = text.trim();
		if (!trimmed || destroyed) {
			return;
		}

		conversationHistory.push({ role: "assistant", content: trimmed });
		if (conversationHistory.length > 24) {
			conversationHistory.splice(0, conversationHistory.length - 24);
		}

		if (websocketState?.socket.readyState === WebSocket.OPEN) {
			sendWebSocketMessage(websocketState.socket, {
				type: "memory.game.offer",
				text: trimmed,
			});
		}
	};

	const noteMemoryGameCompleted = (assistantText: string) => {
		const trimmedAssistantText = assistantText.trim();
		if (!trimmedAssistantText || destroyed) {
			return;
		}

		conversationHistory.push({
			role: "assistant",
			content: trimmedAssistantText,
		});
		if (conversationHistory.length > 24) {
			conversationHistory.splice(0, conversationHistory.length - 24);
		}

		if (websocketState?.socket.readyState === WebSocket.OPEN) {
			sendWebSocketMessage(websocketState.socket, {
				type: "memory.game.completed",
				assistant_text: trimmedAssistantText,
			});
		}
	};

	const noteAssistantPrompt = (text: string) => {
		const trimmed = text.trim();
		if (!trimmed || destroyed) {
			return;
		}

		conversationHistory.push({ role: "assistant", content: trimmed });
		if (conversationHistory.length > 24) {
			conversationHistory.splice(0, conversationHistory.length - 24);
		}

		if (websocketState?.socket.readyState === WebSocket.OPEN) {
			sendWebSocketMessage(websocketState.socket, {
				type: "assistant.prompt",
				text: trimmed,
			});
		}
	};

	const playAssistantPrompt = async (
		audioBase64: string,
		mimeType?: "audio/mpeg" | "audio/wav",
	) => {
		if (!audioBase64 || destroyed) {
			return;
		}

		pauseListeningLoop(true);

		try {
			await playAssistantAudio(audioBase64, mimeType);
		} finally {
			if (!destroyed && autoListenRequested && !activeAudio) {
				void beginWaitingForSpeech();
			}
		}
	};

	/**
	 * Fully tears down the browser-side voice session and releases microphone resources.
	 * Returns a Promise that resolves once the conversation close request completes (or fails),
	 * so callers can await it before leaving the conversation screen.
	 */
	const stop = (outcome?: SessionOutcome): Promise<void> => {
		destroyed = true;
		autoListenRequested = false;
		resumeAfterAbort = false;
		websocketAudioInputStarted = false;
		pauseListeningLoop(true);
		cancelCurrentWork(false);

		if (mediaPipeline) {
			if (mediaPipeline.pcmWorkletNode) {
				mediaPipeline.pcmWorkletNode.port.onmessage = null;
			}
			pcmPreRollBuffers.length = 0;
			for (const track of mediaPipeline.stream.getTracks()) {
				track.stop();
			}
			void mediaPipeline.audioContext.close();
			mediaPipeline = null;
		}

		setListeningState(false);
		setThinkingState(false);
		setSpeakingState(false);

		const conversationIdToClose = activeConversationId;
		const activeWebSocketState = websocketState;

		activeConversationId = undefined;
		websocketState = null;

		const closeSocket = () => {
			if (
				activeWebSocketState &&
				(activeWebSocketState.socket.readyState === WebSocket.OPEN ||
					activeWebSocketState.socket.readyState === WebSocket.CONNECTING)
			) {
				activeWebSocketState.socket.close();
			}
		};

		closeSocket();

		if (conversationIdToClose) {
			return closeVoiceConversation(conversationIdToClose, outcome)
				.then(() => undefined)
				.catch(() => undefined);
		}

		return Promise.resolve();
	};

	/**
	 * Stops the current response but preserves the session so passive listening can resume immediately.
	 */
	const cancelResponse = () => {
		if (destroyed) {
			return;
		}

		cancelCurrentWork(autoListenRequested);
		processingTurn = false;
		if (autoListenRequested) {
			void beginWaitingForSpeech();
		}
	};

	const pauseMic = () => {
		autoListenRequested = false;
		resumeAfterAbort = false;
		pauseListeningLoop(true);
	};

	return {
		startListening,
		stop,
		cancelResponse,
		sendTextMessage,
		noteMemoryGameOffer,
		noteMemoryGameCompleted,
		noteAssistantPrompt,
		playAssistantPrompt,
		pauseMic,
		sendKeepalive: () => {
			if (websocketState?.socket.readyState === WebSocket.OPEN) {
				sendWebSocketMessage(websocketState.socket, { type: "keepalive" });
			}
		},
	};
};
