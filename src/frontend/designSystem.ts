/**
 * Compy.ai Premium Design System
 * ──────────────────────────────
 * Shared CSSProperties constants for consistent styling across all pages.
 * Import and spread these into your inline style objects.
 *
 * Usage:
 *   import { DS } from '@/frontend/designSystem'
 *   <div style={{ ...DS.glassCard, padding: DS.space.lg }}>
 */

import type { CSSProperties } from "react";

// ── Color Palette ──────────────────────────────────────────────────────────
export const C = {
	teal50: "#f0fbfa",
	teal100: "#dff5f3",
	teal200: "#c3dfe5",
	teal300: "#6fc8c7",
	teal400: "#1fb5b5",
	teal500: "#0d8a8a",
	teal600: "#1a5f5a",
	teal700: "#0a4a45",
	teal800: "#1a2a2a",

	white: "#ffffff",
	text: "#1a2a2a",
	textSub: "#3a6a6a",
	textMuted: "#7a9a9a",
	textOnTeal: "#ffffff",
	textOnCard: "#1a5f5a",

	success: "#4ade80",
	warning: "#fb923c",
	error: "#f87171",
	info: "#38bdf8",
} as const;

// ── Spacing ────────────────────────────────────────────────────────────────
export const space = {
	xs: 4,
	sm: 8,
	md: 16,
	lg: 24,
	xl: 32,
	"2xl": 48,
} as const;

// ── Border Radius ──────────────────────────────────────────────────────────
export const radius = {
	sm: 8,
	md: 12,
	lg: 16,
	xl: 20,
	"2xl": 24,
	full: 9999,
} as const;

// ── Shadows ────────────────────────────────────────────────────────────────
export const shadow = {
	sm: "0 1px 3px rgba(13,138,138,0.06), 0 1px 2px rgba(13,138,138,0.04)",
	md: "0 4px 12px rgba(13,138,138,0.08), 0 2px 6px rgba(13,138,138,0.04)",
	lg: "0 10px 30px rgba(13,138,138,0.10), 0 4px 12px rgba(13,138,138,0.06)",
	xl: "0 20px 50px rgba(13,138,138,0.12), 0 8px 20px rgba(13,138,138,0.08)",
	glow: "0 0 20px rgba(31,181,181,0.15)",
} as const;

// ── Transitions ────────────────────────────────────────────────────────────
export const transition = {
	fast: "all 150ms cubic-bezier(0.4, 0, 0.2, 1)",
	normal: "all 250ms cubic-bezier(0.4, 0, 0.2, 1)",
	slow: "all 400ms cubic-bezier(0.4, 0, 0.2, 1)",
	spring: "all 500ms cubic-bezier(0.34, 1.56, 0.64, 1)",
} as const;

// ── Composite Styles ───────────────────────────────────────────────────────

/** Glassmorphism card – use for all floating surfaces */
export const glassCard: CSSProperties = {
	background: "rgba(255, 255, 255, 0.88)",
	backdropFilter: "blur(12px)",
	WebkitBackdropFilter: "blur(12px)",
	border: "1px solid rgba(255, 255, 255, 0.7)",
	borderRadius: radius.xl,
	boxShadow: shadow.md,
	transition: transition.normal,
};

/** Glassmorphism card with hover state — for interactive cards */
export const glassCardInteractive: CSSProperties = {
	...glassCard,
	cursor: "pointer",
};

/** Solid teal card background */
export const solidCard: CSSProperties = {
	backgroundColor: C.teal100,
	borderRadius: radius.xl,
	boxShadow: shadow.md,
};

/** Primary button */
export const btnPrimary: CSSProperties = {
	backgroundColor: C.teal500,
	color: C.white,
	border: "none",
	borderRadius: radius.lg,
	padding: "12px 24px",
	fontWeight: 600,
	fontSize: 15,
	cursor: "pointer",
	transition: transition.fast,
	boxShadow: shadow.sm,
};

