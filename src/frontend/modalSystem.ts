/**
 * Compy.ai Modal Design System
 * ─────────────────────────────
 * Glass-white modal aesthetic — consistent across all overlays.
 *
 * Usage:
 *   import { MS } from '@/frontend/modalSystem'
 *
 *   // Overlay backdrop
 *   <div style={MS.overlay}>
 *
 *   // Card
 *   <div className="modal-card" style={{ ...MS.card, maxWidth: 320 }}>
 *
 *   // Always include the keyframes once per page:
 *   <style>{MS.keyframes}</style>
 *
 * Notes:
 *   - Add className="modal-card" to the card element — the keyframes target it.
 *   - prefers-reduced-motion is handled inside MS.keyframes automatically.
 */

import type { CSSProperties } from "react";

// ── Keyframes (paste once per page in a <style> tag) ──────────────────────────
export const keyframes = `
  @keyframes modalSlideUp {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @media (prefers-reduced-motion: reduce) {
    .modal-card { animation: none !important; }
  }
`;

// ── Overlay / Backdrop ────────────────────────────────────────────────────────
export const overlay: CSSProperties = {
	position: "fixed",
	inset: 0,
	zIndex: 600,
	display: "flex",
	alignItems: "center",
	justifyContent: "center",
	backgroundColor: "rgba(0,10,15,0.38)",
	backdropFilter: "blur(8px)",
	WebkitBackdropFilter: "blur(8px)",
};

// ── Card ──────────────────────────────────────────────────────────────────────
/** Base glass-white card. Add className="modal-card" for enter animation. */
export const card: CSSProperties = {
	background: "rgba(255,255,255,0.97)",
	backdropFilter: "blur(20px)",
	WebkitBackdropFilter: "blur(20px)",
	borderRadius: 28,
	border: "1px solid rgba(255,255,255,0.85)",
	boxShadow: "0 32px 64px rgba(0,0,0,0.13), 0 8px 24px rgba(0,0,0,0.06)",
	overflow: "hidden",
	width: "100%",
	animation: "modalSlideUp 0.24s cubic-bezier(0.22,1,0.36,1) both",
};

// ── Header ────────────────────────────────────────────────────────────────────
export const header: CSSProperties = {
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	padding: "20px 22px 16px",
	borderBottom: "1px solid rgba(0,0,0,0.055)",
};

export const headerTitle: CSSProperties = {
	fontSize: 16,
	fontWeight: 600,
	color: "#1a2a2a",
	letterSpacing: "-0.01em",
};

export const closeButton: CSSProperties = {
	width: 30,
	height: 30,
	borderRadius: "50%",
	background: "rgba(0,0,0,0.06)",
	border: "none",
	cursor: "pointer",
	display: "flex",
	alignItems: "center",
	justifyContent: "center",
	color: "#5a7a7a",
	fontSize: 13,
	flexShrink: 0,
	transition: "opacity 150ms ease",
};

// ── Body ──────────────────────────────────────────────────────────────────────
export const body: CSSProperties = {
	padding: "18px 22px 22px",
	display: "flex",
	flexDirection: "column",
	gap: 0,
};

// ── Divider ───────────────────────────────────────────────────────────────────
export const divider: CSSProperties = {
	height: 1,
	background: "rgba(0,0,0,0.055)",
	margin: "0 0 18px",
};

// ── Section label (muted, centered) ──────────────────────────────────────────
export const sectionLabel: CSSProperties = {
	fontSize: 13,
	fontWeight: 500,
	color: "#7a9a9a",
	textAlign: "center",
	letterSpacing: "0.02em",
	marginBottom: 4,
};

// ── Option button (radio-style row) ──────────────────────────────────────────

type OptionVariant = {
	dot: string;
	border: string;
	bg: string;
	text: string;
};

export const optionVariants: Record<string, OptionVariant> = {
	success: {
		dot: "#2DBFA0",
		border: "rgba(45,191,160,0.55)",
		bg: "rgba(45,191,160,0.07)",
		text: "#0a5c58",
	},
	warning: {
		dot: "#E8A020",
		border: "rgba(232,160,32,0.55)",
		bg: "rgba(232,160,32,0.07)",
		text: "#6e4a08",
	},
	danger: {
		dot: "#D96B6B",
		border: "rgba(217,107,107,0.55)",
		bg: "rgba(217,107,107,0.07)",
		text: "#7a2020",
	},
	neutral: {
		dot: "#A8A8B7",
		border: "rgba(168,168,183,0.55)",
		bg: "rgba(168,168,183,0.07)",
		text: "#3a3a4a",
	},
	info: {
		dot: "#5B9CF6",
		border: "rgba(91,156,246,0.55)",
		bg: "rgba(91,156,246,0.07)",
		text: "#1a3a7a",
	},
};

