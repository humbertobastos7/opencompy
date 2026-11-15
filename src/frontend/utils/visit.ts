/**
 * Identifies one opening of the app (one page load). The backend stores all
 * turns that share a visit key in the same conversation, so reloading the
 * page starts a new conversation.
 */
const createVisitKey = () => {
	if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
		return crypto.randomUUID();
	}
	// Fallback for non-secure contexts (plain http on a LAN address).
	return "xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx".replace(/x/g, () =>
		Math.floor(Math.random() * 16).toString(16),
	);
};

export const VISIT_KEY = createVisitKey();
export const VISIT_KEY_HEADER = "x-compy-visit";
