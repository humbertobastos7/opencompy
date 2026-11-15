import { create } from "zustand";

interface CustomizationStoreState {
	silenceTimeoutMs: number;
	setSilenceTimeoutMs: (timeout: number) => void;
	chatPersonality: "formal" | "informal";
	setChatPersonality: (personality: "formal" | "informal") => void;
}

/**
 * Stores only the senior customization controls that still affect runtime behaviour.
 */
export const useCustomizationStore = create<CustomizationStoreState>()(
	(set) => ({
		silenceTimeoutMs: 2500,
		setSilenceTimeoutMs: (timeout) => set({ silenceTimeoutMs: timeout }),
		chatPersonality: "informal",
		setChatPersonality: (personality) => set({ chatPersonality: personality }),
	}),
);
