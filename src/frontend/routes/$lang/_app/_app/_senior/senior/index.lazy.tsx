import { createLazyFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { usePageBackgroundStore } from "@/frontend/stores/pageBackground";
import type { CSSProperties } from "react";
import { DS } from "@/frontend/designSystem";
import { api_client } from "@/frontend/utils/api";
import { dictionary } from "@/frontend/assets/i18n";
import { BsFillSkipForwardFill } from "react-icons/bs";
import { HiOutlineBars3, HiOutlineCog6Tooth } from "react-icons/hi2";
import MemoryPairsVoiceGame from "@/frontend/components/games/memoryPairsVoiceGame";
import { useSessionStore } from "@/frontend/stores/session";
import Avatar from "@/frontend/components/ui/avatar";
import {
	THINKING_STATUS_CYCLE_MS,
	VoiceStatus,
} from "@/frontend/components/ui/voice-status";
import { toast } from "react-toastify";
import { useCustomizationStore } from "@/frontend/stores/customization";
import {
	type RealtimeVoiceController,
	startRealtimeVoiceSession,
} from "@/frontend/lib/realtime";
import { UiSoundPlayer } from "@/frontend/lib/ui-sound";
import { synthesizeAssistantSpeech } from "@/frontend/lib/speech";
import {
	MEMORY_GAME_OFFER_TEXT,
	type MemoryGameSessionResult,
} from "@/shared/contracts/chat";
import { buildPostGameSpeechText } from "@/frontend/lib/memory-game";

export const Route = createLazyFileRoute("/$lang/_app/_app/_senior/senior/")({
	component: RouteComponent,
});

const INTERIM_SPEECH_BUBBLE_UPDATE_MS = 150;
const MEMORY_GAME_LAST_PLAYED_AT_KEY = "compy.memoryGame.lastPlayedAt";
const MEMORY_GAME_LAST_OFFERED_AT_KEY = "compy.memoryGame.lastOfferedAt";
const MEMORY_GAME_REPLAY_DELAY_MS = 2 * 24 * 60 * 60 * 1000;
const MEMORY_GAME_OFFER_COOLDOWN_MS = 6 * 60 * 60 * 1000;
const MEMORY_GAME_OFFER_CHANCE = 0;
const INTRO_SOUND_SRC = "/compy-intro.mp3";
const INITIAL_ASSISTANT_GREETINGS = [
	{ text: "Olá, vamos conversar?", audioSrc: "/compy-session-start.mp3" },
	{
		text: "Olá, queres conversar um bocadinho?",
		audioSrc: "/compy-session-start-2.mp3",
	},
	{
		text: "Estou aqui contigo. Vamos conversar?",
		audioSrc: "/compy-session-start-3.mp3",
	},
	{ text: "Olá! Como estás hoje?", audioSrc: "/compy-session-start-4.mp3" },
	{ text: "Vamos falar um pouco?", audioSrc: "/compy-session-start-5.mp3" },
] as const;

const LISTEN_START_SOUND_SRC = "/compy-listen-start.mp3";
const LISTEN_RESUME_SOUND_SRC = "/compy-listen-resume.mp3";
const THINKING_LOOP_SOUND_SRC = "/compy-thinking-loop.mp3";
const WEB_SEARCH_INTRO_REPLY = "Deixa-me pesquisar isso para ti.";
const WEB_SEARCH_INTRO_THINKING_SOUND_DELAY_MS = 1550;
const WEB_SEARCH_INTRO_THINKING_SOUND_FALLBACK_MS = 5000;
const UI_SOUND_SRCS = [
	INTRO_SOUND_SRC,
	...INITIAL_ASSISTANT_GREETINGS.map((greeting) => greeting.audioSrc),
	LISTEN_START_SOUND_SRC,
	LISTEN_RESUME_SOUND_SRC,
	THINKING_LOOP_SOUND_SRC,
];
type MemoryGameIntro = {
	text: string;
	audioBase64?: string;
	audioMimeType?: "audio/mpeg" | "audio/wav";
};

const readTimestampFromStorage = (key: string) => {
	try {
		if (typeof window === "undefined") return 0;
		const raw = localStorage.getItem(key);
		const value = raw ? Number(raw) : 0;
		return Number.isFinite(value) ? value : 0;
	} catch {
		return 0;
	}
};

const writeTimestampToStorage = (key: string, value: number) => {
	try {
		if (typeof window === "undefined") return;
		localStorage.setItem(key, String(value));
	} catch {
		/* best-effort */
	}
};

const canOfferMemoryGame = () => {
	const now = Date.now();
	const lastPlayedAt = readTimestampFromStorage(MEMORY_GAME_LAST_PLAYED_AT_KEY);
	const lastOfferedAt = readTimestampFromStorage(
		MEMORY_GAME_LAST_OFFERED_AT_KEY,
	);

	if (lastPlayedAt && now - lastPlayedAt < MEMORY_GAME_REPLAY_DELAY_MS) {
		return false;
	}

	if (lastOfferedAt && now - lastOfferedAt < MEMORY_GAME_OFFER_COOLDOWN_MS) {
		return false;
	}

	return Math.random() < MEMORY_GAME_OFFER_CHANCE;
};

function sanitizeSpeechText(raw: string): string {
	return (
		raw
			// Remove ElevenLabs voice expression tags like [happy], [sighs], [chuckles]
			.replace(/\[\w[\w\s]*\]/g, "")
			// Replace em dashes with a comma pause
			.replace(/\s*—\s*/g, ", ")
			// Remove emojis
			.replace(/\p{Extended_Pictographic}/gu, "")
			// Strip markdown bold / italic
			.replace(/\*\*(.*?)\*\*/gs, "$1")
			.replace(/\*(.*?)\*/gs, "$1")
			.replace(/_(.*?)_/gs, "$1")
			// Strip markdown headers
			.replace(/^#{1,6}\s+/gm, "")
			// Strip bullet list markers (- / * / + at start of line)
			.replace(/^\s*[-*+]\s+/gm, "")
			// Remove "Label:" patterns (e.g. "sugestões:", "Opções:")
			.replace(/\b[\wÀ-ÿ]+:\s*/g, "")
			// Collapse spaces within a line (but preserve newlines)
			.replace(/[^\S\n]+/g, " ")
			// Collapse multiple consecutive newlines into one
			.replace(/\n{2,}/g, "\n")
			// Trim leading/trailing space on each line
			.replace(/^ +| +$/gm, "")
			.trim()
	);
}

const speechBubbleSurfaceStyle: CSSProperties = {
	background: "rgba(255,255,255,0.96)",
	color: "#111111",
	border: "1px solid rgba(17,75,69,0.12)",
	boxShadow: "0 22px 48px rgba(31,80,73,0.10), 0 6px 16px rgba(0,0,0,0.04)",
	backdropFilter: "blur(18px)",
	WebkitBackdropFilter: "blur(18px)",
};

const speechBubblePointerStyle: CSSProperties = {
	top: "-8px",
	width: 18,
	height: 18,
	background: "rgba(255,255,255,0.96)",
	borderLeft: "1px solid rgba(17,75,69,0.12)",
	borderTop: "1px solid rgba(17,75,69,0.12)",
	boxShadow: "-4px -4px 12px rgba(31,80,73,0.04)",
	backdropFilter: "blur(18px)",
	WebkitBackdropFilter: "blur(18px)",
};

const speechBubbleActionStyle: CSSProperties = {
	background: "rgba(10,74,69,0.08)",
	color: "#0a4a45",
	border: "1px solid rgba(10,74,69,0.12)",
};

type CharTimings = { chars: string[]; startTimesMs: number[] };

const buildEstimatedCharTimings = (text: string): CharTimings => {
	const chars = [...text];
	let elapsed = 0;
	const startTimesMs = chars.map((char) => {
		const start = elapsed;
		if (/[.!?]/.test(char)) {
			elapsed += 70;
		} else if (/[,;:]/.test(char)) {
			elapsed += 38;
		} else if (/\s/.test(char)) {
			elapsed += 6;
		} else {
			elapsed += 22;
		}
		return start;
	});
	return { chars, startTimesMs };
};

const normalizeTimedChar = (char: string) =>
	/\s/.test(char) ? " " : char.toLocaleLowerCase();

const alignTimingsToCleanText = (
	timings: CharTimings,
	clean: string,
): number[] => {
	const rawChars = timings.chars;
	const rawStarts = timings.startTimesMs;
	const cleanChars = [...clean];
	const aligned: number[] = [];
	let rawIndex = 0;
	let fallbackMs = 0;

	for (const cleanChar of cleanChars) {
		const wanted = normalizeTimedChar(cleanChar);
		let matched = false;

		while (rawIndex < rawChars.length) {
			const rawChar = rawChars[rawIndex] ?? "";
			rawIndex += 1;

			if (normalizeTimedChar(rawChar) !== wanted) {
				continue;
			}

			const startMs = rawStarts[rawIndex - 1] ?? fallbackMs;
			aligned.push(startMs);
			fallbackMs = startMs + (/\s/.test(cleanChar) ? 6 : 22);
			matched = true;
			break;
		}

		if (!matched) {
			aligned.push(fallbackMs);
			fallbackMs += /\s/.test(cleanChar) ? 6 : 22;
		}
	}

	return aligned;
};

function SpeakingBubble({
	text,
	onSkip,
	fontSize,
	isSpeaking,
	charTimingsRef,
	speakingStartTimeRef,
	timingVersion = 0,
}: {
	text: string;
	onSkip: () => void;
	fontSize: number;
	isSpeaking: boolean;
	charTimingsRef: { current: CharTimings | null };
	speakingStartTimeRef: { current: number | null };
	timingVersion?: number;
}) {
	const clean = sanitizeSpeechText(text);
	const [revealedCount, setRevealedCount] = useState(0);
	const rafRef = useRef(0);
	const scrollRef = useRef<HTMLDivElement>(null);
	const activeWordRef = useRef<HTMLSpanElement | null>(null);
	const revealStartTimeRef = useRef<number | null>(null);

	useEffect(() => {
		const container = scrollRef.current;
		const word = activeWordRef.current;
		if (!container || !word) return;
		const containerRect = container.getBoundingClientRect();
		const wordRect = word.getBoundingClientRect();
		if (wordRect.bottom > containerRect.bottom) {
			container.scrollTop += wordRect.bottom - containerRect.bottom + 4;
		}
	}, [revealedCount]);

	useEffect(() => {
		cancelAnimationFrame(rafRef.current);

		if (!clean) {
			setRevealedCount(0);
			return;
		}

		if (!isSpeaking) {
			setRevealedCount(clean.length);
			return;
		}

		const timings = charTimingsRef.current;
		const startTime = speakingStartTimeRef.current;

		if (startTime === null) {
			setRevealedCount(0);
			return;
		}

		if (revealStartTimeRef.current !== startTime) {
			revealStartTimeRef.current = startTime;
			setRevealedCount(0);
		} else {
			setRevealedCount((current) => Math.min(current, clean.length));
		}

		const activeTimings =
			timings && timings.chars.length > 0
				? timings
				: buildEstimatedCharTimings(clean);

		const cleanStartTimesMs = alignTimingsToCleanText(activeTimings, clean);
		const maxIdx = cleanStartTimesMs.length;

		const tick = () => {
			const elapsed = performance.now() - startTime;
			let idx = 0;
			while (idx < maxIdx && cleanStartTimesMs[idx] <= elapsed) idx++;
			setRevealedCount(idx);
			if (idx < maxIdx) {
				rafRef.current = requestAnimationFrame(tick);
			} else {
				setRevealedCount(clean.length);
			}
		};
		rafRef.current = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(rafRef.current);
	}, [clean, isSpeaking, charTimingsRef, speakingStartTimeRef, timingVersion]);

	// Build word-level karaoke spans
	const parts = clean.split(/(\s+)/);
	let pos = 0;
	const rendered = parts.map((part, i) => {
		const wordStart = pos;
		pos += part.length;
		const wordEnd = pos;
		if (!part.trim()) return <span key={i}>{part}</span>;
		const isDone = revealedCount >= wordEnd;
		const isActive = revealedCount >= wordStart && revealedCount < wordEnd;
		return (
			<span
				key={i}
				ref={isActive ? activeWordRef : null}
				style={{
					opacity: isDone || isActive ? 1 : 0.32,
					fontWeight: isActive ? 700 : 400,
					transition: "opacity 50ms ease",
				}}
			>
				{part}
			</span>
		);
	});

	return (
		<div className="relative w-full max-w-2xl px-5 sm:px-8 animate-fade-in-up">
			<div
				aria-hidden="true"
				className="absolute left-1/2 -translate-x-1/2 rotate-45"
				style={speechBubblePointerStyle}
			/>
			<div
				className="w-full rounded-[24px] px-7 py-5 text-center flex flex-col sm:px-9 sm:py-6"
				style={speechBubbleSurfaceStyle}
			>
				<div
					ref={scrollRef}
					style={{
						maxHeight: "28vh",
						overflowY: "auto",
						scrollbarWidth: "none",
						msOverflowStyle: "none",
					}}
					className="[&::-webkit-scrollbar]:hidden"
				>
					<p
						style={{
							whiteSpace: "pre-wrap",
							fontSize,
							lineHeight: 1.45,
							letterSpacing: "-0.01em",
							margin: 0,
						}}
					>
						{rendered}
					</p>
				</div>
				<div className="flex justify-center mt-4">
					<button
						type="button"
						className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all hover:opacity-85 active:scale-[0.97]"
						style={speechBubbleActionStyle}
						onClick={onSkip}
					>
						<BsFillSkipForwardFill size={15} />
						Saltar
					</button>
				</div>
			</div>
		</div>
	);
}

// ── Background Editor (temporary dev tool) ────────────────────────────────
interface GlowCircle {
	size: number;
	blur: number;
	opacity: number;
	left: number;
	top: number;
}
interface BgSettings {
	gradAngle: number;
	gradStart: string;
	gradMid: string;
	gradMidStop: number;
	gradEnd: string;
	radialOpacity: number;
	glows: GlowCircle[];
}
type BgPreset = "lilac" | "spring";
const DEFAULT_GLOWS: GlowCircle[] = [
	{ size: 240, blur: 28, opacity: 0.58, left: 22, top: 6 },
	{ size: 200, blur: 24, opacity: 0.52, left: 51, top: 46 },
	{ size: 180, blur: 26, opacity: 0.34, left: 92, top: 25 },
];
const LILAC_BG_SETTINGS: BgSettings = {
	gradAngle: 135,
	gradStart: "#ebe7ff",
	gradMid: "#ffffff",
	gradMidStop: 52,
	gradEnd: "#fffce2",
	radialOpacity: 0.5,
	glows: DEFAULT_GLOWS,
};
const SPRING_BG_SETTINGS: BgSettings = {
	gradAngle: 135,
	gradStart: "#fffce2",
	gradMid: "#ffffff",
	gradMidStop: 52,
	gradEnd: "#b9ebdc",
	radialOpacity: 0.5,
	glows: DEFAULT_GLOWS,
};
const DEFAULT_BG_SETTINGS = SPRING_BG_SETTINGS;
const BG_PRESETS: { id: BgPreset; label: string; settings: BgSettings }[] = [
	{
		id: "lilac",
		label: "Lilás / Branco / Amarelo",
		settings: LILAC_BG_SETTINGS,
	},
	{
		id: "spring",
		label: "Amarelo / Branco / Verde",
		settings: SPRING_BG_SETTINGS,
	},
];
function cloneBgSettings(s: BgSettings): BgSettings {
	return { ...s, glows: s.glows.map((g) => ({ ...g })) };
}
function hexToRgb(hex: string): string {
	const normalized = hex.replace("#", "");
	const full =
		normalized.length === 3
			? normalized
					.split("")
					.map((c) => `${c}${c}`)
					.join("")
			: normalized;
	const value = Number.parseInt(full, 16);
	const r = (value >> 16) & 255;
	const g = (value >> 8) & 255;
	const b = value & 255;
	return `${r}, ${g}, ${b}`;
}
function buildBg(s: BgSettings): string {
	const startRgb = hexToRgb(s.gradStart);
	const endRgb = hexToRgb(s.gradEnd);
	return `radial-gradient(circle at 12% 24%, rgba(${startRgb}, ${Math.min(0.96, s.radialOpacity + 0.22)}) 0%, rgba(${startRgb}, 0.72) 24%, rgba(${startRgb}, 0.18) 42%, rgba(${startRgb}, 0) 58%), radial-gradient(circle at 92% 80%, rgba(${endRgb}, ${Math.max(0.3, s.radialOpacity)}) 0%, rgba(${endRgb}, 0.56) 18%, rgba(${endRgb}, 0.16) 36%, rgba(${endRgb}, 0) 54%), linear-gradient(${s.gradAngle}deg, ${s.gradStart} 0%, ${s.gradMid} ${s.gradMidStop}%, ${s.gradEnd} 100%)`;
}
function BgSlider({
	label,
	value,
	min,
	max,
	step = 1,
	onChange,
}: {
	label: string;
	value: number;
	min: number;
	max: number;
	step?: number;
	onChange: (v: number) => void;
}) {
	return (
		<div className="flex flex-col gap-0.5">
			<div
				className="flex justify-between text-xs"
				style={{ color: "#1a5f5a" }}
			>
				<span>{label}</span>
				<span className="font-semibold">
					{step < 1 ? value.toFixed(2) : value}
				</span>
			</div>
			<input
				type="range"
				min={min}
				max={max}
				step={step}
				value={value}
				onChange={(e) => onChange(Number(e.target.value))}
				className="w-full accent-teal-600"
				style={{ cursor: "pointer" }}
			/>
		</div>
	);
}
function BgColorRow({
	label,
	value,
	onChange,
}: { label: string; value: string; onChange: (v: string) => void }) {
	return (
		<div className="flex items-center gap-2">
			<input
				type="color"
				value={value}
				onChange={(e) => onChange(e.target.value)}
				className="w-8 h-8 rounded cursor-pointer border-0 p-0"
				style={{ backgroundColor: "transparent" }}
			/>
			<span className="text-xs flex-1" style={{ color: "#1a5f5a" }}>
				{label}
			</span>
			<span className="text-xs font-mono" style={{ color: "#3a7a70" }}>
				{value}
			</span>
		</div>
	);
}
function BackgroundEditor({
	onClose,
	onSettingsChange,
}: { onClose: () => void; onSettingsChange: (s: BgSettings) => void }) {
	const [s, setS] = useState<BgSettings>(cloneBgSettings(DEFAULT_BG_SETTINGS));

	useEffect(() => {
		onSettingsChange(s);
	}, [s, onSettingsChange]);

	const patchGlow = (i: number, patch: Partial<GlowCircle>) => {
		setS((prev) => ({
			...prev,
			glows: prev.glows.map((g, idx) => (idx === i ? { ...g, ...patch } : g)),
		}));
	};
	const addGlow = () => {
		setS((prev) => ({
			...prev,
			glows: [
				...prev.glows,
				{ size: 200, blur: 25, opacity: 0.45, left: 50, top: 50 },
			],
		}));
	};
	const removeGlow = (i: number) => {
		setS((prev) => ({
			...prev,
			glows: prev.glows.filter((_, idx) => idx !== i),
		}));
	};
	const exportSettings = () => {
		const blob = new Blob([JSON.stringify(s, null, 2)], {
			type: "application/json",
		});
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = "bg-settings.json";
		a.click();
		URL.revokeObjectURL(url);
	};
	return (
		<div
			style={{
				position: "fixed",
				top: 0,
				right: 0,
				bottom: 0,
				width: 300,
				zIndex: 9999,
				display: "flex",
				flexDirection: "column",
			}}
		>
			{/* Controls panel */}
			<div
				style={{
					flex: 1,
					background: "#f0fbfa",
					overflowY: "auto",
					padding: 16,
					display: "flex",
					flexDirection: "column",
					gap: 12,
					boxShadow: "-4px 0 20px rgba(0,0,0,0.12)",
				}}
			>
				<div className="flex items-center justify-between">
					<p className="font-bold text-base" style={{ color: "#0a4a45" }}>
						Editor de Fundo
					</p>
					<button
						type="button"
						onClick={onClose}
						className="text-xs px-3 py-1 rounded-lg transition-opacity hover:opacity-70"
						style={{ background: "rgba(26,95,90,0.1)", color: "#1a5f5a" }}
					>
						Fechar
					</button>
				</div>
				<div
					className="flex flex-col gap-2 pt-2 border-t"
					style={{ borderColor: "rgba(26,95,90,0.1)" }}
				>
					<p
						className="text-xs font-bold uppercase tracking-widest"
						style={{ color: "#1a5f5a" }}
					>
						Predefinidos
					</p>
					<div className="grid grid-cols-1 gap-2">
						{BG_PRESETS.map((preset) => (
							<button
								key={preset.id}
								type="button"
								onClick={() => setS(cloneBgSettings(preset.settings))}
								className="w-full py-2 rounded-xl text-sm font-medium text-left px-3 transition-opacity hover:opacity-80"
								style={{ background: "rgba(26,95,90,0.08)", color: "#1a5f5a" }}
							>
								{preset.label}
							</button>
						))}
					</div>
				</div>
				<div
					className="flex flex-col gap-2 pt-2 border-t"
					style={{ borderColor: "rgba(26,95,90,0.1)" }}
				>
					<p
						className="text-xs font-bold uppercase tracking-widest"
						style={{ color: "#1a5f5a" }}
					>
						Gradiente
					</p>
					<BgSlider
						label="Ângulo"
						value={s.gradAngle}
						min={0}
						max={360}
						onChange={(v) => setS((p) => ({ ...p, gradAngle: v }))}
					/>
					<BgColorRow
						label="Cor inicial"
						value={s.gradStart}
						onChange={(v) => setS((p) => ({ ...p, gradStart: v }))}
					/>
					<BgColorRow
						label="Cor intermédia"
						value={s.gradMid}
						onChange={(v) => setS((p) => ({ ...p, gradMid: v }))}
					/>
					<BgSlider
						label="Ponto médio %"
						value={s.gradMidStop}
						min={0}
						max={100}
						onChange={(v) => setS((p) => ({ ...p, gradMidStop: v }))}
					/>
					<BgColorRow
						label="Cor final"
						value={s.gradEnd}
						onChange={(v) => setS((p) => ({ ...p, gradEnd: v }))}
					/>
				</div>
				<div
					className="flex flex-col gap-2 pt-2 border-t"
					style={{ borderColor: "rgba(26,95,90,0.1)" }}
				>
					<p
						className="text-xs font-bold uppercase tracking-widest"
						style={{ color: "#1a5f5a" }}
					>
						Brilho radial
					</p>
					<BgSlider
						label="Opacidade"
						value={s.radialOpacity}
						min={0}
						max={1}
						step={0.01}
						onChange={(v) => setS((p) => ({ ...p, radialOpacity: v }))}
					/>
				</div>
				<div
					className="flex flex-col gap-3 pt-2 border-t"
					style={{ borderColor: "rgba(26,95,90,0.1)" }}
				>
					<div className="flex items-center justify-between">
						<p
							className="text-xs font-bold uppercase tracking-widest"
							style={{ color: "#1a5f5a" }}
						>
							Círculos ({s.glows.length})
						</p>
						<button
							type="button"
							onClick={addGlow}
							className="text-xs px-2 py-1 rounded-lg font-semibold transition-opacity hover:opacity-80"
							style={{ background: "#1a5f5a", color: "#fff" }}
						>
							+ Adicionar
						</button>
					</div>
					{s.glows.map((g, i) => (
						<div
							key={i}
							className="flex flex-col gap-2 rounded-xl p-3"
							style={{ background: "rgba(26,95,90,0.06)" }}
						>
							<div className="flex items-center justify-between">
								<p
									className="text-xs font-semibold"
									style={{ color: "#1a5f5a" }}
								>
									Círculo {i + 1}
								</p>
								<button
									type="button"
									onClick={() => removeGlow(i)}
									className="text-xs px-2 py-0.5 rounded-lg transition-opacity hover:opacity-80"
									style={{
										background: "rgba(185,28,28,0.1)",
										color: "#b91c1c",
									}}
								>
									Remover
								</button>
							</div>
							<BgSlider
								label="Tamanho"
								value={g.size}
								min={20}
								max={600}
								onChange={(v) => patchGlow(i, { size: v })}
							/>
							<BgSlider
								label="Blur"
								value={g.blur}
								min={1}
								max={120}
								onChange={(v) => patchGlow(i, { blur: v })}
							/>
							<BgSlider
								label="Opacidade"
								value={g.opacity}
								min={0}
								max={1}
								step={0.01}
								onChange={(v) => patchGlow(i, { opacity: v })}
							/>
							<BgSlider
								label="Left %"
								value={g.left}
								min={-20}
								max={120}
								onChange={(v) => patchGlow(i, { left: v })}
							/>
							<BgSlider
								label="Top %"
								value={g.top}
								min={-20}
								max={120}
								onChange={(v) => patchGlow(i, { top: v })}
							/>
						</div>
					))}
				</div>
				<div
					className="flex flex-col gap-2 pt-4 border-t"
					style={{ borderColor: "rgba(26,95,90,0.1)" }}
				>
					<button
						type="button"
						onClick={() => setS(cloneBgSettings(DEFAULT_BG_SETTINGS))}
						className="w-full py-2 rounded-xl text-sm font-medium transition-opacity hover:opacity-80"
						style={{ background: "rgba(26,95,90,0.1)", color: "#1a5f5a" }}
					>
						Repor valores
					</button>
					<button
						type="button"
						onClick={exportSettings}
						className="w-full py-2 rounded-xl text-sm font-semibold transition-opacity hover:opacity-90"
						style={{ background: "#1a5f5a", color: "#fff" }}
					>
						⬇ Exportar bg-settings.json
					</button>
				</div>
			</div>
		</div>
	);
}

const styles: Record<string, CSSProperties> = {
	screen: {
		height: "100%",
		minHeight: "100%",
		maxHeight: "100%",
		width: "100%",
		background:
			"radial-gradient(circle at 12% 24%, rgba(255,252,226,0.96) 0%, rgba(255,252,226,0.74) 24%, rgba(255,252,226,0.18) 42%, rgba(255,252,226,0) 58%), radial-gradient(circle at 92% 80%, rgba(185,235,220,0.86) 0%, rgba(185,235,220,0.52) 18%, rgba(185,235,220,0.14) 36%, rgba(185,235,220,0) 54%), linear-gradient(135deg, #fffce2 0%, #ffffff 52%, #b9ebdc 100%)",
		display: "flex",
		justifyContent: "center",
		overflow: "hidden",
		position: "relative",
	},
	safe: {
		position: "relative",
		width: "100%",
		height: "100%",
		minHeight: "100%",
		padding: "calc(18px + var(--sat, 0px)) 18px calc(38px + var(--sab, 0px))",
		boxSizing: "border-box",
		overflow: "hidden",
		display: "flex",
		flexDirection: "column",
	},
	header: {
		position: "relative",
		zIndex: 3,
		display: "flex",
		justifyContent: "space-between",
		alignItems: "center",
		marginBottom: 8,
	},
	headerActions: {
		display: "inline-flex",
		alignItems: "center",
		gap: 10,
	},
};

type ChatMessageWithComplete = {
	content: string;
	role: "user" | "assistant";
};

const PORTUGUESE_EUROPEAN_LOCALE = "pt-PT";

// Ecrã principal do modo "senior", incluindo a orquestração do chat de voz realtime.
const SENIOR_BG =
	"radial-gradient(circle at 12% 24%, rgba(255,252,226,0.96) 0%, rgba(255,252,226,0.74) 24%, rgba(255,252,226,0.18) 42%, rgba(255,252,226,0) 58%), radial-gradient(circle at 92% 80%, rgba(185,235,220,0.86) 0%, rgba(185,235,220,0.52) 18%, rgba(185,235,220,0.14) 36%, rgba(185,235,220,0) 54%), linear-gradient(135deg, #fffce2 0%, #ffffff 52%, #b9ebdc 100%)";
const SENIOR_BG_SLEEP = SENIOR_BG;
const SENIOR_BG_AWAKE = SENIOR_BG;

function RouteComponent() {
	const { lang } = Route.useParams();
	const { session, setSession } = useSessionStore();
	const t = dictionary(lang);
	const setPageBackground = usePageBackgroundStore((s) => s.setBackground);
	const setFooterOverlay = usePageBackgroundStore((s) => s.setFooterOverlay);
	const globalBackground = usePageBackgroundStore((s) => s.globalBackground);

	const conversationCount = session?.user.conversationCount ?? 0;
	const requiresTermsAcceptance =
		session?.user.role === "senior" && !session.user.termsAcceptedAt;

	// Mantém a experiência de voz fixa em português europeu, independentemente da rota.
	const langCode = () => PORTUGUESE_EUROPEAN_LOCALE;

	const [active, setActive] = useState(false);
	const [showEndModal, setShowEndModal] = useState(false);
	const [showSettings, setShowSettings] = useState(false);
	const [showMemoryGame, setShowMemoryGame] = useState(false);
	const [memoryGameCompleteIdle, setMemoryGameCompleteIdle] = useState(false);
	const pendingMemoryGameStart = useRef(false);
	const pendingMemoryGameIntro = useRef<MemoryGameIntro | null>(null);
	const memoryGameOfferInFlightRef = useRef(false);
	const memoryGameOfferCancelTokenRef = useRef(0);
	const gameKeepaliveRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const pendingVoiceEndRequestRef = useRef(false);
	const [memoryGameIntro, setMemoryGameIntro] =
		useState<MemoryGameIntro | null>(null);
	const [bubbleFontSize, setBubbleFontSize] = useState(30); // px, 16 – 40

	// Load persisted UI settings on mount
	useEffect(() => {
		try {
			const saved = localStorage.getItem("seniorUISettings");
			if (saved) {
				const s = JSON.parse(saved);
				if (s.bubbleFontSize !== undefined) setBubbleFontSize(s.bubbleFontSize);
			}
		} catch {
			/* ignore */
		}
	}, []);

	// Persist UI settings whenever they change
	useEffect(() => {
		try {
			localStorage.setItem(
				"seniorUISettings",
				JSON.stringify({
					bubbleFontSize,
				}),
			);
		} catch {
			/* ignore */
		}
	}, [bubbleFontSize]);
	const [pendingOutcome, setPendingOutcome] = useState<
		"Sucesso" | "Cancelada" | "Falha" | null
	>(null);
	const [sessionNote, setSessionNote] = useState("");

	const [chatLoading, setChatLoading] = useState(false);
	const [isAcceptingTerms, setIsAcceptingTerms] = useState(false);

	const [, setChatMessages] = useState<ChatMessageWithComplete[]>([]);

	const [listening, setListening] = useState(false);
	const realtimeSession = useRef<RealtimeVoiceController | null>(null);
	const realtimeSessionConnecting = useRef(false);
	const realtimeAssistantBuffer = useRef("");
	const realtimeAssistantDone = useRef(false);
	const interimSpeechBubbleTimer = useRef<ReturnType<typeof setTimeout> | null>(
		null,
	);
	const pendingInterimSpeechBubbleText = useRef<string | null>(null);
	const lastInterimSpeechBubbleUpdateAt = useRef(0);
	const [isRealtimeConnecting, setIsRealtimeConnecting] = useState(false);

	const [isSpeaking, setIsSpeaking] = useState(false);
	const [isSkipping, setIsSkipping] = useState(false);

	const [chatCardContent, setChatCardContent] = useState<string>("");
	const hasSpokenOnce = useRef(false);
	const [lastSpokenText, setLastSpokenText] = useState("");
	const pendingAssistantFinalTextRef = useRef("");
	const webSearchTurnActiveRef = useRef(false);
	const charTimingsRef = useRef<{
		chars: string[];
		startTimesMs: number[];
	} | null>(null);
	const [charTimingVersion, setCharTimingVersion] = useState(0);
	const speakingStartTimeRef = useRef<number | null>(null);
	const [showThinkingStatus, setShowThinkingStatus] = useState(false);
	const [deferThinkingLoopSound, setDeferThinkingLoopSound] = useState(false);
	const thinkingStatusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
		null,
	);
	const thinkingLoopSoundReleaseTimerRef =
		useRef<ReturnType<typeof setTimeout> | null>(null);
	const pendingWebSearchIntroAudioRef = useRef(false);
	const uiSoundPlayerRef = useRef<UiSoundPlayer | null>(null);
	const initialGreetingAudioRef = useRef<HTMLAudioElement | null>(null);
	const shouldPlayListenResumeSoundRef = useRef(false);
	const hasAvatarGlow =
		listening || chatLoading || isSpeaking || isSkipping || memoryGameCompleteIdle;
	const currentSeniorBackground =
		globalBackground ?? (hasAvatarGlow ? SENIOR_BG_AWAKE : SENIOR_BG_SLEEP);
	const seniorDisplayName =
		session?.user.nickname?.trim() ||
		session?.user.name?.trim().split(/\s+/)[0] ||
		"Olá";

	useEffect(() => {
		setPageBackground(currentSeniorBackground);
		setFooterOverlay(true);
		return () => {
			setPageBackground(null);
			setFooterOverlay(false);
		};
	}, [currentSeniorBackground, setFooterOverlay, setPageBackground]);

	const { silenceTimeoutMs, setSilenceTimeoutMs, setChatPersonality } =
		useCustomizationStore();

	const chatWindow = useRef<HTMLDivElement>(null);
	const persistentSubtitleScrollRef = useRef<HTMLDivElement>(null);

	const getUiSoundPlayer = () => {
		if (!uiSoundPlayerRef.current) {
			uiSoundPlayerRef.current = new UiSoundPlayer();
		}
		return uiSoundPlayerRef.current;
	};

	const prepareUiSounds = async (audioContext: AudioContext) => {
		const player = getUiSoundPlayer();
		await player.unlock(audioContext);
		player.preload(UI_SOUND_SRCS);
	};

	const clearThinkingLoopSoundReleaseTimer = () => {
		if (thinkingLoopSoundReleaseTimerRef.current) {
			clearTimeout(thinkingLoopSoundReleaseTimerRef.current);
			thinkingLoopSoundReleaseTimerRef.current = null;
		}
	};

	const releaseThinkingLoopSound = () => {
		clearThinkingLoopSoundReleaseTimer();
		pendingWebSearchIntroAudioRef.current = false;
		setDeferThinkingLoopSound(false);
	};

	const deferThinkingLoopSoundUntilWebSearchIntro = () => {
		pendingWebSearchIntroAudioRef.current = true;
		setDeferThinkingLoopSound(true);
		clearThinkingLoopSoundReleaseTimer();
		thinkingLoopSoundReleaseTimerRef.current = setTimeout(
			releaseThinkingLoopSound,
			WEB_SEARCH_INTRO_THINKING_SOUND_FALLBACK_MS,
		);
	};

	const scheduleThinkingLoopSoundAfterWebSearchIntro = () => {
		if (!pendingWebSearchIntroAudioRef.current) return;
		clearThinkingLoopSoundReleaseTimer();
		thinkingLoopSoundReleaseTimerRef.current = setTimeout(
			releaseThinkingLoopSound,
			WEB_SEARCH_INTRO_THINKING_SOUND_DELAY_MS,
		);
	};

	const resetWebSearchTurnUiState = () => {
		pendingAssistantFinalTextRef.current = "";
		webSearchTurnActiveRef.current = false;
		releaseThinkingLoopSound();
	};

	useEffect(() => {
		if (persistentSubtitleScrollRef.current) {
			persistentSubtitleScrollRef.current.scrollTop = 0;
		}
	}, [lastSpokenText]);

	/**
	 * Throttles interim STT updates so the large senior screen does not re-render
	 * on every partial transcript frame while the background animations are active.
	 */
	const scheduleInterimSpeechBubbleUpdate = (nextText: string) => {
		if (!nextText) {
			pendingInterimSpeechBubbleText.current = null;
			if (interimSpeechBubbleTimer.current) {
				clearTimeout(interimSpeechBubbleTimer.current);
				interimSpeechBubbleTimer.current = null;
			}
			setChatCardContent("");
			lastInterimSpeechBubbleUpdateAt.current = performance.now();
			return;
		}

		const applyUpdate = (text: string) => {
			pendingInterimSpeechBubbleText.current = null;
			interimSpeechBubbleTimer.current = null;
			lastInterimSpeechBubbleUpdateAt.current = performance.now();
			setChatCardContent(text);
		};

		const now = performance.now();
		const elapsed = now - lastInterimSpeechBubbleUpdateAt.current;
		if (elapsed >= INTERIM_SPEECH_BUBBLE_UPDATE_MS) {
			applyUpdate(nextText);
			return;
		}

		pendingInterimSpeechBubbleText.current = nextText;
		if (interimSpeechBubbleTimer.current) {
			return;
		}

		interimSpeechBubbleTimer.current = setTimeout(() => {
			if (pendingInterimSpeechBubbleText.current) {
				applyUpdate(pendingInterimSpeechBubbleText.current);
			}
		}, INTERIM_SPEECH_BUBBLE_UPDATE_MS - elapsed);
	};

	// Cancela qualquer update diferido do balão de fala quando o ecrã é desmontado.
	useEffect(() => {
		return () => {
			if (interimSpeechBubbleTimer.current) {
				clearTimeout(interimSpeechBubbleTimer.current);
				interimSpeechBubbleTimer.current = null;
			}
			clearThinkingLoopSoundReleaseTimer();
		};
	}, []);

	// Persiste a aceitacao dos termos no backend e atualiza a sessao local com a resposta oficial.
	const acceptTos = async () => {
		if (!session) {
			return;
		}

		setIsAcceptingTerms(true);

		try {
			const response = await api_client.onboarding.complete.$post();
			if (!response.ok) {
				const error = await response.text();
				throw new Error(error || "FAILED_TO_ACCEPT_TERMS");
			}

			const updatedSession = await response.json();
			setSession(updatedSession);
			toast.success("Termos aceites com sucesso.");
		} catch (error) {
			console.error("Failed to accept terms:", error);
			toast.error("Nao foi possivel aceitar os termos. Tenta novamente.");
		} finally {
			setIsAcceptingTerms(false);
		}
	};

	// Carrega preferências guardadas que afetam o comportamento da conversa (silêncio, voz, idioma, etc.).
	const fetchPreferences = async () => {
		const seniorId = session?.user.id;

		// Aguarda pela hidratação da sessão antes de chamar a API de preferências.
		if (!seniorId) {
			return;
		}

		const res = await api_client.seniors[":seniorId"]["senior-settings"].$get({
			param: {
				seniorId,
			},
		});
		if (!res.ok) {
			return;
		}
		const data = await res.json();
		setSilenceTimeoutMs(data.silenceTimeoutMs);
		setChatPersonality(data.chatPersonality);
	};

	useEffect(() => {
		void fetchPreferences();
	}, [session?.user.id]);

	useEffect(() => {
		getUiSoundPlayer().play(INTRO_SOUND_SRC);
		return () => {
			uiSoundPlayerRef.current?.stopAll();
		};
	}, []);

	// Fecha completamente a sessão realtime ativa e limpa o estado visual relacionado com a conversa.
	// Retorna uma Promise que resolve quando o close da conversa termina, para que
	// o chamador possa sair do ecrã apenas depois do outcome ser guardado no backend.
	const stopRealtimeSession = async (outcome?: {
		userOutcome?: "Sucesso" | "Cancelada" | "Falha";
		userNote?: string;
	}) => {
		memoryGameOfferCancelTokenRef.current += 1;
		pendingVoiceEndRequestRef.current = false;
		pendingMemoryGameStart.current = false;
		pendingMemoryGameIntro.current = null;
		shouldPlayListenResumeSoundRef.current = false;
		realtimeSessionConnecting.current = false;
		// hasRecordedConversationRef is intentionally NOT reset here — a single conversation
		// record is counted per app session (page load), not per individual talk.
		setIsRealtimeConnecting(false);

		// Capture and immediately null the ref so stale callbacks (onAssistantTranscriptDelta,
		// onEvent) that check realtimeSession.current can detect the session is gone and
		// skip their setActive(true) calls — giving immediate visual feedback to the user.
		const sessionToStop = realtimeSession.current;
		realtimeSession.current = null;

		// Reset all visual state immediately so the avatar sleeps right away.
		realtimeAssistantBuffer.current = "";
		realtimeAssistantDone.current = false;
		resetWebSearchTurnUiState();
		setListening(false);
		setChatLoading(false);
		setIsSpeaking(false);
		setIsSkipping(false);
		setChatCardContent("");
		setLastSpokenText("");
		hasSpokenOnce.current = false;
		if (initialGreetingAudioRef.current) {
			initialGreetingAudioRef.current.pause();
			initialGreetingAudioRef.current.currentTime = 0;
			initialGreetingAudioRef.current = null;
		}
		charTimingsRef.current = null;
		setCharTimingVersion((version) => version + 1);
		speakingStartTimeRef.current = null;
		setActive(false);

		// Tear down the session in the background — network calls (conversation close)
		// happen here but must not block the UI from reflecting the stopped state.
		if (sessionToStop) {
			await sessionToStop.stop(outcome);
		}
	};

	const maybeOfferMemoryGameAfterResponse = () => {
		if (
			requiresTermsAcceptance ||
			showMemoryGame ||
			pendingMemoryGameStart.current ||
			memoryGameOfferInFlightRef.current ||
			!realtimeSession.current ||
			!canOfferMemoryGame()
		) {
			return;
		}

		memoryGameOfferInFlightRef.current = true;
		const offerToken = memoryGameOfferCancelTokenRef.current;
		window.setTimeout(() => {
			void (async () => {
				try {
					if (
						offerToken !== memoryGameOfferCancelTokenRef.current ||
						!realtimeSession.current
					) {
						return;
					}

					const speech = await synthesizeAssistantSpeech(
						MEMORY_GAME_OFFER_TEXT,
					);

					if (
						!speech.audio_base64 ||
						offerToken !== memoryGameOfferCancelTokenRef.current ||
						!realtimeSession.current
					) {
						return;
					}

					writeTimestampToStorage(MEMORY_GAME_LAST_OFFERED_AT_KEY, Date.now());
					realtimeSession.current?.noteMemoryGameOffer(MEMORY_GAME_OFFER_TEXT);
					resetWebSearchTurnUiState();
					setChatMessages((messages) => [
						...messages,
						{ content: MEMORY_GAME_OFFER_TEXT, role: "assistant" },
					]);
					setChatCardContent(MEMORY_GAME_OFFER_TEXT);
					setLastSpokenText(MEMORY_GAME_OFFER_TEXT);
					hasSpokenOnce.current = true;
					setActive(true);

					await realtimeSession.current?.playAssistantPrompt(
						speech.audio_base64,
						speech.audio_mime_type,
					);
				} catch (error) {
					console.warn("Failed to offer memory game:", error);
				} finally {
					memoryGameOfferInFlightRef.current = false;
				}
			})();
		}, 900);
	};

	const returnFromMemoryGame = async (result: MemoryGameSessionResult) => {
		setMemoryGameCompleteIdle(false);
		if (gameKeepaliveRef.current) {
			clearInterval(gameKeepaliveRef.current);
			gameKeepaliveRef.current = null;
		}

		setShowMemoryGame(false);
		setMemoryGameIntro(null);
		pendingMemoryGameIntro.current = null;
		const speechText = buildPostGameSpeechText(result);
		const sessionAtReturn = realtimeSession.current;

		if (!sessionAtReturn) {
			// Session was lost during game — create it without opening the mic yet.
			await startRealtimeListening({
				startListening: false,
				playStartSound: false,
			});
		}

		realtimeSession.current?.noteMemoryGameCompleted(speechText);

		if (!realtimeSession.current) return;
		try {
			const speech = await synthesizeAssistantSpeech(speechText);
			if (!speech.audio_base64 || !realtimeSession.current) return;
			resetWebSearchTurnUiState();
			setChatCardContent(speechText);
			setLastSpokenText(speechText);
			hasSpokenOnce.current = true;
			setChatMessages((msgs) => [
				...msgs,
				{ content: speechText, role: "assistant" },
			]);
			setActive(true);
			await realtimeSession.current.playAssistantPrompt(
				speech.audio_base64,
				speech.audio_mime_type,
			);
		} catch {
			// silent — session active, senior can speak normally
		} finally {
			await realtimeSession.current?.startListening();
		}
	};

	const openMemoryGameAfterCompyReply = () => {
		pendingMemoryGameStart.current = false;
		setMemoryGameCompleteIdle(false);
		writeTimestampToStorage(MEMORY_GAME_LAST_PLAYED_AT_KEY, Date.now());
		setMemoryGameIntro(pendingMemoryGameIntro.current);
		realtimeSession.current?.pauseMic();
		gameKeepaliveRef.current = setInterval(() => {
			realtimeSession.current?.sendKeepalive();
		}, 60_000);
		setShowMemoryGame(true);
	};

	// biome-ignore lint/correctness/useExhaustiveDependencies: unmount cleanup
	useEffect(() => {
		return () => {
			if (gameKeepaliveRef.current) {
				clearInterval(gameKeepaliveRef.current);
				gameKeepaliveRef.current = null;
			}
			void stopRealtimeSession();
		};
	}, []);

	// Envia um prompt de texto para a sessão realtime (criando a sessão primeiro, se necessário).
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	const sendChatPrompt = async (v: string, _lang: string) => {
		if (requiresTermsAcceptance) return;
		const promptToSend = v.trim();
		if (!promptToSend) return;

		// Garante que existe sessão realtime antes de enviar texto para o assistente.
		if (!realtimeSession.current) {
			await startRealtimeListening();
		}
		if (!realtimeSession.current) {
			return;
		}

		setChatMessages((messages) => [
			...messages,
			{ content: promptToSend, role: "user" },
		]);
		setChatCardContent("");
		realtimeAssistantBuffer.current = "";
		realtimeAssistantDone.current = false;
		setChatLoading(true);
		setActive(true);
		realtimeSession.current.sendTextMessage(promptToSend);
	};

	// Para a escuta e, opcionalmente, mantém o cartão visual ativo sem destruir a sessão.
	const stopListening = (keepActive?: boolean) => {
		if (!keepActive) {
			// Clear subtitle state eagerly so the UI transitions immediately
			// rather than waiting for the async stopRealtimeSession to finish.
			hasSpokenOnce.current = false;
			setLastSpokenText("");
			void stopRealtimeSession();
		}
		setChatCardContent("");
		setListening(!!keepActive);
	};

	// biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
	useEffect(() => {
		// Only go to sleep if there is no active realtime session. When a session is alive
		// (e.g. right after pressing "Saltar"), listening may briefly stop without content,
		// but Compy should stay awake so the user can keep talking.
		if (!listening && active && !chatCardContent && !realtimeSession.current) {
			setActive(false);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [listening]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
	useEffect(() => {
		if (!active && !!chatCardContent) {
			setChatCardContent("");
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [active]);

	// Delays the thinking status label by 2.5s so the blue glow appears first,
	// giving the impression that processing is faster than it is.
	useEffect(() => {
		if (chatLoading) {
			thinkingStatusTimerRef.current = setTimeout(() => {
				setShowThinkingStatus(true);
			}, 1800);
		} else {
			if (thinkingStatusTimerRef.current) {
				clearTimeout(thinkingStatusTimerRef.current);
				thinkingStatusTimerRef.current = null;
			}
			setShowThinkingStatus(false);
		}
		return () => {
			if (thinkingStatusTimerRef.current) {
				clearTimeout(thinkingStatusTimerRef.current);
				thinkingStatusTimerRef.current = null;
			}
		};
	}, [chatLoading]);

	useEffect(() => {
		const shouldPlayThinkingLoop =
			chatLoading && showThinkingStatus && !deferThinkingLoopSound;
		const player = getUiSoundPlayer();

		if (shouldPlayThinkingLoop) {
			player.startLoop(THINKING_LOOP_SOUND_SRC, {
				playbackRate: 3.024 / (THINKING_STATUS_CYCLE_MS / 1000),
			});
		} else {
			player.stopLoop(THINKING_LOOP_SOUND_SRC);
		}

		return () => {
			player.stopLoop(THINKING_LOOP_SOUND_SRC);
		};
	}, [chatLoading, showThinkingStatus, deferThinkingLoopSound]);

	// Cancela apenas a resposta atual do assistente, mantendo a sessão aberta para continuar a conversar.
	const skipSpeaking = async () => {
		realtimeSession.current?.cancelResponse();
		realtimeAssistantBuffer.current = "";
		realtimeAssistantDone.current = false;
		setIsSpeaking(false);
		// Signal "skipping" so the avatar keeps glowing while the WebSocket turn
		// finishes on the backend (response.cancel is advisory — the server completes
		// the current turn before the finally block resumes listening).
		// Using a dedicated flag instead of chatLoading avoids desyncing the
		// internal realtime.ts `thinking` variable, which would break subsequent turns.
		// isSkipping is cleared automatically when listening resumes (onListeningChange)
		// or when the session is stopped (stopRealtimeSession).
		setIsSkipping(true);
		setChatCardContent("");
	};

	// Abre (ou reutiliza) a sessão realtime, liga callbacks da UI e inicia o fluxo de voz com a configuração atual.
	const startRealtimeListening = async (
		options: { startListening?: boolean; playStartSound?: boolean } = {},
	) => {
		const shouldStartListening = options.startListening ?? true;
		const shouldPlayStartSound = options.playStartSound ?? true;
		if (requiresTermsAcceptance) {
			return;
		}

		// Reutiliza a sessão existente se ela já estiver aberta.
		if (realtimeSession.current) {
			if (shouldStartListening) {
				await realtimeSession.current.startListening();
			}
			setActive(true);
			return;
		}

		// Evita abrir duas sessões em paralelo (ex.: toque duplo enquanto a sessão ainda está a ligar).
		if (realtimeSessionConnecting.current) {
			setActive(true);
			return;
		}

		try {
			realtimeSessionConnecting.current = true;
			setIsRealtimeConnecting(true);

			// Cria o AudioContext de forma síncrona enquanto ainda estamos dentro do gesto do utilizador.
			// Isto é necessário no iOS para desbloquear a reprodução de áudio fora de gestos futuros.
			const audioCtx = new AudioContext();
			void audioCtx.resume().catch(() => {});
			await prepareUiSounds(audioCtx).catch(() => {});
			if (shouldPlayStartSound) {
				playListenStartSound();
			}

			// Cria a sessão de voz com a configuração atual e callbacks para refletir o estado no UI.
			realtimeSession.current = await startRealtimeVoiceSession({
				audioContext: audioCtx,
				session: {
					input_audio_transcription: {
						language: langCode(),
					},
					max_response_output_tokens: 150,
					turn_detection: {
						type: "local_vad",
						silence_duration_ms: silenceTimeoutMs,
						interrupt_response: true,
					},
				},
				onEvent: (event) => {
					if (event.type === "input_audio_buffer.speech_started") {
						memoryGameOfferCancelTokenRef.current += 1;
					}

					if (event.type === "memory.game.start") {
						pendingMemoryGameStart.current = true;
						const audioMimeType =
							event.intro_audio_mime_type === "audio/mpeg" ||
							event.intro_audio_mime_type === "audio/wav"
								? event.intro_audio_mime_type
								: undefined;
						pendingMemoryGameIntro.current = {
							text:
								typeof event.intro_text === "string" ? event.intro_text : "",
							audioBase64:
								typeof event.intro_audio_base64 === "string"
									? event.intro_audio_base64
									: undefined,
							audioMimeType,
						};
						return;
					}

					if (event.type === "conversation.end.requested") {
						pendingVoiceEndRequestRef.current = true;
						return;
					}

					if (
						event.type === "response.done" &&
						pendingVoiceEndRequestRef.current
					) {
						releaseThinkingLoopSound();
						pendingVoiceEndRequestRef.current = false;
						void stopRealtimeSession();
						return;
					}

					if (
						event.type === "response.done" &&
						pendingMemoryGameStart.current
					) {
						releaseThinkingLoopSound();
						window.setTimeout(openMemoryGameAfterCompyReply, 250);
						return;
					}

					if (event.type === "response.done") {
						releaseThinkingLoopSound();
						maybeOfferMemoryGameAfterResponse();
						return;
					}

					if (event.type === "response.failed") {
						releaseThinkingLoopSound();
						pendingMemoryGameStart.current = false;
					}

					if (event.type === "transcript.interim") {
						if (!realtimeSession.current) return;
						const interimText =
							typeof event.text === "string" ? event.text.trim() : "";

						if (!interimText) {
							return;
						}
						scheduleInterimSpeechBubbleUpdate(interimText);
						setActive(true);
						return;
					}
					// Quando uma nova resposta começa, limpamos o buffer de texto incremental.
					if (event.type === "response.created") {
						memoryGameOfferCancelTokenRef.current += 1;
						realtimeAssistantBuffer.current = "";
						realtimeAssistantDone.current = false;
						pendingAssistantFinalTextRef.current = "";
						webSearchTurnActiveRef.current = false;
						charTimingsRef.current = null;
						setCharTimingVersion((version) => version + 1);
						scheduleInterimSpeechBubbleUpdate("");
					}
				},
				onListeningChange: (v) => {
					setListening(v);
					if (v) {
						setIsSkipping(false);
						if (shouldPlayListenResumeSoundRef.current) {
							shouldPlayListenResumeSoundRef.current = false;
							playListenResumeSound();
						}
					}
				},
				onThinkingChange: (thinking) => {
					// Sincroniza o estado visual de "pensando" com o estado do modelo.
					setChatLoading(thinking);
					if (thinking) setLastSpokenText("");
				},
				onUserTranscript: (text) => {
					// Guarda a transcrição final da fala do utilizador no histórico local visível.
					const transcript = text.trim();
					if (!transcript) return;
					setChatMessages((messages) => [
						...messages,
						{ content: transcript, role: "user" },
					]);
				},
				onAssistantTranscriptDelta: (delta) => {
					// Accumulate streaming text internally. For web search turns, reveal
					// only the short spoken acknowledgement immediately; the actual
					// search result is shown once its TTS audio starts playing.
					if (!delta || !realtimeSession.current) return;
					if (
						delta.includes(WEB_SEARCH_INTRO_REPLY) &&
						!pendingWebSearchIntroAudioRef.current
					) {
						webSearchTurnActiveRef.current = true;
						deferThinkingLoopSoundUntilWebSearchIntro();
						setChatCardContent(WEB_SEARCH_INTRO_REPLY);
					}
					realtimeAssistantBuffer.current += delta;
					setActive(true);
				},
				onAssistantTranscriptDone: (text) => {
					// Fecha a resposta do assistente e persiste o texto final no histórico da UI.
					if (realtimeAssistantDone.current) {
						return;
					}

					const finalText =
						text.trim() || realtimeAssistantBuffer.current.trim();
					if (!finalText) {
						return;
					}

					realtimeAssistantDone.current = true;
					realtimeAssistantBuffer.current = "";
					hasSpokenOnce.current = true;

					setChatMessages((messages) => [
						...messages,
						{ content: finalText, role: "assistant" },
					]);
					if (webSearchTurnActiveRef.current) {
						pendingAssistantFinalTextRef.current = finalText;
						speakingStartTimeRef.current = null;
						charTimingsRef.current = null;
						setCharTimingVersion((version) => version + 1);
					} else {
						setChatCardContent(finalText);
					}
					setLastSpokenText(finalText);
				},
				onSpeakingChange: (speaking) => {
					if (speaking) {
						speakingStartTimeRef.current = performance.now();
						shouldPlayListenResumeSoundRef.current = true;
						scheduleThinkingLoopSoundAfterWebSearchIntro();
					}
					setIsSpeaking(speaking);
				},
				onVoiceEndConfirmed: async () => {
					console.warn("[senior] onVoiceEndConfirmed fired, stopping session");
					await stopRealtimeSession();
				},
				onCharTimings: (chars, startTimesMs) => {
					charTimingsRef.current = { chars, startTimesMs };
					setCharTimingVersion((version) => version + 1);
				},
				onError: (error) => {
					console.error("Realtime session error:", error);
					void stopRealtimeSession();
				},
				onPreludeAudioPlaybackEnded: () => {
					if (!webSearchTurnActiveRef.current) return;
					if (pendingAssistantFinalTextRef.current.trim()) return;
					setChatCardContent("");
					speakingStartTimeRef.current = null;
					charTimingsRef.current = null;
					setCharTimingVersion((version) => version + 1);
				},
				onResponseAudioPlaybackStarted: () => {
					if (!webSearchTurnActiveRef.current) {
						speakingStartTimeRef.current = performance.now();
						setCharTimingVersion((version) => version + 1);
						return;
					}
					const pendingFinalText = pendingAssistantFinalTextRef.current.trim();
					if (pendingFinalText) {
						setChatCardContent(pendingFinalText);
						pendingAssistantFinalTextRef.current = "";
					}
					speakingStartTimeRef.current = performance.now();
					setCharTimingVersion((version) => version + 1);
				},
			});
			if (shouldStartListening) {
				await realtimeSession.current.startListening();
			}
			setActive(true);
		} catch (error) {
			console.error("Failed to start realtime session:", error);
			void stopRealtimeSession();
		} finally {
			realtimeSessionConnecting.current = false;
			setIsRealtimeConnecting(false);
		}
	};

	// Wrapper simples usado pelo botão principal para iniciar a escuta.
	const startListening = async () => {
		await startRealtimeListening();
	};

	const pickInitialGreeting = () =>
		INITIAL_ASSISTANT_GREETINGS[
			Math.floor(Math.random() * INITIAL_ASSISTANT_GREETINGS.length)
		] ?? INITIAL_ASSISTANT_GREETINGS[0];

	const playInitialGreeting = async (
		greeting: (typeof INITIAL_ASSISTANT_GREETINGS)[number],
	) => {
		if (initialGreetingAudioRef.current) {
			initialGreetingAudioRef.current.pause();
			initialGreetingAudioRef.current.currentTime = 0;
		}

		const audio = new Audio(greeting.audioSrc);
		initialGreetingAudioRef.current = audio;
		audio.preload = "auto";

		setChatMessages((messages) => [
			...messages,
			{ content: greeting.text, role: "assistant" },
		]);
		setChatCardContent(greeting.text);
		setLastSpokenText(greeting.text);
		hasSpokenOnce.current = true;
		speakingStartTimeRef.current = performance.now();
		setActive(true);
		setIsSpeaking(true);

		try {
			await new Promise<void>((resolve, reject) => {
				const finish = () => {
					audio.onended = null;
					audio.onerror = null;
					audio.onpause = null;
					resolve();
				};

				audio.onended = finish;
				audio.onpause = () => {
					if (!audio.ended) finish();
				};
				audio.onerror = () => {
					audio.onended = null;
					audio.onerror = null;
					audio.onpause = null;
					reject(new Error("FAILED_TO_PLAY_INITIAL_GREETING"));
				};
				void audio.play().catch(reject);
			});
		} finally {
			if (initialGreetingAudioRef.current === audio) {
				initialGreetingAudioRef.current = null;
			}
			setIsSpeaking(false);
			speakingStartTimeRef.current = null;
		}
	};

	const startWithCompyGreeting = async () => {
		const greeting = pickInitialGreeting();
		const greetingPlayback = playInitialGreeting(greeting);

		await startRealtimeListening({
			startListening: false,
			playStartSound: false,
		});
		realtimeSession.current?.noteAssistantPrompt(greeting.text);

		await greetingPlayback.catch((error) => {
			console.error("Failed to play initial greeting:", error);
		});
		await realtimeSession.current?.startListening();
	};

	const playListenStartSound = () => {
		getUiSoundPlayer().play(LISTEN_START_SOUND_SRC);
	};

	const playListenResumeSound = () => {
		getUiSoundPlayer().play(LISTEN_RESUME_SOUND_SRC);
	};

	// Ref so handleSessionEnd can suppress the beforeunload beacon when the person ends the conversation.
	const intentionalEnd = useRef(false);

	const handleSessionEnd = async (
		outcome: "Sucesso" | "Cancelada" | "Falha",
		note?: string,
	) => {
		// Suppress the beforeunload "Abandonada" beacon — the person ended the conversation on purpose.
		intentionalEnd.current = true;
		// Record session outcome FIRST — before closing the realtime session.
		try {
			await api_client.chat["session-log"].$post({
				json: { outcome, ...(note?.trim() ? { note: note.trim() } : {}) },
			});
		} catch {
			/* best-effort — do not block ending the conversation */
		}
		await stopRealtimeSession({
			userOutcome: outcome,
			...(note?.trim() ? { userNote: note?.trim() } : {}),
		});
		// Reload the conversation screen: a fresh page load gets a new visit key,
		// so the next talk is stored as a new conversation.
		window.location.href = `/${lang}/senior`;
	};

	// Register a beforeunload beacon so abandoned sessions (tab close / browser close) are recorded.
	// Also listen for visibilitychange to handle iOS Safari backgrounding (swipe-up / app switch),
	// where beforeunload never fires but the session timer keeps running indefinitely.
	// biome-ignore lint/correctness/useExhaustiveDependencies: register once on mount — only refs used inside
	useEffect(() => {
		const handleBeforeUnload = () => {
			// Skip if the senior is ending the conversation on purpose (Sucesso / Cancelada / Falha).
			if (intentionalEnd.current) return;
			const url = "/api/chat/session-log";
			const body = JSON.stringify({ outcome: "Abandonada" });
			navigator.sendBeacon(url, new Blob([body], { type: "application/json" }));
		};

		// On iOS Safari, backgrounding the app fires visibilitychange (hidden) but NOT beforeunload.
		// We give a 5-second grace period so brief interruptions (notification pull-down) don't end the session.
		let hideTimer: ReturnType<typeof setTimeout> | null = null;

		const handleVisibilityChange = () => {
			if (document.visibilityState === "hidden") {
				hideTimer = setTimeout(() => {
					hideTimer = null;
					// Only act if there is an active session and it wasn't already closed intentionally.
					if (intentionalEnd.current || !realtimeSession.current) return;
					intentionalEnd.current = true; // prevent beforeunload from double-firing
					// Close the conversation (sets closedAt) — fire and forget; best-effort in background.
					void stopRealtimeSession();
					// Also record the session-log outcome via beacon (survives background throttling).
					const url = "/api/chat/session-log";
					const body = JSON.stringify({ outcome: "Abandonada" });
					navigator.sendBeacon(
						url,
						new Blob([body], { type: "application/json" }),
					);
				}, 5000);
			} else {
				if (hideTimer !== null) {
					clearTimeout(hideTimer);
					hideTimer = null;
				}
			}
		};

		window.addEventListener("beforeunload", handleBeforeUnload);
		document.addEventListener("visibilitychange", handleVisibilityChange);
		return () => {
			window.removeEventListener("beforeunload", handleBeforeUnload);
			document.removeEventListener("visibilitychange", handleVisibilityChange);
			if (hideTimer !== null) clearTimeout(hideTimer);
		};
	}, []);

	if (requiresTermsAcceptance) {
		return (
			<div style={{ ...styles.screen, background: SENIOR_BG_SLEEP }}>
				<div
					style={{
						position: "absolute",
						inset: 0,
						zIndex: 0,
						pointerEvents: "none",
						overflow: "hidden",
					}}
				>
					<div
						style={{
							position: "absolute",
							inset: 0,
							background:
								"radial-gradient(circle at 18% 16%, rgba(255,252,226,0.72), transparent 30%)",
						}}
					/>
					<div
						style={{
							position: "absolute",
							inset: 0,
							background:
								"radial-gradient(circle at 82% 82%, rgba(185,235,220,0.64), transparent 28%)",
						}}
					/>
					<div
						style={{
							position: "absolute",
							width: 520,
							height: 520,
							borderRadius: "50%",
							background: "rgba(255,252,226,0.28)",
							filter: "blur(55px)",
							top: "-180px",
							left: "-140px",
							animation: "orbDrift1 36s ease-in-out infinite alternate",
							willChange: "transform",
						}}
					/>
					<div
						style={{
							position: "absolute",
							width: 420,
							height: 420,
							borderRadius: "50%",
							background: "rgba(255,252,226,0.16)",
							filter: "blur(50px)",
							bottom: "-160px",
							right: "-120px",
							animation: "orbDrift2 42s ease-in-out infinite alternate",
							willChange: "transform",
						}}
					/>
					<div
						style={{
							position: "absolute",
							width: 260,
							height: 260,
							borderRadius: "50%",
							background: "rgba(255,255,255,0.14)",
							filter: "blur(45px)",
							top: "24%",
							right: "18%",
							animation: "orbDrift3 32s ease-in-out infinite alternate",
							willChange: "transform",
						}}
					/>
				</div>
				<div style={styles.safe}>
					<div
						style={{
							position: "relative",
							zIndex: 2,
							width: "100%",
							maxWidth: 560,
							margin: "auto",
							display: "flex",
							flexDirection: "column",
							gap: 0,
						}}
					>
						{/* Logo */}
						<div className="flex justify-center mb-6">
							<img
								src="/compyTextLogo.png"
								alt="Compy"
								style={{
									height: 80,
									filter:
										"invert(27%) sepia(37%) saturate(821%) hue-rotate(133deg) brightness(85%) contrast(100%)",
								}}
								className="object-contain"
							/>
						</div>

						<div
							className="rounded-2xl shadow-lg flex flex-col"
							style={{ backgroundColor: "#dff5f3", maxHeight: "70vh" }}
						>
							<div className="px-7 pt-7 pb-4 flex-shrink-0">
								<h1 className="text-xl font-bold" style={{ color: "#1a2a2a" }}>
									{t.termsOfService.title}
								</h1>
							</div>

							<div
								className="px-7 pb-4 overflow-y-auto text-sm leading-relaxed flex-1"
								style={{ color: "#3a5a5a", whiteSpace: "pre-wrap" }}
							>
								{t.termsOfService.content}
							</div>

							<div
								className="px-7 py-5 flex gap-3 flex-shrink-0 border-t"
								style={{ borderColor: "rgba(26,95,90,0.12)" }}
							>
								<button
									type="button"
									onClick={() => {
										window.location.href = `/${lang}/senior-welcome`;
									}}
									className="flex-1 rounded-xl py-3 text-sm font-semibold transition-opacity hover:opacity-80"
									style={{
										backgroundColor: "transparent",
										border: "1px solid rgba(26,95,90,0.25)",
										color: "#3a5a5a",
									}}
								>
									Recusar
								</button>
								<button
									type="button"
									onClick={acceptTos}
									disabled={isAcceptingTerms}
									className="flex-1 rounded-xl py-3 text-sm font-semibold transition-opacity hover:opacity-85"
									style={{ backgroundColor: "#1a5f5a", color: "#fff" }}
								>
									{isAcceptingTerms ? "A aceitar..." : "Aceitar"}
								</button>
							</div>
						</div>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div
			style={{
				...styles.screen,
				background: currentSeniorBackground,
				transition: "background 1100ms ease",
			}}
		>
			{/* Thinking vignette — cyan wave glow from screen edges */}
			<div
				style={{
					position: "fixed",
					inset: 0,
					pointerEvents: "none",
					zIndex: 5,
					opacity: chatLoading ? 1 : 0,
					transition: "opacity 0.7s ease",
				}}
			>
				{/* Base vignette */}
				<div
					style={{
						position: "absolute",
						inset: 0,
						background:
							"radial-gradient(ellipse at center, transparent 38%, rgba(0, 210, 220, 0.18) 100%)",
						boxShadow: "inset 0 0 140px 50px rgba(0, 195, 210, 0.22)",
					}}
				/>
				{/* Wave layer A — drifts slowly */}
				<div
					style={{
						position: "absolute",
						inset: 0,
						background:
							"radial-gradient(ellipse 120% 60% at 20% 80%, rgba(0, 220, 230, 0.14) 0%, transparent 60%)",
						animation: "cyanWaveA 4.5s ease-in-out infinite alternate",
					}}
				/>
				{/* Wave layer B — drifts opposite */}
				<div
					style={{
						position: "absolute",
						inset: 0,
						background:
							"radial-gradient(ellipse 110% 55% at 80% 20%, rgba(0, 200, 215, 0.12) 0%, transparent 58%)",
						animation: "cyanWaveB 5.8s ease-in-out infinite alternate",
					}}
				/>
			</div>
			{/* Ambient motion */}
			<div
				className={hasAvatarGlow ? "orb-active" : ""}
				style={{
					position: "absolute",
					inset: 0,
					zIndex: 0,
					pointerEvents: "none",
					overflow: "hidden",
				}}
			>
				<div
					style={{
						position: "absolute",
						inset: 0,
						background: hasAvatarGlow
							? "radial-gradient(circle at 12% 10%, rgba(255,252,226,0.76), transparent 30%)"
							: "radial-gradient(circle at 14% 12%, rgba(255,252,226,0.58), transparent 26%)",
						opacity: hasAvatarGlow ? 1 : 0.95,
						transition: "all 1100ms ease",
					}}
				/>
				<div
					style={{
						position: "absolute",
						inset: 0,
						background: hasAvatarGlow
							? "radial-gradient(circle at 88% 86%, rgba(255,252,226,0.7), transparent 32%)"
							: "radial-gradient(circle at 86% 84%, rgba(255,252,226,0.44), transparent 26%)",
						opacity: hasAvatarGlow ? 1 : 0.86,
						transition: "all 1100ms ease",
					}}
				/>
				<div
					style={{
						position: "absolute",
						inset: 0,
						background: hasAvatarGlow
							? "radial-gradient(circle at 52% 48%, rgba(255,255,255,0.2), transparent 34%)"
							: "radial-gradient(circle at 54% 46%, rgba(255,255,255,0.22), transparent 30%)",
						opacity: hasAvatarGlow ? 0.78 : 0.7,
						animation: hasAvatarGlow
							? "orbDrift3 24s ease-in-out infinite alternate"
							: "orbDrift2 32s ease-in-out infinite alternate",
						transition: "all 1100ms ease",
					}}
				/>
				<div
					className="orb-1"
					style={{
						position: "absolute",
						width: 620,
						height: 620,
						borderRadius: "50%",
						background: hasAvatarGlow
							? "rgba(255,252,226,0.42)"
							: "rgba(255,252,226,0.26)",
						filter: "blur(55px)",
						top: "-210px",
						left: "-170px",
						animation: "orbDrift1 28s ease-in-out infinite alternate",
						transition: "background 1100ms ease",
						willChange: "transform",
					}}
				/>
				<div
					className="orb-2"
					style={{
						position: "absolute",
						width: 540,
						height: 540,
						borderRadius: "50%",
						background: hasAvatarGlow
							? "rgba(255,252,226,0.34)"
							: "rgba(255,255,255,0.2)",
						filter: "blur(55px)",
						bottom: "-190px",
						right: "-150px",
						animation: "orbDrift2 30s ease-in-out infinite alternate",
						transition: "background 1100ms ease",
						willChange: "transform",
					}}
				/>
				<div
					style={{
						position: "absolute",
						width: 220,
						height: 220,
						borderRadius: "50%",
						background: hasAvatarGlow
							? "rgba(255,255,255,0.18)"
							: "rgba(133, 201, 188, 0.16)",
						filter: "blur(45px)",
						left: "41%",
						bottom: "11%",
						animation: "orbDrift1 24s ease-in-out infinite alternate",
						transition: "background 1100ms ease",
						willChange: "transform",
					}}
				/>
				<div
					style={{
						position: "absolute",
						width: 180,
						height: 180,
						borderRadius: "50%",
						background: hasAvatarGlow
							? "rgba(185,235,220,0.2)"
							: "rgba(185,235,220,0.16)",
						filter: "blur(40px)",
						top: "60%",
						left: "20%",
						animation: "orbDrift3 20s ease-in-out infinite alternate",
						transition: "background 1100ms ease",
						willChange: "transform",
					}}
				/>
			</div>
			<div style={styles.safe}>
				{/* Header */}
				<div style={styles.header}>
					<img
						src="/compy_blue_h.png"
						alt="Compy"
						style={{
							height: 42,
							filter: "brightness(0.22) saturate(1.4)",
							marginLeft: "0.5cm",
							marginTop: "0.5cm",
						}}
					/>
					<div style={styles.headerActions}>
						<button
							type="button"
							className="px-4 sm:px-5 py-2 rounded-full text-white font-medium text-sm transition-opacity hover:opacity-90"
							style={{ backgroundColor: "#1a5f5a" }}
							onClick={() => {
								void stopRealtimeSession();
								setShowEndModal(true);
							}}
						>
							{t.common.end_conversation}
						</button>
						<button
							type="button"
							className="flex items-center justify-center w-10 h-10 rounded-full transition-opacity hover:opacity-80"
							style={{
								backgroundColor: "rgba(255,255,255,0.92)",
								color: "#1a5f5a",
							}}
							onClick={() => setShowSettings(true)}
						>
							<HiOutlineCog6Tooth size={20} />
						</button>
					</div>
				</div>

				{/* Main content */}
				<div
					className="flex-grow flex flex-col items-center justify-center"
					style={{ position: "relative", zIndex: 1 }}
				>
					{/* Avatar button — scaled up via fixed-height wrapper */}
					<div
						className="flex items-center justify-center"
						style={{ height: "260px" }}
					>
						<button
							type="button"
							className="focus:outline-none"
							style={{
								transform: "scale(1.8)",
								transformOrigin: "center center",
							}}
							onClick={async () => {
								const hasActiveRealtimeSession =
									Boolean(realtimeSession.current) ||
									realtimeSessionConnecting.current ||
									isRealtimeConnecting;

								if (hasActiveRealtimeSession) {
									stopListening();
									setChatCardContent("");
								} else {
									await startWithCompyGreeting();
								}
							}}
							disabled={isRealtimeConnecting}
						>
							{memoryGameCompleteIdle ? (
								<div className="h-48 w-48 flex-shrink-0 relative">
									<img
										src="/avatar/newcompy/AEI.png"
										alt="Compy"
										className="absolute inset-0 h-full w-full object-contain"
										style={{
											filter: "drop-shadow(0 20px 42px rgba(26,95,90,0.18))",
										}}
									/>
								</div>
							) : (
								<Avatar
									listening={listening}
									loading={chatLoading || isSkipping}
									speaking={isSpeaking}
									charTimingsRef={charTimingsRef}
									speakingStartTimeRef={speakingStartTimeRef}
								/>
							)}
						</button>
					</div>

					{/* Voice status overlay — does not affect avatar centering. */}
					{active && !memoryGameCompleteIdle && (
						<div
							style={{
								position: "absolute",
								top: "calc(50% + 120px)",
								left: 0,
								right: 0,
								display: "flex",
								justifyContent: "center",
								pointerEvents: "none",
							}}
						>
							<AnimatePresence mode="wait" initial={false}>
								{!isSpeaking &&
								!(hasSpokenOnce.current && !!lastSpokenText) &&
								listening &&
								!chatLoading ? (
									<VoiceStatus key="listening" mode="listening" />
								) : !isSpeaking &&
									!(hasSpokenOnce.current && !!lastSpokenText) &&
									chatLoading &&
									showThinkingStatus ? (
									<VoiceStatus key="thinking" mode="thinking" />
								) : null}
							</AnimatePresence>
						</div>
				)}

					{/* Speech bubble — only shown when sleeping (inactive) */}
					{!(active || listening || chatLoading || isSpeaking) && (
						<div className="relative w-full max-w-2xl px-5 sm:px-8 animate-fade-in-up">
							<div
								aria-hidden="true"
								className="absolute left-1/2 -translate-x-1/2 rotate-45"
								style={speechBubblePointerStyle}
							/>
							<div
								ref={chatWindow}
								className="w-full rounded-[24px] px-7 py-5 text-center overflow-y-auto sm:px-9 sm:py-6"
								style={speechBubbleSurfaceStyle}
							>
								<span
									className="font-medium"
									style={{
										fontSize: bubbleFontSize,
										lineHeight: 1.35,
										letterSpacing: "-0.01em",
									}}
								>
									{t.common.click_me_to_speak}
								</span>
							</div>
						</div>
					)}

					{/* Speech bubble — shown when speaking */}
					{isSpeaking && chatCardContent && (
						<SpeakingBubble
							text={chatCardContent}
							onSkip={skipSpeaking}
							fontSize={bubbleFontSize}
							isSpeaking={isSpeaking}
							charTimingsRef={charTimingsRef}
							speakingStartTimeRef={speakingStartTimeRef}
							timingVersion={charTimingVersion}
						/>
					)}

					{/* Persistent subtitle — shown after Compy has spoken, during silent listening */}
					{hasSpokenOnce.current &&
						lastSpokenText &&
						!memoryGameCompleteIdle &&
						!isSpeaking &&
						!chatLoading && (
							<div className="relative w-full max-w-2xl px-5 sm:px-8 animate-fade-in-up">
								<div
									aria-hidden="true"
									className="absolute left-1/2 -translate-x-1/2 rotate-45"
									style={speechBubblePointerStyle}
								/>
								<div
									className="w-full rounded-[24px] px-7 py-5 text-center sm:px-9 sm:py-6"
									style={speechBubbleSurfaceStyle}
								>
									<div
										ref={persistentSubtitleScrollRef}
										style={{
											maxHeight: "28vh",
											overflowY: "auto",
											scrollbarWidth: "none",
											msOverflowStyle: "none",
										}}
										className="[&::-webkit-scrollbar]:hidden"
									>
										<span
											className="font-medium"
											style={{
												whiteSpace: "pre-line",
												fontSize: bubbleFontSize,
												lineHeight: 1.35,
												letterSpacing: "-0.01em",
											}}
										>
											{sanitizeSpeechText(lastSpokenText)}
										</span>
									</div>
								</div>
							</div>
						)}
				</div>

				<style>{`
          @keyframes modalSlideUp {
            from { opacity: 0; transform: translateY(10px); }
            to   { opacity: 1; transform: translateY(0); }
          }
          @media (prefers-reduced-motion: reduce) {
            .modal-card { animation: none !important; }
          }
        `}</style>

				{/* Settings modal */}
				{showSettings && (
					<div
						className="absolute inset-0 flex items-center justify-center z-50"
						style={{
							backgroundColor: "rgba(0,10,15,0.38)",
							backdropFilter: "blur(8px)",
							WebkitBackdropFilter: "blur(8px)",
						}}
						onClick={(e) => {
							if (e.target === e.currentTarget) setShowSettings(false);
						}}
					>
						<div
							className="modal-card"
							style={{
								background: "rgba(255,255,255,0.97)",
								backdropFilter: "blur(20px)",
								WebkitBackdropFilter: "blur(20px)",
								borderRadius: 28,
								border: "1px solid rgba(255,255,255,0.85)",
								boxShadow:
									"0 32px 64px rgba(0,0,0,0.13), 0 8px 24px rgba(0,0,0,0.06)",
								width: "100%",
								maxWidth: 340,
								overflow: "hidden",
								animation:
									"modalSlideUp 0.24s cubic-bezier(0.22,1,0.36,1) both",
							}}
						>
							{/* Header */}
							<div
								style={{
									display: "flex",
									alignItems: "center",
									justifyContent: "space-between",
									padding: "20px 22px 16px",
									borderBottom: "1px solid rgba(0,0,0,0.055)",
								}}
							>
								<p
									style={{
										fontSize: 16,
										fontWeight: 600,
										color: "#1a2a2a",
										letterSpacing: "-0.01em",
									}}
								>
									Definições
								</p>
								<button
									type="button"
									onClick={() => setShowSettings(false)}
									className="transition-opacity hover:opacity-70 active:scale-95"
									style={{
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
									}}
								>
									✕
								</button>
							</div>

								{/* Body */}
								<div
									style={{
										padding: "18px 22px 22px",
										display: "flex",
										flexDirection: "column",
										gap: 0,
									}}
								>
									{/* Font size slider */}
								<div
									style={{
										display: "flex",
										flexDirection: "column",
										gap: 8,
										paddingBottom: 18,
									}}
								>
									<div
										style={{
											display: "flex",
											justifyContent: "space-between",
											alignItems: "center",
										}}
									>
										<p
											style={{
												fontSize: 14,
												fontWeight: 500,
												color: "#1a2a2a",
											}}
										>
											Tamanho do texto
										</p>
										<span
											style={{
												fontSize: 12,
												fontWeight: 600,
												color: "#1a5f5a",
												background: "rgba(26,95,90,0.09)",
												padding: "2px 8px",
												borderRadius: 6,
											}}
										>
											{bubbleFontSize}px
										</span>
									</div>
									<input
										type="range"
										min={16}
										max={40}
										step={2}
										value={bubbleFontSize}
										onChange={(e) => setBubbleFontSize(Number(e.target.value))}
										style={{
											width: "100%",
											accentColor: "#1a5f5a",
											cursor: "pointer",
										}}
									/>
									<div
										style={{ display: "flex", justifyContent: "space-between" }}
									>
										<span style={{ fontSize: 11, color: "#9abaaa" }}>
											Pequeno
										</span>
										<span style={{ fontSize: 11, color: "#9abaaa" }}>
											Grande
										</span>
									</div>
								</div>
							</div>
						</div>
					</div>
					)}

				{/* End-session confirmation modal */}
				{showEndModal && (
					<div
						className="absolute inset-0 flex items-center justify-center z-50"
						style={{
							backgroundColor: "rgba(0,10,15,0.38)",
							backdropFilter: "blur(8px)",
							WebkitBackdropFilter: "blur(8px)",
						}}
					>
						<div
							className="modal-card"
							style={{
								background: "rgba(255,255,255,0.97)",
								backdropFilter: "blur(20px)",
								WebkitBackdropFilter: "blur(20px)",
								borderRadius: 28,
								border: "1px solid rgba(255,255,255,0.85)",
								boxShadow:
									"0 32px 64px rgba(0,0,0,0.13), 0 8px 24px rgba(0,0,0,0.06)",
								width: "100%",
								maxWidth: 308,
								padding: "24px 22px 20px",
								display: "flex",
								flexDirection: "column",
								gap: 16,
								animation:
									"modalSlideUp 0.24s cubic-bezier(0.22,1,0.36,1) both",
							}}
						>
							<p
								style={{
									fontSize: 13,
									fontWeight: 500,
									color: "#7a9a9a",
									textAlign: "center",
									letterSpacing: "0.02em",
								}}
							>
								Como correu a sessão?
							</p>

							<div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
								{[
									{
										option: "Sucesso" as const,
										desc: "A sessão correu do início ao fim sem interrupções.",
									},
									{
										option: "Cancelada" as const,
										desc: "Interrompida por um fator externo, não técnico.",
									},
									{
										option: "Falha" as const,
										desc: "Interrompida por um problema técnico do Compy.",
									},
								].map(({ option, desc }) => {
									const isSelected = pendingOutcome === option;
									const C = {
										Sucesso: {
											dot: "#2DBFA0",
											border: "rgba(45,191,160,0.55)",
											bg: "rgba(45,191,160,0.07)",
											text: "#0a5c58",
										},
										Cancelada: {
											dot: "#E8A020",
											border: "rgba(232,160,32,0.55)",
											bg: "rgba(232,160,32,0.07)",
											text: "#6e4a08",
										},
										Falha: {
											dot: "#D96B6B",
											border: "rgba(217,107,107,0.55)",
											bg: "rgba(217,107,107,0.07)",
											text: "#7a2020",
										},
									}[option];
									return (
										<button
											key={option}
											type="button"
											onClick={() => {
												setPendingOutcome(option);
												setSessionNote("");
											}}
											className="transition-all hover:opacity-90 active:scale-[0.98]"
											style={{
												display: "flex",
												alignItems: "flex-start",
												gap: 12,
												padding: "13px 16px",
												borderRadius: 16,
												width: "100%",
												border: `1.5px solid ${C.border}`,
												background: isSelected ? C.bg : "rgba(248,250,250,0.9)",
												cursor: "pointer",
												transition: "all 160ms cubic-bezier(0.4,0,0.2,1)",
											}}
										>
											<span
												style={{
													width: 9,
													height: 9,
													borderRadius: "50%",
													flexShrink: 0,
													marginTop: 4,
													background: C.dot,
													boxShadow: isSelected
														? `0 0 0 3px ${C.dot}28`
														: "none",
													transition: "box-shadow 160ms ease",
												}}
											/>
											<div
												style={{
													flex: 1,
													display: "flex",
													flexDirection: "column",
													gap: 2,
													textAlign: "left",
												}}
											>
												<span
													style={{
														fontSize: 14,
														fontWeight: isSelected ? 600 : 500,
														color: isSelected ? C.text : "#2a4a4a",
													}}
												>
													{option}
												</span>
												<span
													style={{
														fontSize: 11,
														color: isSelected ? C.text : "#9abaaa",
														opacity: isSelected ? 0.75 : 1,
														lineHeight: 1.4,
													}}
												>
													{desc}
												</span>
											</div>
											{isSelected && (
												<span
													style={{
														fontSize: 13,
														color: C.dot,
														fontWeight: 700,
														flexShrink: 0,
													}}
												>
													✓
												</span>
											)}
										</button>
									);
								})}
							</div>

							{pendingOutcome && (
								<div
									style={{ display: "flex", flexDirection: "column", gap: 8 }}
								>
									<textarea
										rows={2}
										placeholder="Motivo (opcional)..."
										value={sessionNote}
										onChange={(e) => setSessionNote(e.target.value)}
										style={{
											width: "100%",
											borderRadius: 14,
											padding: "10px 14px",
											fontSize: 13,
											color: "#2a4a4a",
											background: "rgba(240,251,250,0.85)",
											border: "1.5px solid rgba(45,160,142,0.18)",
											resize: "none",
											outline: "none",
											fontFamily: "inherit",
											lineHeight: 1.5,
											boxSizing: "border-box",
										}}
										onFocus={(e) => {
											e.currentTarget.style.borderColor =
												"rgba(45,160,142,0.45)";
										}}
										onBlur={(e) => {
											e.currentTarget.style.borderColor =
												"rgba(45,160,142,0.18)";
										}}
									/>
									<button
										type="button"
										onClick={() =>
											handleSessionEnd(pendingOutcome, sessionNote)
										}
										className="transition-opacity hover:opacity-90 active:scale-[0.98]"
										style={{
											width: "100%",
											padding: "13px 24px",
											borderRadius: 14,
											background:
												"linear-gradient(135deg, #1a5f5a 0%, #2DBFA0 100%)",
											color: "#fff",
											border: "none",
											fontSize: 14,
											fontWeight: 600,
											cursor: "pointer",
											letterSpacing: "0.01em",
											boxShadow: "0 8px 20px rgba(26,95,90,0.22)",
											transition: "opacity 150ms ease",
										}}
									>
										Confirmar
									</button>
								</div>
							)}

							<button
								type="button"
								onClick={() => {
									setShowEndModal(false);
									setPendingOutcome(null);
									setSessionNote("");
								}}
								className="transition-opacity hover:opacity-70"
								style={{
									background: "none",
									border: "none",
									cursor: "pointer",
									fontSize: 13,
									color: "#8aadaa",
									textAlign: "center",
								}}
							>
								Cancelar
							</button>
						</div>
					</div>
				)}

				<MemoryPairsVoiceGame
					open={showMemoryGame}
					seniorName={seniorDisplayName}
					introAudioBase64={memoryGameIntro?.audioBase64}
					introAudioMimeType={memoryGameIntro?.audioMimeType}
					onClose={() => {
						setMemoryGameCompleteIdle(false);
						if (gameKeepaliveRef.current) {
							clearInterval(gameKeepaliveRef.current);
							gameKeepaliveRef.current = null;
						}
						setShowMemoryGame(false);
						setMemoryGameIntro(null);
						pendingMemoryGameIntro.current = null;
						void realtimeSession.current?.startListening();
					}}
					onComplete={() => {
						setMemoryGameCompleteIdle(true);
						setActive(true);
						setChatCardContent("");
						setLastSpokenText("");
						hasSpokenOnce.current = false;
					}}
					onRestart={() => {
						setMemoryGameCompleteIdle(false);
						setChatCardContent("");
						setLastSpokenText("");
						hasSpokenOnce.current = false;
					}}
					onReturnToConversation={(result) => {
						void returnFromMemoryGame(result);
					}}
				/>
			</div>
		</div>
	);
}
