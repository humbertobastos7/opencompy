import { PORTUGUESE_EUROPEAN_LOCALE, dictionary } from "@/frontend/assets/i18n";

const GENERIC_ERROR_MESSAGE =
	"Não foi possível concluir esta ação. Tente novamente.";

const STATUS_FALLBACK_MESSAGES: Record<number, string> = {
	400: GENERIC_ERROR_MESSAGE,
	401: "UNAUTHORIZED",
	403: "FORBIDDEN",
	404: "Não foi possível encontrar o que procura.",
	409: "Este pedido entrou em conflito com outro registo.",
	500: "INTERNAL_SERVER_ERROR",
	502: "INTERNAL_SERVER_ERROR",
	503: "INTERNAL_SERVER_ERROR",
	504: "INTERNAL_SERVER_ERROR",
};

function getErrorDictionary(lang: string) {
	return dictionary(lang).errors as Record<string, string>;
}

export function formatApiErrorMessage(
	message: unknown,
	lang = PORTUGUESE_EUROPEAN_LOCALE,
) {
	const raw = typeof message === "string" ? message.trim() : "";
	if (!raw) return GENERIC_ERROR_MESSAGE;

	const knownErrors = getErrorDictionary(lang);
	if (knownErrors[raw]) {
		return knownErrors[raw];
	}

	if (/^[A-Z0-9_]+$/.test(raw)) {
		return GENERIC_ERROR_MESSAGE;
	}

	return raw;
}

export async function readApiError(
	response: Response,
	lang = PORTUGUESE_EUROPEAN_LOCALE,
) {
	try {
		const payload = (await response.clone().json()) as { message?: unknown };
		if (payload.message) {
			return formatApiErrorMessage(payload.message, lang);
		}
	} catch {
		// Ignore malformed payloads and fall back to HTTP metadata below.
	}

	const statusFallback = STATUS_FALLBACK_MESSAGES[response.status];
	if (statusFallback) {
		return formatApiErrorMessage(statusFallback, lang);
	}

	return formatApiErrorMessage(response.statusText, lang);
}
