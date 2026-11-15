import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/env/ai";
import type {
	ChatConversationMessage,
	ChatVoiceLlmUsage,
} from "@/shared/contracts";

const DEFAULT_MAX_TOKENS = 200;
const DEFAULT_TEMPERATURE = 0.5;
const MAX_TOOL_ITERATIONS = 5;
type SystemPromptBlocks = string | string[];

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

/**
 * Converts the app conversation format into the messages array expected by the Anthropic Messages API.
 */
const toAnthropicMessages = (
	conversation: ChatConversationMessage[],
): Anthropic.MessageParam[] =>
	conversation.map((m) => ({
		role: m.role,
		content: m.content,
	}));

const toAnthropicSystemBlocks = (
	systemPrompt: SystemPromptBlocks | undefined,
): Anthropic.TextBlockParam[] => {
	const blocks = Array.isArray(systemPrompt) ? systemPrompt : [systemPrompt];
	return blocks
		.map((block) => block?.trim())
		.filter((block): block is string => Boolean(block))
		.map((text) => ({
			type: "text" as const,
			text,
			cache_control: { type: "ephemeral" as const },
		}));
};

/**
 * Calls the Anthropic Messages API with optional web search tool support.
 *
 * When webSearch is enabled, Claude may use the built-in web_search_20250305
 * server-side tool to look up real-time information (weather, local events, etc.) before
 * composing its reply. Anthropic executes the search transparently — no external API key needed.
 *
 * Implements a multi-turn loop to handle tool_use stop reasons gracefully.
 */
export const generateAssistantReplyWithAnthropic = async (input: {
	model?: string;
	systemPrompt?: SystemPromptBlocks;
	conversation: ChatConversationMessage[];
	maxTokens?: number;
	webSearch?: boolean;
	onUsage?: (usage: ChatVoiceLlmUsage) => void;
}): Promise<string> => {
	const client = getClient();
	const model =
		input.model?.trim() || env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
	const maxTokens = input.maxTokens ?? DEFAULT_MAX_TOKENS;
	const useWebSearch = input.webSearch === true;

	const messages: Anthropic.MessageParam[] = toAnthropicMessages(
		input.conversation,
	);
	const system = toAnthropicSystemBlocks(input.systemPrompt);

	// web_search_20250305 is a server-side built-in tool — Anthropic executes the search.
	// Cast required because SDK typings use a union that may not expose this tool directly.
	const tools = useWebSearch
		? ([
				{
					type: "web_search_20250305",
					name: "web_search",
					max_uses: 1,
				},
			] as unknown as Anthropic.Tool[])
		: undefined;

	for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
		const response = await client.messages.create({
			model,
			max_tokens: maxTokens,
			temperature: DEFAULT_TEMPERATURE,
			...(system.length ? { system } : {}),
			messages,
			...(i === 0 && tools ? { tools } : {}),
		});
		console.info(
			"[anthropic] usage",
			JSON.stringify({
				model,
				webSearch: useWebSearch,
				stopReason: response.stop_reason,
				usage: response.usage,
			}),
		);
		input.onUsage?.(normalizeUsage(model, useWebSearch, response.usage));

		// Extract text from any text blocks in this response turn.
		const text = response.content
			.filter((b): b is Anthropic.TextBlock => b.type === "text")
			.map((b) => b.text.trim())
			.filter(Boolean)
			.join("\n")
			.trim();

		if (response.stop_reason === "end_turn") {
			if (!text) throw new Error("ANTHROPIC_EMPTY_ASSISTANT_RESPONSE");
			return text;
		}

		if (response.stop_reason === "tool_use") {
			// Append the assistant turn with tool_use blocks.
			messages.push({ role: "assistant", content: response.content });

			// Acknowledge tool results. For server-side tools (web_search), Anthropic
			// has already executed the search — we pass an empty content to continue.
			const toolUseBlocks = response.content.filter(
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

		// max_tokens or other stop reasons — return whatever text we have.
		if (text) return text;
		throw new Error(
			`ANTHROPIC_UNEXPECTED_STOP_REASON: ${response.stop_reason}`,
		);
	}

	throw new Error("ANTHROPIC_MAX_TOOL_ITERATIONS_REACHED");
};
