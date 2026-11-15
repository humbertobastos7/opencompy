/**
 * Normalizes a speech-language hint into a stable locale string while preserving
 * the most specific locale information available for downstream ASR providers.
 */
export const normalizeSpeechLanguage = (language?: string) => {
	if (!language) {
		return undefined;
	}

	const normalized = language.trim().replace(/_/g, "-");
	if (!normalized) {
		return undefined;
	}

	const segments = normalized.split("-").filter(Boolean);
	if (segments.length === 0) {
		return undefined;
	}

	return segments
		.map((segment, index) => {
			if (index === 0) {
				return segment.toLowerCase();
			}

			if (segment.length === 2) {
				return segment.toUpperCase();
			}

			return segment;
		})
		.join("-");
};
