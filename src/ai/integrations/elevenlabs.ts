import { env } from "@/env/ai";

/**
 * Resolves the single ElevenLabs voice ID owned by the AI service runtime.
 */
const resolveConfiguredVoiceId = () => env.ELEVENLABS_VOICE_ID_DEFAULT?.trim();

/**
 * Converts binary audio returned by ElevenLabs into base64 for JSON transport.
 */
const toBase64 = (buffer: ArrayBuffer) =>
	Buffer.from(buffer).toString("base64");

/**
 * Fetches the current ElevenLabs subscription quota for monitoring purposes.
 */
export const getElevenLabsSubscription = async () => {
	if (!env.ELEVENLABS_API_KEY) {
		throw new Error("ELEVENLABS_API_KEY is required");
	}

	const endpoint = new URL("/v1/user/subscription", env.ELEVENLABS_BASE_URL);

	const response = await fetch(endpoint, {
		headers: {
			"xi-api-key": env.ELEVENLABS_API_KEY,
		},
	});

	if (!response.ok) {
		const raw = await response.text();
		throw new Error(
			`ELEVENLABS_SUBSCRIPTION_FAILED (${response.status}): ${raw || response.statusText}`,
		);
	}

	const data = (await response.json()) as {
		character_count: number;
		character_limit: number;
	};

	return {
		characterCount: data.character_count,
		characterLimit: data.character_limit,
		remaining: data.character_limit - data.character_count,
	};
};

/**
 * Synthesizes assistant speech with ElevenLabs using the single server-owned voice.
 */
export const synthesizeSpeechWithElevenLabs = async (input: {
	text: string;
}) => {
	if (!env.ELEVENLABS_API_KEY) {
		throw new Error("ELEVENLABS_API_KEY is required");
	}

	const voiceId = resolveConfiguredVoiceId();
	if (!voiceId) {
		throw new Error("ELEVENLABS_VOICE_ID_DEFAULT is required");
	}

	const endpoint = new URL(
		`/v1/text-to-speech/${encodeURIComponent(voiceId)}`,
		env.ELEVENLABS_BASE_URL,
	);
	endpoint.searchParams.set("output_format", env.ELEVENLABS_OUTPUT_FORMAT);

	const response = await fetch(endpoint, {
		method: "POST",
		headers: {
			"xi-api-key": env.ELEVENLABS_API_KEY,
			"Content-Type": "application/json",
			Accept: "audio/mpeg",
		},
		body: JSON.stringify({
			text: input.text,
			model_id: env.ELEVENLABS_MODEL_ID,
			language_code: "pt",
			voice_settings: {
				stability: env.ELEVENLABS_STABILITY,
				similarity_boost: env.ELEVENLABS_SIMILARITY_BOOST,
				style: 0,
			},
		}),
	});

	if (!response.ok) {
		const raw = await response.text();
		throw new Error(
			`ELEVENLABS_TTS_FAILED (${response.status}): ${
				raw || response.statusText
			}`,
		);
	}

	const audioBuffer = await response.arrayBuffer();
	return {
		audio_base64: toBase64(audioBuffer),
		audio_mime_type: response.headers.get("content-type") || "audio/mpeg",
	};
};
