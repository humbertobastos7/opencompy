import { env } from "@/env/backend";

/**
 * Sends audio to ElevenLabs batch STT and returns the transcript.
 * Returns undefined if the API key is not configured or the transcript is empty.
 * Never throws — failures are silent so the voice turn can still proceed.
 */
export async function preTranscribeAudioWithElevenLabs(input: {
	audioBuffer: Buffer;
	mimeType?: string;
	language?: string;
}): Promise<string | undefined> {
	if (!env.ELEVENLABS_API_KEY) {
		return undefined;
	}

	try {
		const baseUrl = env.ELEVENLABS_BASE_URL.replace(/\/+$/, "");
		const resolvedMimeType = input.mimeType || "audio/webm";
		const extension = resolvedMimeType.includes("pcm") ? "pcm" : "webm";

		const formData = new FormData();
		formData.append(
			"file",
			new File([input.audioBuffer], `audio.${extension}`, {
				type: resolvedMimeType,
			}),
		);
		formData.append("model_id", env.ELEVENLABS_STT_BATCH_MODEL_ID);

		if (input.language) {
			// ElevenLabs expects a bare ISO 639-1 code (e.g. "pt"), not a locale like "pt-PT".
			const lang = input.language.trim().replace(/_/g, "-").split("-")[0];
			if (lang) formData.append("language_code", lang);
		}

		const response = await fetch(`${baseUrl}/v1/speech-to-text`, {
			method: "POST",
			headers: {
				"xi-api-key": env.ELEVENLABS_API_KEY!,
			},
			body: formData,
			signal: AbortSignal.timeout(15_000),
		});

		if (!response.ok) return undefined;

		const data = (await response.json()) as { text?: string };
		const transcript = data.text?.trim();
		return transcript || undefined;
	} catch {
		return undefined;
	}
}

export async function preTranscribeAudio(input: {
	audioBuffer: Buffer;
	mimeType?: string;
	language?: string;
}): Promise<string | undefined> {
	return preTranscribeAudioWithElevenLabs(input);
}
