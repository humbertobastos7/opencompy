export const NEGATIVE_TONES = new Set([
	"negativo",
	"melancólico",
	"melancolico",
	"ansioso",
	"triste",
	"depressivo",
	"negative",
	"sad",
	"anxious",
	"melancholic",
	"depressed",
]);

export const POSITIVE_TONES = new Set([
	"positivo",
	"alegre",
	"feliz",
	"animado",
	"positive",
	"happy",
	"cheerful",
]);

export function toneCategory(
	tone: string | null,
): "positive" | "neutral" | "negative" | "unknown" {
	if (!tone) return "unknown";
	const t = tone.toLowerCase();
	if (POSITIVE_TONES.has(t)) return "positive";
	if (NEGATIVE_TONES.has(t)) return "negative";
	return "neutral";
}
