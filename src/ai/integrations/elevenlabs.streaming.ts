import { env } from "@/env/ai";

/**
 * Resolves the single ElevenLabs voice ID owned by the AI service runtime.
 */
const getDefaultVoiceId = () => env.ELEVENLABS_VOICE_ID_DEFAULT?.trim();

/**
 * Builds the ElevenLabs voice settings owned by the server runtime so the
 * streamed voice matches the batch TTS fallback profile.
 */
const getVoiceSettings = () => ({
	stability: env.ELEVENLABS_STABILITY,
	similarity_boost: env.ELEVENLABS_SIMILARITY_BOOST,
	style: 0,
});

export type SpeechWithTimestamps = {
	audioBuffer: Buffer;
	chars: string[];
	startTimesMs: number[];
};

type SpeechWithTimestampsLine = {
	audio_base64?: string;
	alignment?: {
		characters: string[];
		character_start_times_seconds: number[];
	};
	normalized_alignment?: {
		characters: string[];
		character_start_times_seconds: number[];
	};
};

type SpeechAlignmentChunk = {
	chars: string[];
	startTimesMs: number[];
};

type SpeechStreamResponse = Response & {
	body: ReadableStream<Uint8Array>;
};

export type SpeechWithTimestampsStreamResult = {
	audioByteLength: number;
	chars: string[];
	startTimesMs: number[];
};

/**
 * Opens the ElevenLabs `/stream/with-timestamps` endpoint after validating the
 * shared voice configuration used by every TTS path.
 */
const openSpeechWithTimestampsResponse = async (
	text: string,
): Promise<SpeechStreamResponse> => {
	if (!env.ELEVENLABS_API_KEY) {
		throw new Error("ELEVENLABS_API_KEY is required");
	}

	const voiceId = getDefaultVoiceId();
	if (!voiceId) {
		throw new Error("ELEVENLABS_VOICE_ID_DEFAULT is required");
	}

	const endpoint = new URL(
		`/v1/text-to-speech/${encodeURIComponent(voiceId)}/stream/with-timestamps`,
		env.ELEVENLABS_BASE_URL,
	);
	endpoint.searchParams.set("output_format", env.ELEVENLABS_OUTPUT_FORMAT);

	const response = await fetch(endpoint, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"xi-api-key": env.ELEVENLABS_API_KEY,
			Accept: "application/json",
		},
		body: JSON.stringify({
			text,
			model_id: env.ELEVENLABS_MODEL_ID,
			language_code: "pt",
			voice_settings: getVoiceSettings(),
		}),
	});

	if (!response.ok || !response.body) {
		const details = await response.text().catch(() => "");
		throw new Error(
			details
				? `ELEVENLABS_TIMESTAMPS_FAILED: ${response.status} ${details}`
				: `ELEVENLABS_TIMESTAMPS_FAILED: ${response.status}`,
		);
	}

	return response as SpeechStreamResponse;
};

/**
 * Parses one ElevenLabs NDJSON line into audio and alignment payloads, ignoring
 * malformed keep-alive or partial lines without interrupting the stream.
 */
const parseSpeechWithTimestampsLine = (line: string) => {
	const trimmed = line.trim();
	if (!trimmed) return null;

	try {
		const chunk = JSON.parse(trimmed) as SpeechWithTimestampsLine;
		const alignment = chunk.alignment ?? chunk.normalized_alignment;
		const alignmentChunk: SpeechAlignmentChunk | undefined = alignment
			? {
					chars: alignment.characters,
					startTimesMs: alignment.character_start_times_seconds.map((seconds) =>
						Math.round((seconds ?? 0) * 1000),
					),
				}
			: undefined;

		return {
			audioBase64: chunk.audio_base64,
			alignment: alignmentChunk,
		};
	} catch {
		return null;
	}
};

/**
 * Streams ElevenLabs audio chunks from `/stream/with-timestamps` as soon as each
 * NDJSON frame arrives while also collecting the final timing summary.
 */