/** Base style for the option row. Merge with selected overrides. */
export const optionButton = (
	selected: boolean,
	variant: OptionVariant,
): CSSProperties => ({
	display: "flex",
	alignItems: "center",
	gap: 12,
	padding: "13px 16px",
	borderRadius: 16,
	width: "100%",
	border: `1.5px solid ${selected ? variant.border : "rgba(0,0,0,0.07)"}`,
	background: selected ? variant.bg : "rgba(248,250,250,0.9)",
	cursor: "pointer",
	transition: "all 160ms cubic-bezier(0.4,0,0.2,1)",
});

export const optionDot = (
	selected: boolean,
	variant: OptionVariant,
): CSSProperties => ({
	width: 9,
	height: 9,
	borderRadius: "50%",
	flexShrink: 0,
	background: variant.dot,
	boxShadow: selected ? `0 0 0 3px ${variant.dot}28` : "none",
	transition: "box-shadow 160ms ease",
});

export const optionLabel = (
	selected: boolean,
	variant: OptionVariant,
): CSSProperties => ({
	flex: 1,
	fontSize: 14,
	fontWeight: selected ? 600 : 500,
	color: selected ? variant.text : "#2a4a4a",
	textAlign: "left",
});

// ── Toggle ────────────────────────────────────────────────────────────────────
export const toggleTrack = (on: boolean): CSSProperties => ({
	position: "relative",
	width: 44,
	height: 24,
	borderRadius: 12,
	flexShrink: 0,
	background: on ? "#1a5f5a" : "rgba(0,0,0,0.11)",
	border: "none",
	cursor: "pointer",
	transition: "background 200ms ease",
});

export const toggleThumb = (on: boolean): CSSProperties => ({
	position: "absolute",
	top: 2,
	left: on ? 22 : 2,
	width: 20,
	height: 20,
	borderRadius: "50%",
	background: "#fff",
	boxShadow: "0 1px 4px rgba(0,0,0,0.18)",
	transition: "left 220ms cubic-bezier(0.34,1.56,0.64,1)",
});

// ── Slider value pill ─────────────────────────────────────────────────────────
export const sliderValuePill: CSSProperties = {
	fontSize: 12,
	fontWeight: 600,
	color: "#1a5f5a",
	background: "rgba(26,95,90,0.09)",
	padding: "2px 8px",
	borderRadius: 6,
};

// ── Textarea ──────────────────────────────────────────────────────────────────
export const textarea: CSSProperties = {
	width: "100%",
	borderRadius: 14,
	padding: "10px 14px",
	fontSize: 13,
	color: "#2a4a4a",
	background: "rgba(240,251,250,0.85)",
	border: "1.5px solid rgba(45,160,142,0.18)",
	resize: "none",
	outline: "none",
	lineHeight: 1.5,
	boxSizing: "border-box",
	transition: "border-color 150ms ease",
};

export const textareaFocusBorder = "rgba(45,160,142,0.45)";
export const textareaBlurBorder = "rgba(45,160,142,0.18)";

// ── Confirm button (primary gradient) ────────────────────────────────────────
export const confirmButton: CSSProperties = {
	width: "100%",
	padding: "13px 24px",
	borderRadius: 14,
	background: "linear-gradient(135deg, #1a5f5a 0%, #2DBFA0 100%)",
	color: "#fff",
	border: "none",
	fontSize: 14,
	fontWeight: 600,
	cursor: "pointer",
	letterSpacing: "0.01em",
	boxShadow: "0 8px 20px rgba(26,95,90,0.22)",
	transition: "opacity 150ms ease",
};

// ── Cancel link ───────────────────────────────────────────────────────────────
export const cancelLink: CSSProperties = {
	background: "none",
	border: "none",
	cursor: "pointer",
	fontSize: 13,
	color: "#8aadaa",
	textAlign: "center",
	transition: "opacity 150ms ease",
};

// ── Row helpers ───────────────────────────────────────────────────────────────
export const settingRow: CSSProperties = {
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	paddingBottom: 18,
};

export const settingRowLabel: CSSProperties = {
	fontSize: 14,
	fontWeight: 500,
	color: "#1a2a2a",
};

export const settingRowSublabel: CSSProperties = {
	fontSize: 11,
	color: "#9abaaa",
	marginTop: 2,
};

export const sliderHint: CSSProperties = {
	fontSize: 11,
	color: "#9abaaa",
};

// ── Namespace export ──────────────────────────────────────────────────────────
export const MS = {
	keyframes,
	overlay,
	card,
	header,
	headerTitle,
	closeButton,
	body,
	divider,
	sectionLabel,
	optionVariants,
	optionButton,
	optionDot,
	optionLabel,
	toggleTrack,
	toggleThumb,
	sliderValuePill,
	textarea,
	textareaFocusBorder,
	textareaBlurBorder,
	confirmButton,
	cancelLink,
	settingRow,
	settingRowLabel,
	settingRowSublabel,
	sliderHint,
};

export default MS;
