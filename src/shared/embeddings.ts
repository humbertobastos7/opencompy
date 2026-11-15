/**
 * Returns a 1536-dimensional embedding vector for the given text using
 * OpenAI text-embedding-3-small.
 *
 * Symmetric — use the same function for both storing facts and querying.
 */
export async function getEmbedding(text: string): Promise<number[]> {
	const apiKey = process.env.OPENAI_API_KEY;

	if (!apiKey) {
		throw new Error("OPENAI_API_KEY is required for embeddings");
	}

	const response = await fetch("https://api.openai.com/v1/embeddings", {
		method: "POST",
		headers: {
			Authorization: `Bearer ${apiKey}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			model: "text-embedding-3-small",
			input: text,
		}),
		signal: AbortSignal.timeout(15_000),
	});

	if (!response.ok) {
		const raw = await response.text();
		throw new Error(`OPENAI_EMBED_FAILED (${response.status}): ${raw}`);
	}

	const data = (await response.json()) as {
		data: Array<{ embedding: number[] }>;
	};
	const embedding = data.data?.[0]?.embedding;

	if (!embedding?.length) {
		throw new Error("OPENAI_EMBED_EMPTY_RESPONSE");
	}

	return embedding;
}