export const streamSpeechWithTimestamps = async (input: {
	text: string;
	onAudioChunk?: (chunk: Buffer) => void;
	onAlignment?: (alignment: SpeechAlignmentChunk) => void;
}): Promise<SpeechWithTimestampsStreamResult> => {
	const text = input.text.trim();
	if (!text) {
		throw new Error("Text is required for ElevenLabs TTS with timestamps");
	}

	const response = await openSpeechWithTimestampsResponse(text);
	let audioByteLength = 0;
	const chars: string[] = [];
	const startTimesMs: number[] = [];

	const reader = response.body.getReader();
	const decoder = new TextDecoder();
	let lineBuf = "";

	/**
	 * Dispatches one complete NDJSON frame to the audio and timing callbacks.
	 */
	const processLine = (line: string) => {
		const parsed = parseSpeechWithTimestampsLine(line);
		if (!parsed) return;

		if (parsed.audioBase64) {
			const audioChunk = Buffer.from(parsed.audioBase64, "base64");
			audioByteLength += audioChunk.byteLength;
			input.onAudioChunk?.(audioChunk);
		}

		if (parsed.alignment?.chars.length) {
			chars.push(...parsed.alignment.chars);
			startTimesMs.push(...parsed.alignment.startTimesMs);
			input.onAlignment?.(parsed.alignment);
		}
	};

	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		lineBuf += decoder.decode(value, { stream: true });
		const lines = lineBuf.split("\n");
		lineBuf = lines.pop() ?? "";
		for (const line of lines) processLine(line);
	}
	if (lineBuf) processLine(lineBuf);

	return {
		audioByteLength,
		chars,
		startTimesMs,
	};
};

/**
 * Fetches TTS audio together with character-level timing data from the
 * ElevenLabs `/stream/with-timestamps` NDJSON endpoint.
 */
export const fetchSpeechWithTimestamps = async (input: {
	text: string;
}): Promise<SpeechWithTimestamps> => {
	const audioChunks: Buffer[] = [];
	const result = await streamSpeechWithTimestamps({
		text: input.text,
		onAudioChunk: (chunk) => {
			audioChunks.push(chunk);
		},
	});

	return {
		audioBuffer: Buffer.concat(audioChunks),
		chars: result.chars,
		startTimesMs: result.startTimesMs,
	};
};

export const streamSpeechWithElevenLabs = async (input: {
	text: string;
}): Promise<ReadableStream<Uint8Array>> => {
	if (!env.ELEVENLABS_API_KEY) {
		throw new Error("ELEVENLABS_API_KEY is required");
	}

	const text = input.text.trim();
	if (!text) {
		throw new Error("Text is required for ElevenLabs streaming");
	}

	const voiceId = getDefaultVoiceId();
	if (!voiceId) {
		throw new Error("ELEVENLABS_VOICE_ID_DEFAULT is required");
	}

	const endpoint = new URL(
		`/v1/text-to-speech/${encodeURIComponent(voiceId)}/stream`,
		env.ELEVENLABS_BASE_URL,
	);
	endpoint.searchParams.set("output_format", env.ELEVENLABS_OUTPUT_FORMAT);

	const response = await fetch(endpoint, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"xi-api-key": env.ELEVENLABS_API_KEY,
			Accept: "audio/mpeg",
		},
		body: JSON.stringify({
			text,
			model_id: env.ELEVENLABS_MODEL_ID,
			language_code: "pt",
			voice_settings: getVoiceSettings(),
		}),
	});

	if (!response.ok || !response.body) {
		const details = await response.text().catch(() => "");
		throw new Error(
			details
				? `ELEVENLABS_STREAM_FAILED: ${response.status} ${details}`
				: `ELEVENLABS_STREAM_FAILED: ${response.status}`,
		);
	}

	return response.body;
};
