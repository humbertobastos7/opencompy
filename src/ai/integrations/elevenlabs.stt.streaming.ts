import { env } from "@/env/ai";
import { normalizeSpeechLanguage } from "@/shared/speech-language";
import WebSocket from "ws";

/**
 * Message types received from the ElevenLabs realtime STT WebSocket.
 */
type ElevenLabsSttMessage = {
	message_type?: string;
	text?: string;
	session_id?: string;
	error?: string;
	language_code?: string;
	words?: Array<{
		text?: string;
		logprob?: number;
		type?: string;
	}>;
};

export type ElevenLabsSttStreamingTranscriptEvent =
	| {
			type: "transcript.interim";
			text: string;
	  }
	| {
			type: "transcript.final";
			text: string;
	  };

export type ElevenLabsSttStreamingSession = {
	sendAudioChunk: (chunk: Uint8Array) => void;
	close: () => Promise<string>;
	getFinalTranscript: () => string;
};

type OpenElevenLabsSttStreamingSessionOptions = {
	language?: string;
	previousText?: string;
	keyterms?: string[];
	onTranscript: (event: ElevenLabsSttStreamingTranscriptEvent) => void;
};

const ELEVENLABS_CLOSE_TIMEOUT_MS = 2_000;
const ELEVENLABS_COMMIT_SETTLE_MS = 80;

/**
 * Builds the ElevenLabs realtime STT WebSocket URL with the configured model and audio format.
 */
const normalizeKeyterms = (keyterms?: string[]) => {
	const seen = new Set<string>();
	const normalized: string[] = [];

	for (const rawTerm of keyterms ?? []) {
		const term = rawTerm.trim().replace(/\s+/g, " ");
		if (!term || term.length > 20) {
			continue;
		}

		const key = term.toLocaleLowerCase("pt-PT");
		if (seen.has(key)) {
			continue;
		}

		seen.add(key);
		normalized.push(term);

		if (normalized.length >= 50) {
			break;
		}
	}

	return normalized;
};

const normalizePreviousText = (previousText?: string) => {
	const normalized = previousText?.trim().replace(/\s+/g, " ");
	if (!normalized) {
		return undefined;
	}

	return normalized.length <= 50 ? normalized : normalized.slice(-50);
};

const buildElevenLabsSttStreamingUrl = (
	language?: string,
	keyterms?: string[],
) => {
	const baseUrl = new URL(env.ELEVENLABS_BASE_URL.replace(/\/+$/, ""));
	baseUrl.pathname = "/v1/speech-to-text/realtime";
	baseUrl.protocol = baseUrl.protocol === "https:" ? "wss:" : "ws:";

	baseUrl.searchParams.set("model_id", env.ELEVENLABS_STT_REALTIME_MODEL_ID);
	baseUrl.searchParams.set("audio_format", "pcm_16000");
	baseUrl.searchParams.set("commit_strategy", "vad");
	baseUrl.searchParams.set("include_timestamps", "true");
	baseUrl.searchParams.set("include_language_detection", "true");
	baseUrl.searchParams.set("no_verbatim", "true");
	baseUrl.searchParams.set("vad_silence_threshold_secs", "1.2");
	baseUrl.searchParams.set("vad_threshold", "0.4");
	baseUrl.searchParams.set("min_speech_duration_ms", "100");
	baseUrl.searchParams.set("min_silence_duration_ms", "100");

	// ElevenLabs expects a bare ISO 639-1 code (e.g. "pt"), not a locale like "pt-PT".
	const normalizedLanguage = normalizeSpeechLanguage(language);
	const baseLanguage = normalizedLanguage?.split("-")[0];
	if (baseLanguage) {
		baseUrl.searchParams.set("language_code", baseLanguage);
	}

	for (const keyterm of normalizeKeyterms(keyterms)) {
		baseUrl.searchParams.append("keyterms", keyterm);
	}

	return baseUrl;
};

/**
 * Opens one ElevenLabs realtime STT session and keeps track of the final
 * transcript segments until the stream is explicitly closed.
 */
