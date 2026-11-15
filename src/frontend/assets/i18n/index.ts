import { pt } from "./pt";

export const PORTUGUESE_EUROPEAN_LOCALE = "pt-PT";
export const locales = [PORTUGUESE_EUROPEAN_LOCALE] as const;
export const localeDetails = [
	{
		code: PORTUGUESE_EUROPEAN_LOCALE,
		name: "Português (Portugal)",
		flag: "🇵🇹",
	},
] as const;

/**
 * Resolves the UI dictionary while keeping Portuguese as the only active locale.
 */
export const dictionary = (_lang: string): typeof pt => {
	void _lang;
	return pt;
};
