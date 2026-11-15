import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/env/ai";
import type { ChatVoiceLlmUsage } from "@/shared/contracts";

export type AnthropicStreamingTextEvent =
	| { type: "text.delta"; text: string }
	| { type: "text.sentence"; text: string }
	| { type: "text.done"; text: string }
	| { type: "tool.web_search.start" };

type StreamAssistantReplyOptions = {
	model?: string;
	systemPrompt: string | string[];
	conversation: Array<{ role: "user" | "assistant"; content: string }>;
	maxTokens?: number;
	webSearch?: boolean;
	onUsage?: (usage: ChatVoiceLlmUsage) => void;
	onEvent: (event: AnthropicStreamingTextEvent) => void;
};

const DEFAULT_MAX_TOKENS = 200;
const DEFAULT_TEMPERATURE = 0.5;
const MAX_TOOL_ITERATIONS = 5;

/**
 * Buffer token deltas until a sentence boundary is detected so downstream TTS
 * can start from coherent chunks instead of arbitrary fragments.
 */
class SentenceBuffer {
	private buffer = "";

	addToken(token: string) {
		this.buffer += token;

		const match = this.buffer.match(/^(.+?[.!?])(?:\s|$)/);
		if (match) {
			const sentence = match[1]?.trim();
			this.buffer = this.buffer.slice(match[0].length).trimStart();
			return sentence || null;
		}

		const softPause =
			this.buffer.length >= 24 ? this.buffer.match(/^(.+?[,;:])\s/) : null;
		if (softPause) {
			const phrase = softPause[1]?.trim();
			this.buffer = this.buffer.slice(softPause[0].length).trimStart();
			return phrase || null;
		}

		if (this.buffer.length >= 32) {
			const sentence = this.buffer.trim();
			this.buffer = "";
			return sentence || null;
		}

		return null;
	}

	flush() {
		const sentence = this.buffer.trim();
		this.buffer = "";
		return sentence || null;
	}
}

let _client: Anthropic | null = null;

const normalizeUsage = (
	model: string,
	webSearch: boolean,
	usage: Anthropic.Usage,
): ChatVoiceLlmUsage => {
	const cacheCreation = usage.cache_creation_input_tokens ?? 0;
	const cacheRead = usage.cache_read_input_tokens ?? 0;
	const totalTokens =
		usage.input_tokens + usage.output_tokens + cacheCreation + cacheRead;

	return {
		model,
		input_tokens: usage.input_tokens,
		output_tokens: usage.output_tokens,
		cache_creation_input_tokens: cacheCreation,
		cache_read_input_tokens: cacheRead,
		total_tokens: totalTokens,
		web_search: webSearch,
	};
};

const getClient = (): Anthropic => {
	if (!env.ANTHROPIC_API_KEY) {
		throw new Error("ANTHROPIC_API_KEY is required");
	}
	if (!_client) {
		_client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
	}
	return _client;
};

const toAnthropicSystemBlocks = (
	systemPrompt: StreamAssistantReplyOptions["systemPrompt"],
): Anthropic.TextBlockParam[] => {
	const blocks = Array.isArray(systemPrompt) ? systemPrompt : [systemPrompt];
	return blocks
		.map((block) => block.trim())
		.filter(Boolean)
		.map((text) => ({
			type: "text" as const,
			text,
			cache_control: { type: "ephemeral" as const },
		}));
};

/**
 * Streams one assistant reply from the Anthropic API, emitting token deltas,
 * sentence boundaries, and a final completion event to the caller.
 *
 * Handles multi-turn tool use (web_search_20250305) when explicitly enabled.
 */
export const streamAssistantReplyWithAnthropic = async (
	options: StreamAssistantReplyOptions,
): Promise<string> => {
	const client = getClient();
	const model =
		options.model?.trim() || env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
	const maxTokens = options.maxTokens ?? DEFAULT_MAX_TOKENS;
	const useWebSearch = options.webSearch === true;
	const system = toAnthropicSystemBlocks(options.systemPrompt);

	const messages: Anthropic.MessageParam[] = options.conversation.map((m) => ({
		role: m.role,
		content: m.content,
	}));

	const tools = useWebSearch
		? ([
				{
					type: "web_search_20250305",
					name: "web_search",
					max_uses: 1,
				},
			] as unknown as Anthropic.Tool[])
		: undefined;

	const sentenceBuffer = new SentenceBuffer();
	let fullText = "";

	for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
		const stream = client.messages.stream({
			model,
			max_tokens: maxTokens,
			temperature: DEFAULT_TEMPERATURE,
			...(system.length ? { system } : {}),
			messages,
			...(iteration === 0 && tools ? { tools } : {}),
		});

		for await (const event of stream) {
			if (
				event.type === "content_block_start" &&
				event.content_block.type === "server_tool_use" &&
				event.content_block.name === "web_search"
			) {
				console.info("[anthropic.stream] WEB_SEARCH_START");
				options.onEvent({ type: "tool.web_search.start" });
				continue;
			}

			if (
				event.type === "content_block_delta" &&
				event.delta.type === "text_delta"
			) {
				const deltaText = event.delta.text;
				fullText += deltaText;

				options.onEvent({ type: "text.delta", text: deltaText });

				const sentence = sentenceBuffer.addToken(deltaText);
				if (sentence) {
					options.onEvent({ type: "text.sentence", text: sentence });
				}
			}
		}

		const finalMessage = await stream.finalMessage();
		console.info(
			"[anthropic.streaming] usage",
			JSON.stringify({
				model,
				webSearch: useWebSearch,
				stopReason: finalMessage.stop_reason,
				usage: finalMessage.usage,
			}),
		);
		options.onUsage?.(normalizeUsage(model, useWebSearch, finalMessage.usage));

		if (finalMessage.stop_reason === "end_turn") {
			break;
		}

		if (finalMessage.stop_reason === "tool_use") {
			// Anthropic executed the search server-side — append the assistant turn
			// and acknowledge with empty tool results to get the final reply.
			messages.push({ role: "assistant", content: finalMessage.content });

			const toolUseBlocks = finalMessage.content.filter(
				(b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
			);

			messages.push({
				role: "user",
				content: toolUseBlocks.map((block) => ({
					type: "tool_result" as const,
					tool_use_id: block.id,
					content: "",
				})),
			});

			continue;
		}

		// max_tokens or unexpected stop — exit the loop with whatever text we have.
		break;
	}

	const trailing = sentenceBuffer.flush();
	if (trailing) {
		options.onEvent({ type: "text.sentence", text: trailing });
	}

	const finalText = fullText.trim();
	options.onEvent({ type: "text.done", text: finalText });

	return finalText;
};