/** Secondary button */
export const btnSecondary: CSSProperties = {
	backgroundColor: "rgba(31, 181, 181, 0.08)",
	color: C.teal500,
	border: `1.5px solid ${C.teal300}`,
	borderRadius: radius.lg,
	padding: "12px 24px",
	fontWeight: 600,
	fontSize: 15,
	cursor: "pointer",
	transition: transition.fast,
};

/** Destructive button */
export const btnDestructive: CSSProperties = {
	backgroundColor: "#fef2f2",
	color: "#dc2626",
	border: "1.5px solid #fca5a5",
	borderRadius: radius.lg,
	padding: "12px 24px",
	fontWeight: 600,
	fontSize: 15,
	cursor: "pointer",
	transition: transition.fast,
};

/** Ghost button */
export const btnGhost: CSSProperties = {
	backgroundColor: "transparent",
	color: C.textSub,
	border: "none",
	borderRadius: radius.lg,
	padding: "12px 24px",
	fontWeight: 500,
	fontSize: 15,
	cursor: "pointer",
	transition: transition.fast,
};

/** Form input */
export const formInput: CSSProperties = {
	backgroundColor: C.white,
	border: "1px solid rgba(26, 95, 90, 0.18)",
	borderRadius: radius.md,
	padding: "12px 16px",
	fontSize: 15,
	color: C.text,
	outline: "none",
	transition: transition.fast,
	width: "100%",
};

/** Page background glow orb */
export const bgGlow = (
	size: number,
	opacity: number,
	blur: number,
	position: {
		left?: string | number;
		right?: string | number;
		top?: string | number;
		bottom?: string | number;
	},
): CSSProperties => ({
	position: "fixed",
	width: size,
	height: size,
	borderRadius: "50%",
	background: `rgba(214, 242, 244, ${opacity})`,
	filter: `blur(${blur}px)`,
	pointerEvents: "none",
	zIndex: 0,
	...position,
});

/** Section heading */
export const heading: CSSProperties = {
	fontSize: 24,
	fontWeight: 800,
	letterSpacing: "-0.02em",
	color: C.text,
	lineHeight: 1.2,
};

/** Subheading */
export const subheading: CSSProperties = {
	fontSize: 14,
	fontWeight: 500,
	color: C.textMuted,
	letterSpacing: "0.01em",
};

/** Stat / metric value */
export const statValue: CSSProperties = {
	fontSize: 28,
	fontWeight: 800,
	color: C.teal600,
	lineHeight: 1,
};

/** Stat label */
export const statLabel: CSSProperties = {
	fontSize: 11,
	fontWeight: 600,
	textTransform: "uppercase",
	letterSpacing: "0.08em",
	color: C.textMuted,
	marginTop: 6,
};

/** Modal overlay */
export const modalOverlay: CSSProperties = {
	position: "fixed",
	inset: 0,
	zIndex: 600,
	backdropFilter: "blur(6px)",
	WebkitBackdropFilter: "blur(6px)",
	backgroundColor: "rgba(0, 0, 0, 0.25)",
	display: "flex",
	alignItems: "center",
	justifyContent: "center",
};

/** Modal content */
export const modalContent: CSSProperties = {
	...glassCard,
	background: C.teal50,
	maxWidth: 440,
	width: "100%",
	maxHeight: "85vh",
	overflow: "hidden",
	display: "flex",
	flexDirection: "column",
	boxShadow: shadow.xl,
};

// ── Export as namespace ─────────────────────────────────────────────────────
export const DS = {
	C,
	space,
	radius,
	shadow,
	transition,
	glassCard,
	glassCardInteractive,
	solidCard,
	btnPrimary,
	btnSecondary,
	btnDestructive,
	btnGhost,
	formInput,
	bgGlow,
	heading,
	subheading,
	statValue,
	statLabel,
	modalOverlay,
	modalContent,
};

export default DS;
