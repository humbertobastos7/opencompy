import type {
	ChatConversationMessage,
	ChatVoiceCloseResponse,
	ChatVoiceSessionConfig,
	ChatVoiceSessionResponse,
	ChatVoiceTtsResponse,
	ChatVoiceTurnResponse,
} from "@/shared/contracts";
import { api_client } from "../utils/api";

export type SessionOutcome = {
	userOutcome?: "Sucesso" | "Cancelada" | "Falha";
	userNote?: string;
};

/**
 * Validates the requested voice-session settings and returns the normalized backend version.
 */
export const createVoiceSession = async (
	session: ChatVoiceSessionConfig = {},
): Promise<ChatVoiceSessionResponse> => {
	const response = await api_client.chat.voice.session.$post({
		json: { session },
	});

	if (!response.ok) {
		const error = await response.text();
		throw new Error(`FAILED_TO_CREATE_VOICE_SESSION: ${error}`);
	}

	return await response.json();
};

/**
 * Sends one text or audio turn to the backend voice pipeline and returns the full result payload.
 */
export const submitVoiceTurn = async (payload: {
	session: ChatVoiceSessionConfig;
	conversation: ChatConversationMessage[];
	conversation_id?: string;
	input: {
		text?: string;
		audio_base64?: string;
		audio_mime_type?: string;
		audio_language?: string;
	};
	signal?: AbortSignal;
}): Promise<ChatVoiceTurnResponse> => {
	const response = await api_client.chat.voice.turn.$post({
		json: {
			session: payload.session,
			conversation: payload.conversation,
			conversation_id: payload.conversation_id,
			input: payload.input,
		},
		signal: payload.signal,
	});

	if (!response.ok) {
		const error = await response.text();
		throw new Error(`FAILED_TO_PROCESS_VOICE_TURN: ${error}`);
	}

	return await response.json();
};

/**
 * Generates a short fixed assistant phrase with the configured Compy voice.
 */
export const synthesizeAssistantSpeech = async (
	text: string,
	signal?: AbortSignal,
): Promise<ChatVoiceTtsResponse> => {
	const response = await api_client.chat.voice.tts.$post({
		json: { text },
		signal,
	});

	if (!response.ok) {
		const error = await response.text();
		throw new Error(`FAILED_TO_SYNTHESIZE_ASSISTANT_SPEECH: ${error}`);
	}

	return await response.json();
};

/**
 * Closes an active voice conversation and triggers summary generation on the backend.
 */
export const closeVoiceConversation = async (
	conversationId: string,
	outcome?: SessionOutcome,
): Promise<ChatVoiceCloseResponse> => {
	const response = await api_client.chat.voice.close.$post({
		json: {
			conversation_id: conversationId,
			...(outcome?.userOutcome && { user_outcome: outcome.userOutcome }),
			...(outcome?.userNote && { user_note: outcome.userNote }),
		},
	});

	if (!response.ok) {
		const error = await response.text();
		throw new Error(`FAILED_TO_CLOSE_VOICE_CONVERSATION: ${error}`);
	}

	return await response.json();
};
