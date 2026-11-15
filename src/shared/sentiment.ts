import { pipeline, type TextClassificationOutput } from "@xenova/transformers";

// Allocate a pipeline for sentiment-analysis

/**
 * Analyzes the sentiment of a given prompt and its historical context.
 * Uses the BERT multilingual model for sentiment analysis.
 *
 * @param prompt - The text to analyze for sentiment
 * @param history - Optional array of previous text entries to provide context
 * @returns An object containing:
 *  - promptScore: The sentiment score (1-5) of the current prompt
 *  - contextScore: The average sentiment score of all texts (prompt + history)
 *
 * @example
 * ```typescript
 * const result = await analyzeSentiment("I love this!", ["This is great", "Awesome!"]);
 * // Returns: { promptScore: 5, contextScore: 5 }
 * ```
 */
export async function analyzeSentiment(prompt: string, history: string[] = []) {
	const pipe = await pipeline(
		"sentiment-analysis",
		"Xenova/bert-base-multilingual-uncased-sentiment",
	);
	const promptAnalysis = (await pipe(prompt)) as TextClassificationOutput;

	const promptScore = Number.parseInt(promptAnalysis[0].label.split(" ")[0]);

	if (history.length === 0) {
		return { promptScore, contextScore: promptScore };
	}

	const contextAnalyses = (await Promise.all(
		history.map((text) => pipe(text)),
	)) as TextClassificationOutput[];
	const contextScores = contextAnalyses.map((analysis) =>
		Number.parseInt(analysis[0].label.split(" ")[0]),
	);
	const contextScore = Math.round(
		contextScores.reduce((a, b) => a + b, 0) / contextScores.length,
	);

	return {
		promptScore,
		contextScore,
	};
}
