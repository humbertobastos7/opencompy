import { env } from "@/env/ai";
import { normalizeSpeechLanguage } from "@/shared/speech-language";

const ELEVENLABS_STT_RETRYABLE_STATUS_CODES = new Set([
	408, 429, 500, 502, 503, 504,
]);
const MAX_RETRY_ATTEMPTS = 2;
const RETRY_DELAY_MS = 400;

type ElevenLabsSttResponse = {
	text?: string;
	language_code?: string;
};

const sleep = (delayMs: number) =>
	new Promise((resolve) => setTimeout(resolve, delayMs));

const shouldRetry = (status: number) =>
	ELEVENLABS_STT_RETRYABLE_STATUS_CODES.has(status);

const isRetryableTransportError = (error: unknown): error is Error =>
	error instanceof Error &&
	(error.name === "AbortError" ||
		error.message.toLowerCase().includes("fetch failed"));

/**
 * Sends captured audio to ElevenLabs batch STT and returns the best transcript.
 */
export const transcribeAudioWithElevenLabs = async (input: {
	audioBuffer: Uint8Array;
	mimeType?: string;
	language?: string;
}): Promise<string> => {
	if (!env.ELEVENLABS_API_KEY) {
		throw new Error("ELEVENLABS_API_KEY is required for STT");
	}

	const resolvedMimeType = input.mimeType || "audio/webm";
	const extension = resolvedMimeType.includes("pcm") ? "pcm" : "webm";

	for (
		let attemptIndex = 0;
		attemptIndex <= MAX_RETRY_ATTEMPTS;
		attemptIndex += 1
	) {
		try {
			const formData = new FormData();
			formData.append(
				"file",
				new File([input.audioBuffer], `audio.${extension}`, {
					type: resolvedMimeType,
				}),
			);
			formData.append("model_id", env.ELEVENLABS_STT_BATCH_MODEL_ID);

			// ElevenLabs expects a bare ISO 639-1 code (e.g. "pt"), not a locale like "pt-PT".
			const normalizedLanguage = normalizeSpeechLanguage(input.language);
			const baseLanguage = normalizedLanguage?.split("-")[0];
			if (baseLanguage) {
				formData.append("language_code", baseLanguage);
			}

			const baseUrl = env.ELEVENLABS_BASE_URL.replace(/\/+$/, "");
			const response = await fetch(`${baseUrl}/v1/speech-to-text`, {
				method: "POST",
				headers: {
					"xi-api-key": env.ELEVENLABS_API_KEY!,
				},
				body: formData,
			});

			const raw = await response.text();
			if (!response.ok) {
				if (attemptIndex < MAX_RETRY_ATTEMPTS && shouldRetry(response.status)) {
					console.warn("[elevenlabs.stt] RETRYING_TRANSCRIPTION", {
						attempt: attemptIndex + 1,
						status: response.status,
						audioBytes: input.audioBuffer.byteLength,
					});
					await sleep(RETRY_DELAY_MS * (attemptIndex + 1));
					continue;
				}

				throw new Error(
					`ELEVENLABS_STT_FAILED (${response.status}): ${raw || response.statusText}`,
				);
			}

			let parsed: ElevenLabsSttResponse;
			try {
				parsed = JSON.parse(raw) as ElevenLabsSttResponse;
			} catch {
				throw new Error("ELEVENLABS_STT_INVALID_JSON_RESPONSE");
			}

			const transcript = parsed.text?.trim() ?? "";
			if (!transcript) {
				throw new Error("ELEVENLABS_STT_EMPTY_TRANSCRIPT");
			}

			return transcript;
		} catch (error) {
			if (
				attemptIndex < MAX_RETRY_ATTEMPTS &&
				isRetryableTransportError(error)
			) {
				console.warn("[elevenlabs.stt] RETRYING_TRANSCRIPTION", {
					attempt: attemptIndex + 1,
					audioBytes: input.audioBuffer.byteLength,
					error: error.message,
				});
				await sleep(RETRY_DELAY_MS * (attemptIndex + 1));
				continue;
			}

			throw error;
		}
	}

	throw new Error("ELEVENLABS_STT_FAILED (0): retry loop exhausted");
};
