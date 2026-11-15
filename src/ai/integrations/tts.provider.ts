import { env } from "@/env/ai";
import { synthesizeSpeechWithElevenLabs } from "@/ai/integrations/elevenlabs";
import { streamSpeechWithElevenLabs } from "@/ai/integrations/elevenlabs.streaming";

type TtsInput = {
	text: string;
	languageCode?: string;
};

export const activeTtsProvider = (): "gemini" | "elevenlabs" =>
	env.TTS_PROVIDER;

export const synthesizeSpeech = async (input: TtsInput) =>
	synthesizeSpeechWithElevenLabs({ text: input.text });

export const streamSpeech = async (
	input: TtsInput,
): Promise<ReadableStream<Uint8Array>> =>
	streamSpeechWithElevenLabs({ text: input.text });
