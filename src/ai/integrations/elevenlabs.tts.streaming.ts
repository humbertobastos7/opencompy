import { WebSocket } from "ws";
import { env } from "@/env/ai";

type OpenTtsStreamingSessionOptions = {
	languageCode?: string;
};

// Note: the stream-input WebSocket endpoint only accepts low-latency models
// (flash/turbo family). eleven_v3 returns 403 there — keep
// ELEVENLABS_STREAMING_MODEL_ID on a streaming-capable model.

export type ElevenLabsTtsAlignmentChunk = {
	/** Characters spoken in this chunk (original input text). */
	chars: string[];
	/** Start time of each character in ms, relative to the start of the full utterance. */
	charStartTimesMs: number[];
};

export type ElevenLabsTtsStreamingSession = {
	/** Pushes an incremental text chunk. Trailing whitespace is recommended between sentences. */
	sendText: (text: string) => void;
	/** Asks ElevenLabs to generate buffered text immediately without closing the session. */
	flush: () => void;
	/** Signals end of input — ElevenLabs flushes remaining audio then closes. */
	finish: () => void;
	/** Continuous MP3 stream for the full utterance (no inter-sentence gaps). */
	audio: ReadableStream<Uint8Array>;
	/** Alignment chunks — character-level timings emitted alongside each audio chunk. */
	alignment: ReadableStream<ElevenLabsTtsAlignmentChunk>;
	/** Force-close the session (cleanup on errors). */
	close: () => void;
};

const getDefaultVoiceId = () => env.ELEVENLABS_VOICE_ID_DEFAULT?.trim();

const getVoiceSettings = () => ({
	stability: env.ELEVENLABS_STABILITY,
	similarity_boost: env.ELEVENLABS_SIMILARITY_BOOST,
});

/**
 * Opens one ElevenLabs realtime TTS WebSocket session. Text is fed
 * incrementally via sendText(); audio streams back as a single continuous
 * MP3 so there are no gaps or encoder-delay artefacts between sentences.
 * Alignment data (character-level timings) is streamed in parallel when
 * available. Call finish() when the text input is complete.
 */
