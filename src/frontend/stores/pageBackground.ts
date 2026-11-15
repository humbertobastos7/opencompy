import { create } from "zustand";

type PageBackgroundStore = {
	background: string | null;
	setBackground: (bg: string | null) => void;
	globalBackground: string | null;
	setGlobalBackground: (bg: string | null) => void;
	footerOverlay: boolean;
	setFooterOverlay: (overlay: boolean) => void;
	hideFooter: boolean;
	setHideFooter: (hide: boolean) => void;
};

const GLOBAL_BG_STORAGE_KEY = "compy-global-background";
const SPRING_GLOBAL_BG =
	"radial-gradient(circle at 12% 24%, rgba(255,252,226,0.96) 0%, rgba(255,252,226,0.74) 24%, rgba(255,252,226,0.18) 42%, rgba(255,252,226,0) 58%), radial-gradient(circle at 92% 80%, rgba(185,235,220,0.86) 0%, rgba(185,235,220,0.52) 18%, rgba(185,235,220,0.14) 36%, rgba(185,235,220,0) 54%), linear-gradient(135deg, #fffce2 0%, #ffffff 52%, #b9ebdc 100%)";

const readGlobalBackground = () => {
	if (typeof window === "undefined") return null;
	const stored = window.localStorage.getItem(GLOBAL_BG_STORAGE_KEY);
	if (!stored) return SPRING_GLOBAL_BG;
	if (
		stored.includes("#ebe7ff") ||
		stored.includes("235,231,255") ||
		stored.includes("#efebff")
	) {
		window.localStorage.setItem(GLOBAL_BG_STORAGE_KEY, SPRING_GLOBAL_BG);
		return SPRING_GLOBAL_BG;
	}
	return stored;
};

export const usePageBackgroundStore = create<PageBackgroundStore>((set) => ({
	background: null,
	setBackground: (background) => set({ background }),
	globalBackground: readGlobalBackground(),
	setGlobalBackground: (globalBackground) => {
		if (typeof window !== "undefined") {
			if (globalBackground) {
				window.localStorage.setItem(GLOBAL_BG_STORAGE_KEY, globalBackground);
			} else {
				window.localStorage.removeItem(GLOBAL_BG_STORAGE_KEY);
			}
		}
		set({ globalBackground });
	},
	footerOverlay: false,
	setFooterOverlay: (footerOverlay) => set({ footerOverlay }),
	hideFooter: false,
	setHideFooter: (hideFooter) => set({ hideFooter }),
}));