const BOOTSTRAP_RETRY_DELAYS_MS = [500, 1500];

const openElevenLabsSttStreamingSessionOnce = async (
	options: OpenElevenLabsSttStreamingSessionOptions,
): Promise<ElevenLabsSttStreamingSession> => {
	if (!env.ELEVENLABS_API_KEY) {
		throw new Error("ELEVENLABS_API_KEY is required for STT");
	}

	const streamingUrl = buildElevenLabsSttStreamingUrl(
		options.language,
		options.keyterms,
	);
	const previousText = normalizePreviousText(options.previousText);

	return await new Promise<ElevenLabsSttStreamingSession>((resolve, reject) => {
		const socket = new WebSocket(streamingUrl, [], {
			headers: {
				"xi-api-key": env.ELEVENLABS_API_KEY!,
			},
		});

		let settled = false;
		const committedTranscripts: string[] = [];
		let lastPartialTranscript = "";
		let lastCommittedTranscript = "";
		let hasSentAudioChunk = false;
		let closingPromise: Promise<string> | null = null;
		let finishCloseSoon: (() => void) | null = null;

		const getFinalTranscript = () => {
			const committedTranscript = committedTranscripts.join(" ").trim();
			return committedTranscript || lastPartialTranscript.trim();
		};

		const rejectOnce = (error: Error) => {
			if (settled) {
				return;
			}

			settled = true;

			if (
				socket.readyState === WebSocket.OPEN ||
				socket.readyState === WebSocket.CONNECTING
			) {
				socket.close();
			}

			reject(error);
		};

		socket.on("message", (raw) => {
			try {
				const rawText = Array.isArray(raw)
					? Buffer.concat(raw).toString("utf8")
					: raw instanceof ArrayBuffer
						? Buffer.from(new Uint8Array(raw)).toString("utf8")
						: raw.toString();

				const message = JSON.parse(rawText) as ElevenLabsSttMessage;

				if (message.message_type === "session_started") {
					if (settled) {
						return;
					}
					settled = true;

					resolve({
						sendAudioChunk: (chunk: Uint8Array) => {
							if (socket.readyState !== WebSocket.OPEN) {
								throw new Error("ELEVENLABS_STT_SOCKET_NOT_OPEN");
							}

							const payload: {
								message_type: "input_audio_chunk";
								audio_base_64: string;
								previous_text?: string;
							} = {
								message_type: "input_audio_chunk",
								audio_base_64: Buffer.from(chunk).toString("base64"),
							};

							if (!hasSentAudioChunk && previousText) {
								payload.previous_text = previousText;
							}
							hasSentAudioChunk = true;

							socket.send(JSON.stringify(payload));
						},
						close: async () => {
							if (closingPromise) {
								return await closingPromise;
							}

							closingPromise = new Promise<string>((resolveClose) => {
								let closeSettled = false;
								let closeTimer: ReturnType<typeof setTimeout> | undefined;
								let commitSettleTimer:
									| ReturnType<typeof setTimeout>
									| undefined;

								const finishClose = () => {
									if (closeSettled) {
										return;
									}

									closeSettled = true;

									if (closeTimer) {
										clearTimeout(closeTimer);
									}
									if (commitSettleTimer) {
										clearTimeout(commitSettleTimer);
									}

									finishCloseSoon = null;

									socket.off("close", handleClose);
									socket.off("error", handleError);
									resolveClose(getFinalTranscript());
								};

								const handleClose = () => {
									finishClose();
								};

								const handleError = () => {
									finishClose();
								};

								const scheduleCloseFromCommittedTranscript = () => {
									if (closeSettled) {
										return;
									}

									if (commitSettleTimer) {
										clearTimeout(commitSettleTimer);
									}

									commitSettleTimer = setTimeout(() => {
										if (
											socket.readyState === WebSocket.OPEN ||
											socket.readyState === WebSocket.CONNECTING
										) {
											socket.close();
										}

										finishClose();
									}, ELEVENLABS_COMMIT_SETTLE_MS);
								};

								socket.once("close", handleClose);
								socket.once("error", handleError);
								finishCloseSoon = scheduleCloseFromCommittedTranscript;

								// Send a final commit to flush the in-flight utterance.
								if (socket.readyState === WebSocket.OPEN) {
									socket.send(
										JSON.stringify({
											message_type: "input_audio_chunk",
											audio_base_64: "",
											commit: true,
										}),
									);
								} else {
									finishClose();
									return;
								}

								closeTimer = setTimeout(() => {
									if (
										socket.readyState === WebSocket.OPEN ||
										socket.readyState === WebSocket.CONNECTING
									) {
										socket.close();
									}

									finishClose();
								}, ELEVENLABS_CLOSE_TIMEOUT_MS);
							});

							return await closingPromise;
						},
						getFinalTranscript,
					});
					return;
				}

				if (
					message.message_type === "error" ||
					message.message_type === "auth_error"
				) {
					const errorText = message.error || message.message_type;
					if (!settled) {
						rejectOnce(new Error(`ELEVENLABS_STT_ERROR: ${errorText}`));
					} else {
						console.warn("[elevenlabs.stt.streaming] ERROR", errorText);
					}
					return;
				}

				if (message.message_type === "partial_transcript") {
					const text = message.text?.trim() ?? "";
					if (!text) {
						return;
					}

					lastPartialTranscript = text;

					options.onTranscript({
						type: "transcript.interim",
						text,
					});
					return;
				}

				if (message.message_type === "committed_transcript") {
					const text = message.text?.trim() ?? "";
					if (!text) {
						return;
					}

					console.info(`🗣️  [UTILIZADOR] "${text}"`);
					committedTranscripts.push(text);
					lastCommittedTranscript = text;
					lastPartialTranscript = "";
					finishCloseSoon?.();

					options.onTranscript({
						type: "transcript.final",
						text,
					});
					return;
				}

				if (message.message_type === "committed_transcript_with_timestamps") {
					const text = message.text?.trim() ?? "";
					if (!text || text === lastCommittedTranscript) {
						return;
					}

					console.info(`🗣️  [UTILIZADOR] "${text}"`);
					committedTranscripts.push(text);
					lastCommittedTranscript = text;
					lastPartialTranscript = "";
					finishCloseSoon?.();

					options.onTranscript({
						type: "transcript.final",
						text,
					});
				}
			} catch {
				// Ignore non-JSON frames without tearing down the stream.
			}
		});

		socket.once("error", (error: Error) => {
			rejectOnce(error);
		});

		socket.once("close", (code: number, reason: Buffer) => {
			const reasonStr = reason?.length ? reason.toString() : "no reason";
			rejectOnce(
				new Error(
					`ELEVENLABS_STT_CLOSED_DURING_BOOTSTRAP: code=${code} ${reasonStr}`,
				),
			);
		});
	});
};

export const openElevenLabsSttStreamingSession = async (
	options: OpenElevenLabsSttStreamingSessionOptions,
): Promise<ElevenLabsSttStreamingSession> => {
	let lastError: Error = new Error("ELEVENLABS_STT_OPEN_FAILED");

	for (
		let attempt = 0;
		attempt <= BOOTSTRAP_RETRY_DELAYS_MS.length;
		attempt++
	) {
		if (attempt > 0) {
			await new Promise<void>((res) =>
				setTimeout(res, BOOTSTRAP_RETRY_DELAYS_MS[attempt - 1]),
			);
		}

		try {
			return await openElevenLabsSttStreamingSessionOnce(options);
		} catch (err) {
			lastError = err instanceof Error ? err : new Error(String(err));

			// Auth/policy rejections won't be fixed by retrying.
			if (
				lastError.message.includes("ELEVENLABS_API_KEY") ||
				lastError.message.includes("ELEVENLABS_STT_ERROR")
			) {
				throw lastError;
			}

			console.warn(
				`[elevenlabs.stt.streaming] BOOTSTRAP_FAILED attempt=${attempt + 1}`,
				lastError.message,
			);
		}
	}

	throw lastError;
};