export const openElevenLabsTtsStreamingSession = async (
	options: OpenTtsStreamingSessionOptions = {},
): Promise<ElevenLabsTtsStreamingSession> => {
	if (!env.ELEVENLABS_API_KEY) {
		throw new Error("ELEVENLABS_API_KEY is required for TTS streaming");
	}
	const voiceId = getDefaultVoiceId();
	if (!voiceId) {
		throw new Error("ELEVENLABS_VOICE_ID_DEFAULT is required");
	}

	const baseUrl = new URL(env.ELEVENLABS_BASE_URL.replace(/\/+$/, ""));
	const url = new URL(
		`/v1/text-to-speech/${encodeURIComponent(voiceId)}/stream-input`,
		baseUrl,
	);
	url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
	url.searchParams.set("model_id", env.ELEVENLABS_STREAMING_MODEL_ID);
	url.searchParams.set("output_format", env.ELEVENLABS_OUTPUT_FORMAT);
	url.searchParams.set("auto_mode", "true");
	// Request character-level alignment data alongside audio chunks so the
	// frontend can render subtitles in sync with the voice.
	url.searchParams.set("sync_alignment", "true");
	if (options.languageCode) {
		url.searchParams.set("language_code", options.languageCode);
	}

	const socket = new WebSocket(url, [], {
		headers: { "xi-api-key": env.ELEVENLABS_API_KEY },
	});

	let audioController: ReadableStreamDefaultController<Uint8Array> | null =
		null;
	const audio = new ReadableStream<Uint8Array>({
		start(controller) {
			audioController = controller;
		},
	});

	let alignmentController: ReadableStreamDefaultController<ElevenLabsTtsAlignmentChunk> | null =
		null;
	const alignment = new ReadableStream<ElevenLabsTtsAlignmentChunk>({
		start(controller) {
			alignmentController = controller;
		},
	});

	let finished = false;
	let closed = false;

	const safeClose = () => {
		if (closed) return;
		closed = true;
		try {
			if (
				socket.readyState === WebSocket.OPEN ||
				socket.readyState === WebSocket.CONNECTING
			) {
				socket.close();
			}
		} catch {
			// ignore — socket already closing
		}
		try {
			audioController?.close();
		} catch {
			// ignore — controller already closed
		}
		try {
			alignmentController?.close();
		} catch {
			// ignore — controller already closed
		}
	};

	socket.on("message", (raw) => {
		try {
			const rawText = Array.isArray(raw)
				? Buffer.concat(raw).toString("utf8")
				: raw instanceof ArrayBuffer
					? Buffer.from(new Uint8Array(raw)).toString("utf8")
					: raw.toString();
			const message = JSON.parse(rawText) as {
				audio?: string | null;
				isFinal?: boolean | null;
				error?: string;
				message?: string;
				alignment?: {
					chars?: string[];
					charStartTimesMs?: number[];
					charDurationsMs?: number[];
				} | null;
				normalizedAlignment?: {
					chars?: string[];
					charStartTimesMs?: number[];
					charDurationsMs?: number[];
				} | null;
			};

			if (message.error) {
				const err = new Error(
					`ELEVENLABS_TTS_STREAM_ERROR: ${message.error}${message.message ? `: ${message.message}` : ""}`,
				);
				audioController?.error(err);
				alignmentController?.error(err);
				safeClose();
				return;
			}

			if (message.audio) {
				const chunk = Buffer.from(message.audio, "base64");
				audioController?.enqueue(new Uint8Array(chunk));
			}

			// Prefer the alignment over normalizedAlignment — alignment maps back
			// to the original input text, which matches what the UI is rendering.
			const alignmentPayload = message.alignment ?? message.normalizedAlignment;
			if (
				alignmentPayload?.chars?.length &&
				alignmentPayload?.charStartTimesMs?.length
			) {
				alignmentController?.enqueue({
					chars: alignmentPayload.chars,
					charStartTimesMs: alignmentPayload.charStartTimesMs,
				});
			}

			if (message.isFinal) {
				safeClose();
			}
		} catch (err) {
			const wrapped =
				err instanceof Error ? err : new Error("ELEVENLABS_TTS_PARSE_FAILED");
			audioController?.error(wrapped);
			alignmentController?.error(wrapped);
			safeClose();
		}
	});

	socket.on("error", (err) => {
		const wrapped =
			err instanceof Error ? err : new Error("ELEVENLABS_TTS_SOCKET_ERROR");
		audioController?.error(wrapped);
		alignmentController?.error(wrapped);
		safeClose();
	});

	socket.on("close", () => {
		if (!closed) {
			safeClose();
		}
	});

	return await new Promise<ElevenLabsTtsStreamingSession>((resolve, reject) => {
		socket.once("open", () => {
			try {
				// BOS message — starts the generation with voice settings.
				socket.send(
					JSON.stringify({
						text: " ",
						voice_settings: getVoiceSettings(),
					}),
				);

				resolve({
					sendText: (text: string) => {
						if (finished || socket.readyState !== WebSocket.OPEN) return;
						socket.send(JSON.stringify({ text }));
					},
					flush: () => {
						if (finished || socket.readyState !== WebSocket.OPEN) return;
						socket.send(
							JSON.stringify({
								text: " ",
								flush: true,
								try_trigger_generation: true,
							}),
						);
					},
					finish: () => {
						if (finished) return;
						finished = true;
						if (socket.readyState !== WebSocket.OPEN) return;
						// Empty string signals flush + close.
						socket.send(JSON.stringify({ text: "" }));
					},
					audio,
					alignment,
					close: () => safeClose(),
				});
			} catch (err) {
				reject(
					err instanceof Error ? err : new Error("ELEVENLABS_TTS_INIT_FAILED"),
				);
				safeClose();
			}
		});

		socket.once("error", (err) => {
			reject(
				err instanceof Error
					? err
					: new Error("ELEVENLABS_TTS_SOCKET_INIT_ERROR"),
			);
		});
	});
};
