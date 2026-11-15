import { create } from "zustand";
import type { LocalSession } from "@/shared/contracts";
import { createJSONStorage, persist } from "zustand/middleware";
import { api_client } from "../utils/api";
import { readApiError } from "../utils/apiErrors";

/**
 * Holds the local user. Compy has no accounts: the backend always answers
 * `/api/me` with the single user of this installation, and this store caches
 * it so the UI can render the person's name and preferences immediately.
 */
interface SessionStoreState {
	session: LocalSession | null;
	refreshSession: (force?: boolean) => Promise<void>;
	setSession: (session: LocalSession) => void;
	lastChecked: number | null;
}

export const getSession = async (): Promise<
	{ data: LocalSession; error?: undefined } | { data?: undefined; error: string }
> => {
	const res = await api_client.me.$get();
	if (res.ok) {
		return { data: (await res.json()) as LocalSession };
	}
	return { error: await readApiError(res) };
};

export const useSessionStore = create<SessionStoreState>()(
	persist(
		(set, state) => ({
			session: null,
			lastChecked: null,
			setSession: (session) => set({ session, lastChecked: Date.now() }),
			refreshSession: async (force) => {
				const now = Date.now();
				const lastChecked = state().lastChecked ?? 0;
				if (!lastChecked || now - lastChecked >= 5000 || force) {
					const session = await getSession();
					if (session.data) {
						set({ session: session.data, lastChecked: now });
					}
				}
			},
		}),
		{
			name: "session",
			storage: createJSONStorage(() => localStorage),
		},
	),
);

export const getSessionState = () => useSessionStore.getState().session;
export const validateUserSession = async (force = true) => {
	await useSessionStore.getState().refreshSession(force);

	return getSessionState();
};
export const setSessionState = (session: LocalSession) => {
	useSessionStore.getState().setSession(session);
};
