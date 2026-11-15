import { createLazyFileRoute, useRouter } from "@tanstack/react-router";
import Chart from "@/frontend/components/ui/chart";
import { IoCaretBackOutline, IoPaperPlaneOutline } from "react-icons/io5";
import { useEffect, useState, useMemo, useRef } from "react";
import { usePageBackgroundStore } from "@/frontend/stores/pageBackground";
import { dictionary } from "@/frontend/assets/i18n";
import { PoweredByKindtech } from "@/frontend/components/ui/PoweredByKindtech";
import {
	HiCalendarDays,
	HiMiniMicrophone,
	HiChevronLeft,
	HiChevronRight,
} from "react-icons/hi2";
import type {
	CaregiverDashboardResponse,
	ConversationReportResponse,
	EmotionalTrendResponse,
	SeniorResponse,
} from "@/shared/contracts";
import { api_client } from "@/frontend/utils/api";
import { Settings } from "@/frontend/components/settings/settings";

export const Route = createLazyFileRoute(
	"/$lang/_app/_app/_caretaker/caretaker/reports/$residentId",
)({
	component: RouteComponent,
});

// ── Design tokens ─────────────────────────────────────────────────────────
const BG =
	"radial-gradient(circle at 12% 24%, rgba(255,252,226,0.96) 0%, rgba(255,252,226,0.74) 24%, rgba(255,252,226,0.18) 42%, rgba(255,252,226,0) 58%), radial-gradient(circle at 92% 80%, rgba(185,235,220,0.86) 0%, rgba(185,235,220,0.52) 18%, rgba(185,235,220,0.14) 36%, rgba(185,235,220,0) 54%), linear-gradient(135deg, #fffce2 0%, #ffffff 52%, #b9ebdc 100%)";
const SOFT_BG_CARD = "#FFFFFF";
const CARD_SHADOW = "0 2px 16px rgba(0,0,0,0.05)";
const SF =
	'-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", sans-serif';
const SF_TEXT =
	'-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif';
const CHATBOT_AVATAR_URL = new URL(
	"../../../../../../../../../semfundo.png",
	import.meta.url,
).href;

const C = {
	teal: "#2DBFA0",
	tealDark: "#0a4a45",
	text: "#1a1a1a",
	textSub: "#9a9a9a",
	textMuted: "#b0b0b0",
	divider: "rgba(17,75,69,0.08)",
	cardBorder: "rgba(17,75,69,0.12)",
};

const SESSION_LOG_PAGE_SIZE = 4;

function resolveSeniorDisplayName(input: {
	nickname?: string | null;
	fullName?: string | null;
}) {
	return input.nickname?.trim() || input.fullName?.trim() || "";
}

type SessionLogItem = {
	status: string;
	timestamp: string;
	note?: string;
};

type CaregiverChatDemoMessage = {
	id: string;
	role: "assistant" | "user";
	text: string;
	tipTitle?: string;
};

function buildChatWelcome(name: string): CaregiverChatDemoMessage {
	const who = name || "este idoso";
	return {
		id: "assistant-demo-start",
		role: "assistant",
		tipTitle: `Sugestões para ${who}`,
		text: `Com base nas conversas do Compy, podes perguntar:\n\n"Como esteve o humor esta semana?"\n"Houve alguma preocupação recente?"\n"Qual foi a tendência emocional do mês?"\n\nEstou em modo de demonstração — em breve estarei totalmente ativo.`,
	};
}

const CHAT_DEMO_FALLBACK_REPLY =
	"Estou em modo de demonstração — em breve estarei totalmente ativo.";

// ── Tone helpers ──────────────────────────────────────────────────────────
const TONE_SCORE: Record<string, number> = {
	sem_registo: 0,
	sem_tom: 0,
	positivo: 3,
	positive: 3,
	neutro: 2,
	neutral: 2,
	melancólico: 1,
	melancolico: 1,
	melancholic: 1,
};
const TONE_LABEL: Record<string, string> = {
	sem_registo: "Sem tom",
	sem_tom: "Sem tom",
	positivo: "Positivo",
	positive: "Positivo",
	neutro: "Neutro",
	neutral: "Neutro",
	melancólico: "Melancólico",
	melancolico: "Melancólico",
	melancholic: "Melancólico",
};
function toneScore(tone: string) {
	return TONE_SCORE[tone.toLowerCase()] ?? 2;
}
function toneLabel(tone: string) {
	return TONE_LABEL[tone.toLowerCase()] ?? tone;
}

function isMissingTone(tone: string) {
	return ["sem_registo", "sem_tom"].includes(tone.toLowerCase());
}

function resolveDominantTone(tones: string[]) {
	if (tones.length === 0) return null;
	const meaningfulTones = tones.filter((tone) => !isMissingTone(tone));
	const source = meaningfulTones.length > 0 ? meaningfulTones : tones;
	return source.find((tone) => toneScore(tone) < 2) ?? source[0] ?? null;
}

function formatShortDate(dateStr: string) {
	const [year, month, day] = dateStr.split("-").map(Number);
	return new Date(year, month - 1, day).toLocaleDateString("pt-PT", {
		day: "2-digit",
		month: "2-digit",
	});
}

function formatLongDate(dateStr: string) {
	const [year, month, day] = dateStr.split("-").map(Number);
	return new Date(year, month - 1, day).toLocaleDateString("pt-PT", {
		weekday: "long",
		day: "numeric",
		month: "long",
	});
}

function calculateAge(birthDate: string | null) {
	if (!birthDate) return null;
	const birth = new Date(birthDate);
	if (Number.isNaN(birth.getTime())) return null;
	const today = new Date();
	let age = today.getFullYear() - birth.getFullYear();
	const monthDiff = today.getMonth() - birth.getMonth();
	if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
		age -= 1;
	}
	return age;
}

function tonePill(score: number): { bg: string; text: string } {
	const map: Record<number, { bg: string; text: string }> = {
		3: { bg: "#E8F5F1", text: "#2DBFA0" },
		2: { bg: "#F2F0EB", text: "#6b6b5a" },
		1: { bg: "#FDF3EC", text: "#D4845A" },
		0: { bg: "#FDF0EF", text: "#D4685A" },
		[-1]: { bg: "#F2F4F7", text: "#7A8494" },
	};
	return map[score] ?? map[-1];
}

function emotionalCircleState(tone: string) {
	const normalized = tone.toLowerCase();
	if (["sem_registo", "sem_tom"].includes(normalized)) {
		return { key: "sem_tom", label: "Sem tom", color: "#B8C0CC", symbol: "·" };
	}
	if (["positivo", "positive"].includes(normalized)) {
		return {
			key: "positivo",
			label: "Positivo",
			color: "#37B857",
			symbol: "✓",
		};
	}
	if (["melancólico", "melancolico", "melancholic"].includes(normalized)) {
		return {
			key: "melancolico",
			label: "Melancólico",
			color: "#D96B6B",
			symbol: "•",
		};
	}
	return { key: "neutro", label: "Neutro", color: "#A8A8B7", symbol: "−" };
}

function buildToneCounts(tones: string[]) {
	const counts = new Map<string, { count: number; score: number }>();
	for (const tone of tones) {
		const label = toneLabel(tone);
		const score = toneScore(tone);
		const current = counts.get(label);
		counts.set(label, { count: (current?.count ?? 0) + 1, score });
	}
	return [...counts.entries()]
		.map(([label, data]) => ({ label, count: data.count, score: data.score }))
		.sort((a, b) => b.count - a.count);
}

function buildMoodSummary(tones: string[]) {
	const summary = [
		{ key: "positive", label: "Positivo", color: C.teal, count: 0 },
		{ key: "neutral", label: "Neutro", color: "#A8A8B7", count: 0 },
		{ key: "melancholic", label: "Melancólico", color: "#D96B6B", count: 0 },
		{ key: "missing", label: "Sem tom", color: "#B8C0CC", count: 0 },
	];

	for (const tone of tones) {
		if (isMissingTone(tone)) {
			summary[3].count += 1;
			continue;
		}
		const score = toneScore(tone);
		if (score >= 3) {
			summary[0].count += 1;
		} else if (score === 2) {
			summary[1].count += 1;
		} else {
			summary[2].count += 1;
		}
	}

	return summary;
}

function sessionLogIdentity(log: SessionLogItem) {
	return `${log.timestamp}|${log.status}|${log.note ?? ""}`;
}

function uniqueSessionLogs(logs: SessionLogItem[]) {
	const seen = new Set<string>();
	return logs.filter((log) => {
		const key = sessionLogIdentity(log);
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}

const SESSION_STATUS_STYLES: Record<string, { bg: string; text: string }> = {
	Sucesso: { bg: "#E8F5F1", text: "#2DBFA0" },
	successful: { bg: "#E8F5F1", text: "#2DBFA0" },
	Cancelada: { bg: "#FDF3EC", text: "#D4845A" },
	cancelled: { bg: "#FDF3EC", text: "#D4845A" },
	Abandonada: { bg: "#FDF0F0", text: "#C97070" },
	abandoned: { bg: "#FDF0F0", text: "#C97070" },
	Falha: { bg: "#FDF0EF", text: "#D4685A" },
	failed: { bg: "#FDF0EF", text: "#D4685A" },
};

// ── MiniCalendar ──────────────────────────────────────────────────────────
const WEEK_DAYS = ["D", "S", "T", "Q", "Q", "S", "S"];

const TONE_CAL_FULL: Record<string, string> = {
	positivo: "#37B857",
	neutro: "#A8A8B7",
	melancolico: "#D96B6B",
	sem_tom: "#B8C0CC",
};
const TONE_CAL_LIGHT: Record<string, string> = {
	positivo: "rgba(55,184,87,0.18)",
	neutro: "rgba(168,168,183,0.18)",
	melancolico: "rgba(217,107,107,0.18)",
	sem_tom: "rgba(184,192,204,0.22)",
};

function MiniCalendar({
	availableDates,
	selectedDate,
	onSelect,
	dateToneMap = {},
}: {
	availableDates: string[];
	selectedDate: string | null;
	onSelect: (date: string | null) => void;
	dateToneMap?: Record<string, string>;
}) {
	const available = new Set(availableDates);
	const ref = selectedDate ?? availableDates[availableDates.length - 1];
	const [visibleMonth, setVisibleMonth] = useState(() => {
		if (ref) {
			const [year, month] = ref.split("-").map(Number);
			return { year, month };
		}
		return { year: new Date().getFullYear(), month: new Date().getMonth() + 1 };
	});

	useEffect(() => {
		if (!ref) return;
		const [year, month] = ref.split("-").map(Number);
		setVisibleMonth({ year, month });
	}, [ref]);

	const { year, month } = visibleMonth;
	const firstDay = new Date(year, month - 1, 1).getDay();
	const daysInMonth = new Date(year, month, 0).getDate();
	const cells: (number | null)[] = [
		...Array(firstDay).fill(null),
		...Array.from({ length: daysInMonth }, (_, i) => i + 1),
	];
	const monthLabel = new Date(year, month - 1, 1).toLocaleDateString("pt-PT", {
		month: "long",
		year: "numeric",
	});

	const shiftMonth = (direction: -1 | 1) => {
		setVisibleMonth((current) => {
			const next = new Date(current.year, current.month - 1 + direction, 1);
			return { year: next.getFullYear(), month: next.getMonth() + 1 };
		});
	};

	return (
		<div
			style={{
				background: "#FFFFFF",
				borderRadius: 20,
				padding: "16px 18px",
				boxShadow: CARD_SHADOW,
				minWidth: 240,
				border: `1px solid ${C.cardBorder}`,
			}}
		>
			<div
				className="flex items-center justify-between"
				style={{ marginBottom: 10 }}
			>
				<button
					type="button"
					onClick={() => shiftMonth(-1)}
					style={{
						width: 28,
						height: 28,
						borderRadius: 999,
						border: "none",
						background: "rgba(0,0,0,0.04)",
						color: C.tealDark,
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						cursor: "pointer",
					}}
				>
					<HiChevronLeft size={16} />
				</button>
				<p
					style={{
						fontSize: 13,
						fontWeight: 500,
						color: C.tealDark,
						textAlign: "center",
						textTransform: "capitalize",
						fontFamily: SF_TEXT,
					}}
				>
					{monthLabel}
				</p>
				<button
					type="button"
					onClick={() => shiftMonth(1)}
					style={{
						width: 28,
						height: 28,
						borderRadius: 999,
						border: "none",
						background: "rgba(0,0,0,0.04)",
						color: C.tealDark,
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						cursor: "pointer",
					}}
				>
					<HiChevronRight size={16} />
				</button>
			</div>
			<div
				style={{
					display: "grid",
					gridTemplateColumns: "repeat(7, 1fr)",
					gap: 2,
				}}
			>
				{WEEK_DAYS.map((d, i) => (
					<div
						key={i}
						style={{
							fontSize: 10,
							fontWeight: 600,
							color: C.textMuted,
							textAlign: "center",
							paddingBottom: 4,
						}}
					>
						{d}
					</div>
				))}
				{cells.map((day, i) => {
					if (!day) return <div key={i} />;
					const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
					const isAvailable = available.has(dateStr);
					const isSelected = dateStr === selectedDate;
					const toneKey = isAvailable ? (dateToneMap[dateStr] ?? null) : null;
					const bgColor = isSelected
						? toneKey
							? (TONE_CAL_FULL[toneKey] ?? C.teal)
							: C.teal
						: isAvailable
							? toneKey
								? (TONE_CAL_LIGHT[toneKey] ?? "rgba(0,0,0,0.04)")
								: "rgba(0,0,0,0.04)"
							: "transparent";
					return (
						<button
							key={i}
							type="button"
							disabled={!isAvailable}
							onClick={() => onSelect(dateStr)}
							style={{
								width: 30,
								height: 30,
								borderRadius: "50%",
								border: "none",
								fontSize: 13,
								fontWeight: isSelected ? 700 : 400,
								cursor: isAvailable ? "pointer" : "default",
								backgroundColor: bgColor,
								color: isSelected
									? "#fff"
									: isAvailable
										? C.tealDark
										: C.textMuted,
								transition: "all 0.15s ease",
								fontFamily: SF_TEXT,
							}}
						>
							{day}
						</button>
					);
				})}
			</div>
		</div>
	);
}

function RollingNumber({ value }: { value: number }) {
	const safeValue = Math.max(0, Math.round(value));
	const [displayValue, setDisplayValue] = useState(0);

	useEffect(() => {
		let frame = 0;
		const duration = 1450;
		const start = performance.now();

		const animate = (now: number) => {
			const progress = Math.min(1, (now - start) / duration);
			const eased = 1 - (1 - progress) ** 3;
			setDisplayValue(Math.round(safeValue * eased));
			if (progress < 1) frame = requestAnimationFrame(animate);
		};

		setDisplayValue(0);
		frame = requestAnimationFrame(animate);
		return () => cancelAnimationFrame(frame);
	}, [safeValue]);

	const digits = String(displayValue)
		.padStart(Math.max(2, String(safeValue).length), "0")
		.split("");

	return (
		<div
			style={{
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				gap: 6,
				perspective: 700,
			}}
		>
			{digits.map((digit, index) => (
				<div
					key={`${index}-${digits.length}`}
					style={{
						width: 38,
						height: 52,
						borderRadius: 12,
						background:
							"linear-gradient(180deg, rgba(11,96,90,0.92) 0%, rgba(9,78,73,0.98) 100%)",
						boxShadow:
							"0 8px 18px rgba(9,78,73,0.16), inset 0 1px 0 rgba(255,255,255,0.12)",
						position: "relative",
						overflow: "hidden",
					}}
				>
					<div
						style={{
							position: "absolute",
							top: "50%",
							left: 5,
							right: 5,
							height: 1.5,
							background: "rgba(255,255,255,0.12)",
							transform: "translateY(-50%)",
							zIndex: 2,
						}}
					/>
					<div
						style={{
							transform: `translateY(-${Number(digit) * 10}%)`,
							transition: "transform 420ms cubic-bezier(0.2, 0.85, 0.2, 1)",
						}}
					>
						{Array.from({ length: 10 }, (_, number) => (
							<div
								key={number}
								style={{
									height: 52,
									display: "flex",
									alignItems: "center",
									justifyContent: "center",
									color: "#F7FFFC",
									fontSize: 34,
									fontWeight: 500,
									fontFamily: '"SF Mono", "Roboto Mono", monospace',
									lineHeight: 1,
									textShadow: "0 1px 8px rgba(0,0,0,0.22)",
								}}
							>
								{number}
							</div>
						))}
					</div>
				</div>
			))}
		</div>
	);
}

function WordCloud({
	entries,
	emptyLabel = "Sem tópicos para este período",
	onTopicClick,
}: {
	entries: [string, number][];
	emptyLabel?: string;
	onTopicClick?: (label: string) => void;
}) {
	if (entries.length === 0) {
		return (
			<p style={{ fontSize: 13, color: C.textSub, fontFamily: SF_TEXT }}>
				{emptyLabel}
			</p>
		);
	}
	const visibleEntries = entries.slice(0, 14);
	const max = Math.max(...visibleEntries.map(([, n]) => n), 1);
	const densityPenalty =
		visibleEntries.length > 10 ? 4 : visibleEntries.length > 7 ? 2 : 0;
	const colors = ["#738914", "#F0A41C", "#8D2D5E", "#E86F20"];
	return (
		<div
			style={{
				width: "100%",
				minHeight: 230,
				overflow: "hidden",
				display: "flex",
				flexWrap: "wrap",
				alignContent: "center",
				justifyContent: "center",
				gap: "8px 12px",
				padding: "6px 10px",
			}}
		>
			{visibleEntries.map(([word, count], i) => {
				const lengthPenalty = Math.min(Math.max(word.length - 8, 0) * 0.75, 8);
				const baseSize = i === 0 ? 34 : 13 + (count / max) * 14;
				const size = Math.max(
					11,
					Math.round(baseSize - lengthPenalty - densityPenalty),
				);
				const opacity = i === 0 ? 0.96 : 0.76 + (count / max) * 0.18;
				const color = colors[i % colors.length];
				return (
					<span
						key={word}
						title={`${word}: ${count}`}
						role={onTopicClick ? "button" : undefined}
						tabIndex={onTopicClick ? 0 : undefined}
						onClick={() => onTopicClick?.(word)}
						onKeyDown={(e) => {
							if (onTopicClick && (e.key === "Enter" || e.key === " "))
								onTopicClick(word);
						}}
						style={{
							fontSize: size,
							fontWeight: i === 0 ? 700 : count === max ? 600 : 500,
							color,
							opacity,
							fontFamily: SF_TEXT,
							lineHeight: 1,
							cursor: onTopicClick ? "pointer" : "default",
							transition: "opacity 0.15s ease",
							whiteSpace: "nowrap",
							maxWidth: "100%",
							flexShrink: 1,
						}}
						onMouseEnter={(e) => {
							(e.currentTarget as HTMLSpanElement).style.opacity = "1";
						}}
						onMouseLeave={(e) => {
							(e.currentTarget as HTMLSpanElement).style.opacity =
								String(opacity);
						}}
					>
						{word}
					</span>
				);
			})}
		</div>
	);
}

// ── Small helpers ─────────────────────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
	return (
		<p
			style={{
				fontSize: 11,
				fontWeight: 500,
				letterSpacing: "0.6px",
				textTransform: "uppercase",
				color: "#b0b0b0",
				marginBottom: 14,
				fontFamily: SF_TEXT,
			}}
		>
			{children}
		</p>
	);
}

function Card({
	children,
	style,
	className,
}: {
	children: React.ReactNode;
	style?: React.CSSProperties;
	className?: string;
}) {
	return (
		<div
			className={className}
			style={{
				background: "#FFFFFF",
				borderRadius: 20,
				padding: 24,
				boxShadow: CARD_SHADOW,
				border: `1px solid ${C.cardBorder}`,
				...style,
			}}
		>
			{children}
		</div>
	);
}

function CaregiverChatPanel({
	messages,
	input,
	onInputChange,
	onSend,
	onClose,
	titleId,
	style,
}: {
	messages: CaregiverChatDemoMessage[];
	input: string;
	onInputChange: (value: string) => void;
	onSend: () => void;
	onClose?: () => void;
	titleId: string;
	style?: React.CSSProperties;
}) {
	const canSend = Boolean(input.trim());

	return (
		<div
			style={{
				width: "100%",
				height: "100%",
				minHeight: 0,
				background:
					"linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(244,253,250,0.98) 100%)",
				borderRadius: 20,
				border: `1px solid ${C.cardBorder}`,
				boxShadow: CARD_SHADOW,
				overflow: "hidden",
				display: "flex",
				flexDirection: "column",
				...style,
			}}
		>
			<div
				style={{
					padding: "16px 16px 13px",
					borderBottom: `1px solid ${C.divider}`,
					display: "flex",
					alignItems: "center",
					gap: 12,
					flexShrink: 0,
				}}
			>
				<div
					style={{
						width: 42,
						height: 42,
						borderRadius: "50%",
						background:
							"linear-gradient(145deg, rgba(11,96,90,0.98), rgba(45,191,160,0.88))",
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						flexShrink: 0,
						boxShadow: "0 12px 24px rgba(8,34,35,0.16)",
					}}
				>
					<img
						src={CHATBOT_AVATAR_URL}
						alt=""
						style={{
							width: 22,
							height: 22,
							objectFit: "contain",
							filter: "drop-shadow(0 2px 5px rgba(0,0,0,0.12))",
						}}
					/>
				</div>
				<div style={{ minWidth: 0, flex: 1 }}>
					<h2
						id={titleId}
						style={{
							margin: 0,
							fontSize: 18,
							lineHeight: 1.1,
							fontWeight: 600,
							color: C.tealDark,
							fontFamily: SF,
						}}
					>
						Chat Compy
					</h2>
					<p
						style={{
							margin: "4px 0 0",
							fontSize: 12,
							color: "#6f8f89",
							fontFamily: SF_TEXT,
						}}
					>
						Demo para caregivers
					</p>
				</div>
				{onClose && (
					<button
						type="button"
						onClick={onClose}
						style={{
							border: "none",
							background: "rgba(17,75,69,0.06)",
							color: "#4f736d",
							borderRadius: 8,
							padding: "8px 10px",
							cursor: "pointer",
							fontSize: 12,
							fontWeight: 600,
							fontFamily: SF_TEXT,
						}}
					>
						Fechar
					</button>
				)}
			</div>

			<div
				style={{
					padding: 16,
					display: "flex",
					flexDirection: "column",
					gap: 12,
					overflowY: "auto",
					flex: 1,
					minHeight: 0,
				}}
			>
				{messages.map((message) => {
					const isUser = message.role === "user";
					if (message.tipTitle) {
						return (
							<div
								key={message.id}
								style={{
									borderRadius: 14,
									background:
										"linear-gradient(135deg, rgba(45,191,160,0.07) 0%, rgba(255,255,255,0.92) 100%)",
									border: "1px solid rgba(45,191,160,0.22)",
									padding: "14px 16px",
									boxShadow: "0 4px 16px rgba(45,191,160,0.08)",
								}}
							>
								<p
									style={{
										margin: "0 0 8px",
										fontSize: 10,
										fontWeight: 800,
										textTransform: "uppercase",
										letterSpacing: "0.7px",
										color: C.teal,
										fontFamily: SF_TEXT,
									}}
								>
									{message.tipTitle}
								</p>
								<p
									style={{
										margin: 0,
										fontSize: 13,
										lineHeight: 1.6,
										color: "#2a4a45",
										fontFamily: SF_TEXT,
										whiteSpace: "pre-line",
									}}
								>
									{message.text}
								</p>
							</div>
						);
					}
					return (
						<div
							key={message.id}
							style={{
								display: "flex",
								justifyContent: isUser ? "flex-end" : "flex-start",
							}}
						>
							<div
								style={{
									maxWidth: "82%",
									borderRadius: isUser
										? "16px 16px 4px 16px"
										: "16px 16px 16px 4px",
									background: isUser ? C.teal : "#FFF8CC",
									color: isUser ? "#ffffff" : "#4B421A",
									border: isUser ? "none" : "1px solid rgba(139,117,29,0.16)",
									padding: "11px 13px",
									boxShadow: isUser
										? "0 10px 22px rgba(45,191,160,0.18)"
										: "0 8px 18px rgba(93,79,21,0.08)",
									fontSize: 13,
									lineHeight: 1.45,
									fontFamily: SF_TEXT,
									whiteSpace: "pre-line",
								}}
							>
								{message.text}
							</div>
						</div>
					);
				})}
			</div>

			<form
				onSubmit={(event) => {
					event.preventDefault();
					onSend();
				}}
				style={{
					padding: 14,
					borderTop: `1px solid ${C.divider}`,
					display: "grid",
					gridTemplateColumns: "minmax(0,1fr) 42px",
					gap: 10,
					background: "rgba(255,255,255,0.78)",
					flexShrink: 0,
				}}
			>
				<input
					value={input}
					onChange={(event) => onInputChange(event.target.value)}
					placeholder="Escreve uma pergunta..."
					style={{
						minWidth: 0,
						height: 42,
						border: `1px solid ${C.cardBorder}`,
						borderRadius: 10,
						background: "#ffffff",
						color: C.text,
						outline: "none",
						padding: "0 13px",
						fontSize: 13,
						fontFamily: SF_TEXT,
					}}
				/>
				<button
					type="submit"
					disabled={!canSend}
					style={{
						width: 42,
						height: 42,
						border: "none",
						borderRadius: 10,
						background: canSend ? C.tealDark : "rgba(17,75,69,0.10)",
						color: canSend ? "#ffffff" : "#8aa29e",
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						cursor: canSend ? "pointer" : "default",
					}}
				>
					<IoPaperPlaneOutline size={16} />
				</button>
			</form>
		</div>
	);
}

// ── Topic detail helpers ───────────────────────────────────────────────────
type TopicConvRef = { date: string; startTime: string };

function buildTopicDetailMap(
	conversations: Array<{
		mainTopics: string[];
		startTime: string;
		reportDate?: string;
	}>,
	topicLabels: Record<string, string>,
): Map<string, { count: number; convs: TopicConvRef[] }> {
	const map = new Map<string, { count: number; convs: TopicConvRef[] }>();
	for (const conv of conversations) {
		const date =
			(conv as { reportDate?: string }).reportDate ??
			conv.startTime.split("T")[0];
		for (const topic of conv.mainTopics) {
			const label =
				topicLabels[topic] ?? topic[0].toUpperCase() + topic.slice(1);
			const entry = map.get(label);
			if (entry) {
				entry.count += 1;
				entry.convs.push({ date, startTime: conv.startTime });
			} else {
				map.set(label, {
					count: 1,
					convs: [{ date, startTime: conv.startTime }],
				});
			}
		}
	}
	return map;
}

function TopicDetailModal({
	label,
	detail,
	onClose,
	onDateSelect,
}: {
	label: string;
	detail: { count: number; convs: TopicConvRef[] };
	onClose: () => void;
	onDateSelect: (date: string) => void;
}) {
	const sorted = [...detail.convs].sort(
		(a, b) =>
			b.date.localeCompare(a.date) || b.startTime.localeCompare(a.startTime),
	);
	return (
		<div
			style={{
				position: "fixed",
				inset: 0,
				zIndex: 600,
				backdropFilter: "blur(6px)",
				backgroundColor: "rgba(0,0,0,0.25)",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				padding: "0 16px",
			}}
			onClick={(e) => {
				if (e.target === e.currentTarget) onClose();
			}}
		>
			<div
				style={{
					background: "#fff",
					borderRadius: 20,
					maxWidth: 360,
					width: "100%",
					boxShadow: "0 22px 50px rgba(0,0,0,0.14)",
					border: `1px solid ${C.cardBorder}`,
					maxHeight: "80vh",
					display: "flex",
					flexDirection: "column",
					overflow: "hidden",
				}}
			>
				<div
					style={{
						padding: "18px 20px 14px",
						borderBottom: `1px solid ${C.divider}`,
						display: "flex",
						alignItems: "flex-start",
						justifyContent: "space-between",
						gap: 12,
					}}
				>
					<div>
						<h2
							style={{
								margin: 0,
								fontSize: 16,
								fontWeight: 600,
								color: C.tealDark,
								fontFamily: SF,
							}}
						>
							{label}
						</h2>
						<p
							style={{
								margin: "3px 0 0",
								fontSize: 12,
								color: C.textSub,
								fontFamily: SF_TEXT,
							}}
						>
							{detail.count} conversa{detail.count !== 1 ? "s" : ""}
						</p>
					</div>
					<button
						type="button"
						onClick={onClose}
						style={{
							background: "rgba(0,0,0,0.05)",
							border: "none",
							borderRadius: 8,
							cursor: "pointer",
							color: C.textSub,
							width: 28,
							height: 28,
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							fontSize: 14,
							flexShrink: 0,
						}}
					>
						✕
					</button>
				</div>
				<div
					style={{
						overflowY: "auto",
						padding: "12px 16px",
						display: "flex",
						flexDirection: "column",
						gap: 8,
					}}
				>
					{sorted.map((conv, i) => (
						<button
							key={i}
							type="button"
							onClick={() => {
								onDateSelect(conv.date);
								onClose();
							}}
							className="text-left transition-all hover:opacity-80 active:scale-[0.98]"
							style={{
								display: "flex",
								alignItems: "center",
								gap: 12,
								background: "rgba(248,252,250,0.9)",
								border: `1px solid ${C.cardBorder}`,
								borderRadius: 12,
								padding: "11px 14px",
								cursor: "pointer",
								width: "100%",
							}}
						>
							<div
								style={{
									width: 36,
									height: 36,
									borderRadius: "50%",
									background: "rgba(45,191,160,0.12)",
									display: "flex",
									alignItems: "center",
									justifyContent: "center",
									flexShrink: 0,
								}}
							>
								<span
									style={{
										fontSize: 11,
										fontWeight: 700,
										color: C.teal,
										fontFamily: SF_TEXT,
									}}
								>
									{i + 1}
								</span>
							</div>
							<div style={{ minWidth: 0 }}>
								<div
									style={{
										fontSize: 13,
										fontWeight: 500,
										color: C.tealDark,
										fontFamily: SF_TEXT,
										textTransform: "capitalize",
									}}
								>
									{formatLongDate(conv.date)}
								</div>
								<div
									style={{
										fontSize: 11,
										color: C.textSub,
										marginTop: 2,
										fontFamily: SF_TEXT,
									}}
								>
									{new Date(conv.startTime).toLocaleTimeString("pt-PT", {
										hour: "2-digit",
										minute: "2-digit",
									})}
								</div>
							</div>
						</button>
					))}
				</div>
			</div>
		</div>
	);
}

// ── Main component ────────────────────────────────────────────────────────
function RouteComponent() {
	const { residentId: seniorId, lang } = Route.useParams();
	const t = dictionary(lang);
	const router = useRouter();
	const setPageBackground = usePageBackgroundStore((s) => s.setBackground);
	const setHideFooter = usePageBackgroundStore((s) => s.setHideFooter);
	const globalBackground = usePageBackgroundStore((s) => s.globalBackground);
	const effectiveBackground = globalBackground ?? BG;

	const [availableDates, setAvailableDates] = useState<string[]>([]);
	const [selectedDate, setSelectedDate] = useState<string | null>(null); // null = Geral
	const [report, setReport] = useState<ConversationReportResponse | null>(null);
	const [reportsByDate, setReportsByDate] = useState<
		Record<string, ConversationReportResponse>
	>({});
	const [trend, setTrend] = useState<EmotionalTrendResponse | null>(null);
	const [seniorName, setSeniorName] = useState<string>("");
	const [birthDate, setBirthDate] = useState<string>("");
	const [institutionType, setInstitutionType] = useState<
		"ipss" | "family" | null
	>(null);
	const [totalSeniors, setTotalSeniors] = useState<number | null>(null);
	const [loading, setLoading] = useState(true);
	const [sessionLogPage, setSessionLogPage] = useState(0);
	const [expandedConv, setExpandedConv] = useState<number | null>(null);
	const [showCalendar, setShowCalendar] = useState(false);
	const [caregiverChatOpen, setCaregiverChatOpen] = useState(false);
	const [caregiverChatInput, setCaregiverChatInput] = useState("");
	const [caregiverChatMessages, setCaregiverChatMessages] = useState<
		CaregiverChatDemoMessage[]
	>(() => [buildChatWelcome("")]);
	const [trendPage, setTrendPage] = useState(0);
	const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
	const calendarRef = useRef<HTMLDivElement>(null);
	const interactionScrollRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		setPageBackground(effectiveBackground);
		setHideFooter(true);
		return () => {
			setPageBackground(null);
			setHideFooter(false);
		};
	}, [effectiveBackground, setPageBackground, setHideFooter]);

	useEffect(() => {
		if (!seniorName) return;
		setCaregiverChatMessages((prev) =>
			prev.map((msg) =>
				msg.id === "assistant-demo-start" ? buildChatWelcome(seniorName) : msg,
			),
		);
	}, [seniorName]);

	// Close calendar on outside click
	useEffect(() => {
		function handleClick(e: MouseEvent) {
			if (
				calendarRef.current &&
				!calendarRef.current.contains(e.target as Node)
			) {
				setShowCalendar(false);
			}
		}
		if (showCalendar) document.addEventListener("mousedown", handleClick);
		return () => document.removeEventListener("mousedown", handleClick);
	}, [showCalendar]);

	useEffect(() => {
		if (!caregiverChatOpen) return;

		const handleEscape = (event: KeyboardEvent) => {
			if (event.key === "Escape") setCaregiverChatOpen(false);
		};

		window.addEventListener("keydown", handleEscape);
		return () => window.removeEventListener("keydown", handleEscape);
	}, [caregiverChatOpen]);

	const dailySessionLogs = useMemo<SessionLogItem[]>(
		() =>
			(report?.sessionLog ?? []).map((entry) => ({
				status:
					entry.userOutcome ??
					(entry.status === "successful"
						? "Sucesso"
						: entry.status === "cancelled"
							? "Cancelada"
							: "Abandonada"),
				timestamp: entry.startTime,
				note: entry.userNote ?? undefined,
			})),
		[report],
	);

	const conversationTopics: Record<string, string> = t.conversationTopics;

	useEffect(() => {
		const load = async () => {
			setLoading(true);
			const [seniorRes, seniorsRes, datesRes, trendRes, instRes, dashRes] =
				await Promise.all([
					api_client.seniors[":seniorId"].$get({ param: { seniorId } }),
					api_client.seniors.$get(),
					api_client.seniors["available-dates"].$get(),
					api_client.seniors[":seniorId"]["emotional-trend"].$get({
						param: { seniorId },
					}),
					api_client.caregiver.institution.$get(),
					api_client.caregiver.dashboard.$get(),
				]);
			let nextSeniorName = "";
			let nextBirthDate = "";
			if (seniorRes.ok) {
				const senior = await seniorRes.json();
				nextSeniorName = resolveSeniorDisplayName(senior);
				nextBirthDate = (senior as { birthDate?: string }).birthDate ?? "";
			}
			if (seniorsRes.ok) {
				const seniors = (await seniorsRes.json()) as SeniorResponse[];
				const seniorFromList = seniors.find((senior) => senior.id === seniorId);
				if (seniorFromList) {
					if (!nextSeniorName) {
						nextSeniorName = resolveSeniorDisplayName(seniorFromList);
					}
					if (!nextBirthDate) {
						nextBirthDate = seniorFromList.birthDate ?? "";
					}
				}
			}
			setBirthDate(nextBirthDate);
			if (instRes.ok) {
				const inst = (await instRes.json()) as { type: "ipss" | "family" };
				setInstitutionType(inst.type);
			}
			if (dashRes.ok) {
				const dash = (await dashRes.json()) as CaregiverDashboardResponse;
				setTotalSeniors(dash.totalSeniors);
				const dashboardSenior = dash.seniors.find(
					(senior) => senior.seniorId === seniorId,
				);
				if (!nextSeniorName && dashboardSenior) {
					nextSeniorName = resolveSeniorDisplayName(dashboardSenior);
				}
			}
			setSeniorName(nextSeniorName);
			if (datesRes.ok) {
				const all = (await datesRes.json()) as Array<{
					seniorId: string;
					dates: string[];
				}>;
				const entry = all.find((e) => e.seniorId === seniorId);
				const dates = [...(entry?.dates ?? [])].sort((a, b) =>
					a.localeCompare(b),
				);
				setAvailableDates(dates);

				if (dates.length > 0) {
					const reports = await Promise.all(
						dates.map(async (date) => {
							const res = await api_client.seniors[":seniorId"].report[
								":date"
							].$get({ param: { seniorId, date } });
							if (!res.ok) return null;
							return [
								date,
								(await res.json()) as ConversationReportResponse,
							] as const;
						}),
					);
					setReportsByDate(
						Object.fromEntries(
							reports.filter(
								(item): item is readonly [string, ConversationReportResponse] =>
									item !== null,
							),
						),
					);
				} else {
					setReportsByDate({});
				}
			}
			if (trendRes.ok)
				setTrend((await trendRes.json()) as EmotionalTrendResponse);
			setLoading(false);
		};
		void load();
	}, [seniorId]);

	const sendCaregiverChatDemoMessage = () => {
		const text = caregiverChatInput.trim();
		if (!text) return;

		const stamp = Date.now();
		setCaregiverChatMessages((current) => [
			...current,
			{ id: `user-${stamp}`, role: "user", text },
			{
				id: `assistant-${stamp}`,
				role: "assistant",
				text: CHAT_DEMO_FALLBACK_REPLY,
			},
		]);
		setCaregiverChatInput("");
	};

	useEffect(() => {
		if (!selectedDate) {
			setReport(null);
			return;
		}

		const cachedReport = reportsByDate[selectedDate];
		if (cachedReport) {
			setReport(cachedReport);
			return;
		}

		const load = async () => {
			const res = await api_client.seniors[":seniorId"].report[":date"].$get({
				param: { seniorId, date: selectedDate },
			});
			if (res.ok) {
				const data = (await res.json()) as ConversationReportResponse;
				setReportsByDate((current) => ({ ...current, [selectedDate]: data }));
				setReport(data);
			}
		};
		void load();
	}, [reportsByDate, selectedDate, seniorId]);

	// Reset expanded conv on date change
	useEffect(() => {
		setExpandedConv(null);
	}, [selectedDate]);
	useEffect(() => {
		setSessionLogPage(0);
	}, [selectedDate]);

	const overallReports = useMemo(
		() =>
			availableDates
				.map((date) => reportsByDate[date])
				.filter((entry): entry is ConversationReportResponse => Boolean(entry)),
		[availableDates, reportsByDate],
	);

	const dailyInteractionSeries = useMemo(() => {
		if (selectedDate && report) {
			return [
				{
					date: report.date,
					label: formatShortDate(report.date),
					minutes: report.conversations.reduce(
						(sum, conversation) => sum + conversation.duration,
						0,
					),
				},
			];
		}

		return overallReports.map((entry) => ({
			date: entry.date,
			label: formatShortDate(entry.date),
			minutes: entry.conversations.reduce(
				(sum, conversation) => sum + conversation.duration,
				0,
			),
		}));
	}, [overallReports, report, selectedDate]);

	const overallSessionLogs = useMemo<SessionLogItem[]>(
		() =>
			overallReports
				.flatMap((entry) =>
					(entry.sessionLog ?? []).map((log) => ({
						status:
							log.userOutcome ??
							(log.status === "successful"
								? "Sucesso"
								: log.status === "cancelled"
									? "Cancelada"
									: "Abandonada"),
						timestamp: log.startTime,
						note: log.userNote ?? undefined,
					})),
				)
				.sort(
					(a, b) =>
						new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
				),
		[overallReports],
	);

	const overallConversations = useMemo(
		() =>
			overallReports.flatMap((entry) =>
				entry.conversations.map((conversation) => ({
					...conversation,
					reportDate: entry.date,
				})),
			),
		[overallReports],
	);

	const buildTopicEntries = (
		conversations: Array<{ mainTopics: string[] }>,
	) => {
		const topicCounts = new Map<string, number>();
		for (const conversation of conversations) {
			for (const topic of conversation.mainTopics) {
				const label =
					conversationTopics[topic] ?? topic[0].toUpperCase() + topic.slice(1);
				topicCounts.set(label, (topicCounts.get(label) ?? 0) + 1);
			}
		}
		return [...topicCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 16);
	};

	const overallTopicEntries = buildTopicEntries(overallConversations);
	const dayTopicEntries = buildTopicEntries(report?.conversations ?? []);

	const dayConversations = report?.conversations ?? [];
	const dayTones = dayConversations.map((c) => c.emotionalTone);
	const dominantTone = resolveDominantTone(dayTones) ?? "neutro";
	const totalMinutes =
		report?.conversations.reduce((sum, c) => sum + c.duration, 0) ?? 0;
	const overallTones = overallConversations.map(
		(conversation) => conversation.emotionalTone,
	);
	const overallToneCounts = buildToneCounts(overallTones);
	const overallDominantTone = overallToneCounts[0]?.label ?? "—";
	const overallTotalMinutes = overallConversations.reduce(
		(sum, conversation) => sum + conversation.duration,
		0,
	);
	const overallTotalConversations = overallConversations.length;
	const isFamilySingleSenior =
		institutionType === "family" && totalSeniors === 1;
	const seniorAge = calculateAge(birthDate);
	const displayTotalConversations =
		selectedDate && report
			? (report.totalConversations ?? 0)
			: overallTotalConversations;
	const displayTotalMinutes =
		selectedDate && report ? totalMinutes : overallTotalMinutes;
	const displayDominantTone =
		selectedDate && report
			? dayTones.length > 0
				? toneLabel(dominantTone)
				: "—"
			: overallDominantTone;
	const displayMoodSummary = buildMoodSummary(
		selectedDate && report ? dayTones : overallTones,
	);
	const visibleTopicEntries =
		selectedDate && report ? dayTopicEntries : overallTopicEntries;
	const visibleSessionLogs = useMemo(
		() =>
			uniqueSessionLogs(selectedDate ? dailySessionLogs : overallSessionLogs),
		[dailySessionLogs, overallSessionLogs, selectedDate],
	);
	const totalSessionPages = Math.max(
		1,
		Math.ceil(visibleSessionLogs.length / SESSION_LOG_PAGE_SIZE),
	);
	useEffect(() => {
		if (sessionLogPage > totalSessionPages - 1) {
			setSessionLogPage(totalSessionPages - 1);
		}
	}, [sessionLogPage, totalSessionPages]);
	const displaySeniorName = seniorName || "Sénior";
	const averageMinutesPerInteraction =
		dailyInteractionSeries.length > 0
			? Number(
					(
						dailyInteractionSeries.reduce((sum, e) => sum + e.minutes, 0) /
						dailyInteractionSeries.length
					).toFixed(1),
				)
			: 0;
	const latestInteractionDate =
		dailyInteractionSeries[dailyInteractionSeries.length - 1]?.date ?? "";
	const pagedSessionLogs = useMemo(
		() =>
			visibleSessionLogs.slice(
				sessionLogPage * SESSION_LOG_PAGE_SIZE,
				(sessionLogPage + 1) * SESSION_LOG_PAGE_SIZE,
			),
		[visibleSessionLogs, sessionLogPage],
	);
	const emotionalTrendDays = useMemo(() => {
		const trendToneByDate = new Map(
			(trend?.entries ?? []).map((entry) => [entry.date, entry.emotionalTone]),
		);
		return [...availableDates]
			.sort((a, b) => a.localeCompare(b))
			.map((date) => {
				const toneFromTrend = trendToneByDate.get(date);
				const toneFromReport = resolveDominantTone(
					reportsByDate[date]?.conversations?.map(
						(conversation) => conversation.emotionalTone,
					) ?? [],
				);
				const emotionalTone = toneFromTrend ?? toneFromReport ?? "neutro";
				return {
					date,
					weekday: new Date(date).toLocaleDateString("pt-PT", {
						weekday: "short",
					}),
					day: new Date(date).toLocaleDateString("pt-PT", {
						day: "numeric",
						month: "short",
					}),
					...emotionalCircleState(emotionalTone),
				};
			});
	}, [availableDates, reportsByDate, trend]);

	const dateToneMap = useMemo(() => {
		const map: Record<string, string> = {};
		for (const day of emotionalTrendDays) map[day.date] = day.key;
		return map;
	}, [emotionalTrendDays]);

	const visibleTopicDetailMap = useMemo(() => {
		const convs =
			selectedDate && report
				? report.conversations.map((c) => ({ ...c, reportDate: selectedDate }))
				: overallConversations;
		return buildTopicDetailMap(convs, conversationTopics);
	}, [selectedDate, report, overallConversations, conversationTopics]);

	const totalTrendPages = Math.max(1, Math.ceil(emotionalTrendDays.length / 4));
	// Page 0 = most recent 4 days; higher pages = older days
	const visibleEmotionalTrendDays = (() => {
		const total = emotionalTrendDays.length;
		const end = total - trendPage * 4;
		const start = Math.max(0, end - 4);
		return emotionalTrendDays.slice(start, end);
	})();
	const emotionalTrendLeadingEmptySlots = Math.max(
		0,
		4 - visibleEmotionalTrendDays.length,
	);

	useEffect(() => {
		setTrendPage(0);
	}, [seniorId]);

	useEffect(() => {
		if (selectedDate) return;
		const scroller = interactionScrollRef.current;
		if (!scroller) return;

		const frame = window.requestAnimationFrame(() => {
			scroller.scrollLeft = scroller.scrollWidth - scroller.clientWidth;
		});

		return () => window.cancelAnimationFrame(frame);
	}, [dailyInteractionSeries.length, latestInteractionDate, selectedDate]);

	useEffect(() => {
		if (trendPage > totalTrendPages - 1) setTrendPage(0);
	}, [totalTrendPages, trendPage]);

	if (loading) {
		return (
			<div
				style={{
					height: "100%",
					background: effectiveBackground,
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
				}}
			>
				<div
					className="loading loading-spinner loading-lg"
					style={{ color: C.teal }}
				/>
			</div>
		);
	}

	return (
		<div
			style={{
				height: "100%",
				width: "100%",
				background: effectiveBackground,
				display: "flex",
				flexDirection: "column",
				overflow: "hidden",
				position: "relative",
			}}
		>
			{/* Ambient orbs */}
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
							"radial-gradient(circle at 12% 22%, rgba(255,252,226,0.42), transparent 34%)",
					}}
				/>
				<div
					style={{
						position: "absolute",
						inset: 0,
						background:
							"radial-gradient(circle at 90% 82%, rgba(185,235,220,0.38), transparent 34%)",
					}}
				/>
			</div>

			<style>{`
        @keyframes chatbotDriftA {
          0% { transform: translate3d(0, 0, 0) scale(1); opacity: 0.42; }
          50% { transform: translate3d(10px, -8px, 0) scale(1.08); opacity: 0.62; }
          100% { transform: translate3d(0, 0, 0) scale(1); opacity: 0.42; }
        }
        @keyframes chatbotDriftB {
          0% { transform: translate3d(0, 0, 0) scale(1); opacity: 0.28; }
          50% { transform: translate3d(-12px, 10px, 0) scale(1.12); opacity: 0.44; }
          100% { transform: translate3d(0, 0, 0) scale(1); opacity: 0.28; }
        }
        @keyframes chatbotFloatShell {
          0% { transform: translateY(0px) rotateX(0deg); box-shadow: 0 14px 28px rgba(8, 34, 35, 0.18); }
          50% { transform: translateY(-2px) rotateX(1.5deg); box-shadow: 0 18px 34px rgba(8, 34, 35, 0.22); }
          100% { transform: translateY(0px) rotateX(0deg); box-shadow: 0 14px 28px rgba(8, 34, 35, 0.18); }
        }
      `}</style>

			{caregiverChatOpen && (
				<div
					role="presentation"
					onClick={() => setCaregiverChatOpen(false)}
					style={{
						position: "fixed",
						inset: 0,
						zIndex: 600,
						background: "rgba(8, 34, 35, 0.34)",
						backdropFilter: "blur(12px)",
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						padding: 20,
					}}
				>
					<div
						role="dialog"
						aria-modal="true"
						aria-labelledby="caregiver-chat-title"
						onClick={(event) => event.stopPropagation()}
						style={{ width: "min(520px, 100%)", height: "min(680px, 92vh)" }}
					>
						<CaregiverChatPanel
							titleId="caregiver-chat-title"
							messages={caregiverChatMessages}
							input={caregiverChatInput}
							onInputChange={setCaregiverChatInput}
							onSend={sendCaregiverChatDemoMessage}
							onClose={() => setCaregiverChatOpen(false)}
							style={{ boxShadow: "0 28px 80px rgba(8,34,35,0.24)" }}
						/>
					</div>
				</div>
			)}

			{/* ── Scrollable page ── */}
			<div
				style={{
					position: "relative",
					zIndex: 1,
					flex: 1,
					overflowY: "auto",
					boxSizing: "border-box",
				}}
				className="px-5 sm:px-8 xl:px-12 pb-8"
			>
				{/* Top frame */}
				<div
					className="flex items-start justify-between gap-6"
					style={{ paddingTop: 20 }}
				>
					{!isFamilySingleSenior && (
						<button
							type="button"
							onClick={() =>
								router.navigate({ to: "/$lang/caretaker", params: { lang } })
							}
							style={{
								display: "flex",
								alignItems: "center",
								gap: 6,
								background: "none",
								border: "none",
								cursor: "pointer",
								color: "#111111",
								fontSize: 13,
								fontFamily: SF_TEXT,
								padding: 0,
							}}
						>
							<IoCaretBackOutline size={16} />
							Dashboard
						</button>
					)}
					<img
						src="/compyTextLogo.png"
						alt="Compy"
						style={{ height: 30, filter: "brightness(0.08) saturate(1.02)" }}
						className="block md:h-[38px] object-contain"
					/>
					{isFamilySingleSenior && (
						<Settings locale={lang} btnClassName="text-black" />
					)}
				</div>

				<div style={{ paddingTop: 18 }}>
					<div style={{ paddingBottom: 8 }}>
						<h1
							style={{
								fontSize: "clamp(2.8rem, 5vw, 4.2rem)",
								fontWeight: 300,
								color: "#111111",
								fontFamily: SF,
								letterSpacing: "-1.5px",
								lineHeight: 0.95,
								display: "flex",
								alignItems: "baseline",
								gap: 8,
								flexWrap: "wrap",
							}}
						>
							<span>{displaySeniorName},</span>
							{seniorAge !== null && (
								<span
									style={{
										fontSize: "clamp(1.75rem, 3vw, 2.35rem)",
										fontWeight: 200,
										fontStyle: "italic",
										color: "#111111",
									}}
								>
									{seniorAge} anos
								</span>
							)}
						</h1>
					</div>

					<div
						className="flex items-center justify-between gap-3 flex-wrap"
						style={{ paddingBottom: 6 }}
					>
						<div className="flex items-center gap-2.5 flex-wrap">
							<button
								type="button"
								onClick={() => setSelectedDate(null)}
								style={{
									fontSize: 13,
									fontWeight: selectedDate === null ? 500 : 400,
									fontFamily: SF_TEXT,
									color: selectedDate === null ? "#ffffff" : "#356f69",
									background:
										selectedDate === null ? "#2DBFA0" : "rgba(0,0,0,0.045)",
									border: "none",
									borderRadius: 100,
									padding: "6px 14px",
									cursor: "pointer",
								}}
							>
								Geral
							</button>
							<div ref={calendarRef} style={{ position: "relative" }}>
								<button
									type="button"
									onClick={() => setShowCalendar((v) => !v)}
									style={{
										display: "flex",
										alignItems: "center",
										gap: 7,
										fontSize: 13,
										fontWeight: 500,
										fontFamily: SF_TEXT,
										color: selectedDate ? "#ffffff" : "#356f69",
										background: selectedDate ? "#2DBFA0" : "rgba(0,0,0,0.045)",
										border: "none",
										borderRadius: 100,
										padding: "6px 14px",
										cursor: "pointer",
									}}
								>
									<HiCalendarDays size={14} />
									{selectedDate ? formatLongDate(selectedDate) : "Escolher dia"}
								</button>
								{showCalendar && (
									<div
										style={{
											position: "absolute",
											top: 40,
											left: 0,
											zIndex: 300,
										}}
									>
										<MiniCalendar
											availableDates={availableDates}
											selectedDate={selectedDate}
											onSelect={(d) => {
												setSelectedDate(d);
												setShowCalendar(false);
											}}
											dateToneMap={dateToneMap}
										/>
									</div>
								)}
							</div>
						</div>
						<button
							type="button"
							onClick={() =>
								isFamilySingleSenior
									? router.navigate({
											to: "/$lang/caretaker/seniors/$residentId",
											params: { lang, residentId: seniorId },
											search: () => ({ tab: undefined }),
										})
									: router.navigate({
											to: "/$lang/caretaker/seniors/$residentId",
											params: { lang, residentId: seniorId },
											search: () => ({ tab: "notas" }),
										})
							}
							style={{
								fontSize: 13,
								fontWeight: 600,
								fontFamily: SF_TEXT,
								color: "#ffffff",
								background: "#0a4a45",
								border: "none",
								borderRadius: 100,
								padding: "6px 14px",
								cursor: "pointer",
								boxShadow: "0 8px 18px rgba(8,34,35,0.12)",
							}}
						>
							{isFamilySingleSenior ? "Perfil" : "Notas do cuidador"}
						</button>
					</div>
				</div>

				{/* No data */}
				{availableDates.length === 0 && (
					<div
						style={{
							textAlign: "center",
							paddingTop: 30,
							fontSize: 15,
							color: C.textSub,
							fontFamily: SF_TEXT,
							paddingBottom: 30,
						}}
					>
						Ainda não há conversas registadas para este sénior.
					</div>
				)}

				<div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.45fr)_minmax(340px,0.95fr)] gap-3">
					<div className="xl:row-start-1 xl:col-start-1 grid grid-cols-2 md:grid-cols-[170px_170px_minmax(0,1fr)] gap-3 items-stretch">
						<div
							style={{
								background: SOFT_BG_CARD,
								borderRadius: 20,
								padding: "16px 16px 12px",
								boxShadow: CARD_SHADOW,
								border: `1px solid ${C.cardBorder}`,
								minHeight: 152,
								display: "flex",
								flexDirection: "column",
								justifyContent: "center",
								alignItems: "center",
								textAlign: "center",
								gap: 18,
							}}
						>
							<div
								style={{
									fontSize: 60,
									fontWeight: 300,
									lineHeight: 1,
									color: "#085c58",
									fontFamily: SF,
								}}
							>
								{displayTotalConversations}
							</div>
							<div
								style={{
									marginTop: 6,
									fontSize: 12,
									lineHeight: 1.05,
									color: "#2f7770",
									fontFamily: SF_TEXT,
									textTransform: "uppercase",
								}}
							>
								Total de
								<br />
								conversas
							</div>
						</div>

						<div
							style={{
								background: SOFT_BG_CARD,
								borderRadius: 20,
								padding: "16px 16px 12px",
								boxShadow: CARD_SHADOW,
								border: `1px solid ${C.cardBorder}`,
								minHeight: 152,
								display: "flex",
								flexDirection: "column",
								justifyContent: "center",
								alignItems: "center",
								textAlign: "center",
								gap: 18,
							}}
						>
							<div
								style={{
									minHeight: 64,
									display: "flex",
									alignItems: "center",
									justifyContent: "center",
								}}
							>
								<RollingNumber value={displayTotalMinutes} />
							</div>
							<div
								style={{
									marginTop: 6,
									fontSize: 12,
									lineHeight: 1.05,
									color: "#2f7770",
									fontFamily: SF_TEXT,
									textTransform: "uppercase",
								}}
							>
								Minutos de conversa
							</div>
						</div>

						<div
							className="hidden md:flex"
							style={{
								height: 318,
								minHeight: 318,
								maxHeight: 318,
								minWidth: 0,
								overflow: "hidden",
							}}
						>
							<CaregiverChatPanel
								titleId="caregiver-chat-inline-title"
								messages={caregiverChatMessages}
								input={caregiverChatInput}
								onInputChange={setCaregiverChatInput}
								onSend={sendCaregiverChatDemoMessage}
							/>
						</div>
					</div>

					<div className="md:hidden" style={{ marginTop: 2 }}>
						<button
							type="button"
							aria-label="Abrir Chat compy"
							onClick={() => setCaregiverChatOpen(true)}
							style={{
								width: "100%",
								minWidth: 58,
								height: 58,
								display: "flex",
								alignItems: "center",
								justifyContent: "space-between",
								gap: 10,
								background:
									"linear-gradient(135deg, rgba(11,96,90,0.96) 0%, rgba(9,78,73,0.98) 100%)",
								borderRadius: 18,
								padding: "8px 10px",
								boxShadow: "0 12px 24px rgba(8,34,35,0.14)",
								border: "1px solid rgba(255,255,255,0.08)",
								position: "relative",
								overflow: "hidden",
								animation: "chatbotFloatShell 6.5s ease-in-out infinite",
								transition:
									"width 320ms cubic-bezier(0.2, 0.8, 0.2, 1), padding 320ms cubic-bezier(0.2, 0.8, 0.2, 1)",
								cursor: "pointer",
							}}
						>
							<div
								aria-hidden="true"
								style={{
									position: "absolute",
									width: 82,
									height: 82,
									borderRadius: "50%",
									background:
										"radial-gradient(circle, rgba(45,191,160,0.22) 0%, rgba(45,191,160,0) 72%)",
									top: -22,
									right: 24,
									filter: "blur(10px)",
									animation: "chatbotDriftA 7s ease-in-out infinite",
								}}
							/>
							<div
								style={{
									width: 36,
									height: 36,
									borderRadius: "50%",
									background:
										"linear-gradient(145deg, rgba(255,255,255,0.16), rgba(255,255,255,0.06))",
									border: "1px solid rgba(255,255,255,0.14)",
									boxShadow:
										"inset 0 1px 0 rgba(255,255,255,0.16), 0 8px 16px rgba(0,0,0,0.14)",
									display: "flex",
									alignItems: "center",
									justifyContent: "center",
									flexShrink: 0,
									position: "relative",
									zIndex: 1,
								}}
							>
								<img
									src={CHATBOT_AVATAR_URL}
									alt=""
									style={{
										width: 18,
										height: 18,
										objectFit: "contain",
										filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.12))",
									}}
								/>
							</div>

							<div
								style={{
									minWidth: 0,
									flex: 1,
									position: "relative",
									zIndex: 1,
									overflow: "hidden",
								}}
							>
								<span
									style={{
										color: "#ffffff",
										fontSize: 11,
										fontWeight: 500,
										fontFamily: SF_TEXT,
										letterSpacing: "-0.15px",
										lineHeight: 1.2,
										display: "inline-block",
										whiteSpace: "nowrap",
										overflow: "hidden",
									}}
								>
									Mostra-me os dias mais positivos.
								</span>
							</div>

							<div
								className="flex items-center gap-1.5"
								style={{ position: "relative", zIndex: 1, flexShrink: 0 }}
							>
								<div
									style={{
										width: 26,
										height: 26,
										borderRadius: "50%",
										border: "1px solid rgba(255,255,255,0.12)",
										background:
											"linear-gradient(145deg, rgba(255,255,255,0.12), rgba(255,255,255,0.04))",
										color: "#d9fffa",
										display: "flex",
										alignItems: "center",
										justifyContent: "center",
										boxShadow: "0 6px 14px rgba(0,0,0,0.12)",
									}}
								>
									<HiMiniMicrophone size={12} />
								</div>
								<div
									style={{
										width: 26,
										height: 26,
										borderRadius: "50%",
										border: "1px solid rgba(120,255,225,0.18)",
										background:
											"linear-gradient(145deg, rgba(45,191,160,0.34), rgba(45,191,160,0.12))",
										color: "#ffffff",
										display: "flex",
										alignItems: "center",
										justifyContent: "center",
										boxShadow:
											"0 8px 16px rgba(5, 42, 42, 0.18), inset 0 1px 0 rgba(255,255,255,0.15)",
									}}
								>
									<IoPaperPlaneOutline size={11} />
								</div>
							</div>
						</button>
					</div>

					<Card
						className="xl:row-start-1 xl:col-start-2"
						style={{ background: "#FFFFFF", padding: 20 }}
					>
						<SectionLabel>
							{selectedDate ? "Tópicos do dia" : "Tópicos de conversa no geral"}
						</SectionLabel>
						<div
							style={{
								minHeight: 152,
								display: "flex",
								alignItems: "center",
								justifyContent: "center",
							}}
						>
							<WordCloud
								entries={visibleTopicEntries}
								emptyLabel={
									selectedDate
										? "Sem tópicos para este dia"
										: "Sem tópicos agregados para este sénior"
								}
								onTopicClick={(label) => setSelectedTopic(label)}
							/>
						</div>
					</Card>

					<div
						className={`xl:row-start-2 xl:col-start-1 grid gap-3 items-stretch ${!selectedDate ? "grid-cols-1 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]" : "grid-cols-1"}`}
					>
						{!selectedDate && (
							<div
								style={{
									background: "#FFFFFF",
									borderRadius: 20,
									padding: 16,
									boxShadow: CARD_SHADOW,
									border: `1px solid ${C.cardBorder}`,
									minHeight: 286,
								}}
							>
								<div
									style={{
										display: "flex",
										alignItems: "flex-start",
										justifyContent: "space-between",
										gap: 12,
										marginBottom: 10,
									}}
								>
									<SectionLabel>Tempo de interação</SectionLabel>
									<div className="flex items-center gap-2">
										{dailyInteractionSeries.length > 4 && (
											<span
												aria-hidden="true"
												style={{
													width: 24,
													height: 24,
													borderRadius: 999,
													display: "inline-flex",
													alignItems: "center",
													justifyContent: "center",
													background: "rgba(17,75,69,0.06)",
													color: "#6f8f89",
													fontSize: 14,
													lineHeight: 1,
													flexShrink: 0,
												}}
											>
												→
											</span>
										)}
										<div
											style={{
												minWidth: 118,
												background: "rgba(255,255,255,0.58)",
												borderRadius: 14,
												padding: "10px 12px",
												border: `1px solid ${C.cardBorder}`,
												boxShadow: "0 2px 12px rgba(0,0,0,0.03)",
											}}
										>
											<div
												style={{
													fontSize: 10,
													letterSpacing: "0.5px",
													textTransform: "uppercase",
													color: "#8aa29e",
													fontFamily: SF_TEXT,
												}}
											>
												Média / dia
											</div>
											<div
												style={{
													fontSize: 22,
													lineHeight: 1.05,
													fontWeight: 300,
													color: "#0b5a59",
													fontFamily: SF,
												}}
											>
												{averageMinutesPerInteraction} min
											</div>
										</div>
									</div>
								</div>
								{dailyInteractionSeries.length > 0 ? (
									<div
										ref={interactionScrollRef}
										style={{
											height: 212,
											overflowX: "auto",
											overflowY: "hidden",
											paddingBottom: 4,
										}}
									>
										<div
											style={{
												width: Math.max(
													360,
													dailyInteractionSeries.length * 86,
												),
												height: 204,
											}}
										>
											<Chart
												onClick={(e) => {
													const entry = dailyInteractionSeries[e.dataIndex];
													if (entry) setSelectedDate(entry.date);
												}}
												options={{
													grid: { top: 18, left: 16, right: 10, bottom: 34 },
													tooltip: {
														trigger: "axis",
														axisPointer: { type: "shadow" },
														formatter: (
															params: Array<{
																axisValueLabel: string;
																value: number;
															}>,
														) => {
															const point = params[0];
															if (!point) return "";
															return `<div style="font-size:12px;padding:4px 8px;"><strong>${point.axisValueLabel}</strong><br/>${point.value} min · <span style="color:#2DBFA0;font-weight:600">clica para ver</span></div>`;
														},
													},
													xAxis: {
														type: "category",
														data: dailyInteractionSeries.map(
															(entry) => entry.label,
														),
														axisLabel: {
															interval: 0,
															color: "#6f8f89",
															fontSize: 10,
															fontFamily: SF_TEXT,
														},
														axisLine: {
															lineStyle: { color: "rgba(17,75,69,0.10)" },
														},
														axisTick: { show: false },
													},
													yAxis: {
														type: "value",
														axisLabel: { show: false },
														splitLine: { show: false },
														axisLine: { show: false },
														axisTick: { show: false },
													},
													series: [
														{
															type: "bar",
															cursor: "pointer",
															data: dailyInteractionSeries.map((entry) => ({
																value: entry.minutes,
																itemStyle: {
																	color: "rgba(45,191,160,0.7)",
																	borderRadius: [12, 12, 0, 0],
																},
																emphasis: {
																	itemStyle: {
																		color: "rgba(45,191,160,0.95)",
																	},
																},
																label: {
																	show: true,
																	position: "top",
																	color: "#4f736d",
																	fontSize: 10,
																	fontFamily: SF_TEXT,
																	formatter: ({ value }: { value: number }) =>
																		`${value} min`,
																},
															})),
															barWidth: 42,
														},
													],
												}}
											/>
										</div>
									</div>
								) : (
									<p
										style={{
											fontSize: 13,
											color: C.textSub,
											fontFamily: SF_TEXT,
										}}
									>
										Sem dados de interação.
									</p>
								)}
							</div>
						)}

						<div
							style={{
								background: "#FFFFFF",
								borderRadius: 20,
								padding: 16,
								boxShadow: CARD_SHADOW,
								border: `1px solid ${C.cardBorder}`,
								minHeight: 274,
							}}
						>
							<SectionLabel>Tendência emocional</SectionLabel>
							<div
								className="grid grid-cols-1 md:grid-cols-[minmax(0,0.78fr)_minmax(0,1.22fr)] gap-3"
								style={{ marginBottom: 12 }}
							>
								<div
									style={{
										borderRadius: 16,
										border: `1px solid ${C.cardBorder}`,
										background: "rgba(248,252,250,0.78)",
										padding: "13px 14px",
									}}
								>
									<div
										style={{
											fontSize: 10,
											fontWeight: 700,
											letterSpacing: "0.45px",
											color: "#7A918E",
											textTransform: "uppercase",
											fontFamily: SF_TEXT,
										}}
									>
										Tom dominante
									</div>
									<div
										style={{
											marginTop: 6,
											fontSize: "clamp(1.7rem, 3vw, 2.45rem)",
											fontWeight: 300,
											lineHeight: 1,
											color:
												displayDominantTone === "Positivo" ? C.teal : "#3c7f78",
											fontFamily: SF,
										}}
									>
										{displayDominantTone}
									</div>
								</div>

								<div className="grid grid-cols-2 md:grid-cols-4 gap-2">
									{displayMoodSummary.map((item) => (
										<div
											key={item.key}
											style={{
												borderRadius: 16,
												border: `1px solid ${C.cardBorder}`,
												background: "rgba(255,255,255,0.7)",
												padding: "12px 10px",
												minWidth: 0,
											}}
										>
											<div
												className="flex items-center gap-1.5"
												style={{ minWidth: 0 }}
											>
												<div
													style={{
														width: 8,
														height: 8,
														borderRadius: 99,
														background: item.color,
														flexShrink: 0,
													}}
												/>
												<span
													style={{
														fontSize: 10,
														color: "#7A918E",
														fontFamily: SF_TEXT,
														whiteSpace: "nowrap",
														overflow: "hidden",
														textOverflow: "ellipsis",
													}}
												>
													{item.label}
												</span>
											</div>
											<div
												style={{
													marginTop: 8,
													fontSize: 28,
													lineHeight: 1,
													fontWeight: 300,
													color: "#0b5a59",
													fontFamily: SF,
												}}
											>
												{item.count}
											</div>
										</div>
									))}
								</div>
							</div>
							{emotionalTrendDays.length > 0 ? (
								<>
									<div
										style={{
											minHeight: 160,
											display: "grid",
											gridTemplateColumns: "34px minmax(0,1fr) 34px",
											alignItems: "center",
											gap: 8,
										}}
									>
										<button
											type="button"
											onClick={() =>
												setTrendPage((page) =>
													Math.min(totalTrendPages - 1, page + 1),
												)
											}
											disabled={trendPage >= totalTrendPages - 1}
											style={{
												width: 30,
												height: 30,
												borderRadius: 999,
												border: "none",
												background:
													trendPage >= totalTrendPages - 1
														? "rgba(0,0,0,0.03)"
														: "rgba(0,0,0,0.06)",
												color:
													trendPage >= totalTrendPages - 1
														? "#C8C8D2"
														: "#5d6b68",
												display: "flex",
												alignItems: "center",
												justifyContent: "center",
												cursor:
													trendPage >= totalTrendPages - 1
														? "default"
														: "pointer",
												justifySelf: "center",
											}}
										>
											<HiChevronLeft size={16} />
										</button>
										<div
											style={{
												display: "grid",
												gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
												gap: 10,
												alignItems: "start",
											}}
										>
											{Array.from(
												{ length: emotionalTrendLeadingEmptySlots },
												(_, index) => (
													<div key={`empty-leading-${index}`} />
												),
											)}
											{visibleEmotionalTrendDays.map((item) => {
												const isActive = item.date === selectedDate;
												return (
													<button
														key={item.date}
														type="button"
														onClick={() =>
															setSelectedDate(isActive ? null : item.date)
														}
														title={`${formatLongDate(item.date)} · ${item.label}`}
														className="transition-all hover:opacity-90 active:scale-[0.96]"
														style={{
															display: "flex",
															flexDirection: "column",
															alignItems: "center",
															gap: 8,
															background: "none",
															border: "none",
															cursor: "pointer",
															padding: 0,
														}}
													>
														<div
															style={{
																width: "100%",
																aspectRatio: "1 / 1",
																maxWidth: 86,
																borderRadius: "50%",
																background:
																	item.key === "positivo" ? C.teal : item.color,
																display: "flex",
																alignItems: "center",
																justifyContent: "center",
																boxShadow: isActive
																	? `inset 0 1px 0 rgba(255,255,255,0.2), 0 0 0 8px ${item.key === "positivo" ? "rgba(45,191,160,0.18)" : item.key === "melancolico" ? "rgba(217,107,107,0.18)" : "rgba(168,168,183,0.18)"}, 0 0 24px 4px ${item.key === "positivo" ? "rgba(45,191,160,0.28)" : item.key === "melancolico" ? "rgba(217,107,107,0.28)" : "rgba(168,168,183,0.28)"}`
																	: "inset 0 1px 0 rgba(255,255,255,0.2), 0 10px 22px rgba(0,0,0,0.08)",
															}}
														>
															<span
																style={{
																	color: "#ffffff",
																	fontSize:
																		item.key === "melancolico" ? 30 : 42,
																	fontWeight: item.key === "neutro" ? 600 : 700,
																	lineHeight: 1,
																	fontFamily: SF,
																	transform:
																		item.key === "melancolico"
																			? "translateY(-2px)"
																			: undefined,
																}}
															>
																{item.symbol}
															</span>
														</div>
														<div style={{ textAlign: "center" }}>
															<div
																style={{
																	fontSize: 11,
																	color: isActive ? C.tealDark : "#65716f",
																	fontWeight: isActive ? 600 : 400,
																	textTransform: "capitalize",
																	fontFamily: SF_TEXT,
																}}
															>
																{item.weekday}
															</div>
															<div
																style={{
																	fontSize: 11,
																	color: isActive ? C.tealDark : "#8E8E96",
																	fontFamily: SF_TEXT,
																}}
															>
																{item.day}
															</div>
														</div>
													</button>
												);
											})}
										</div>
										<button
											type="button"
											onClick={() =>
												setTrendPage((page) => Math.max(0, page - 1))
											}
											disabled={trendPage === 0}
											style={{
												width: 30,
												height: 30,
												borderRadius: 999,
												border: "none",
												background:
													trendPage === 0
														? "rgba(0,0,0,0.03)"
														: "rgba(0,0,0,0.06)",
												color: trendPage === 0 ? "#C8C8D2" : "#5d6b68",
												display: "flex",
												alignItems: "center",
												justifyContent: "center",
												cursor: trendPage === 0 ? "default" : "pointer",
												justifySelf: "center",
											}}
										>
											<HiChevronRight size={16} />
										</button>
									</div>
								</>
							) : (
								<div
									style={{
										minHeight: 192,
										display: "flex",
										alignItems: "center",
										justifyContent: "center",
									}}
								>
									<p
										style={{
											fontSize: 18,
											color: "#2f7770",
											fontFamily: SF_TEXT,
										}}
									>
										Sem tendência emocional disponível.
									</p>
								</div>
							)}
						</div>
					</div>

					{selectedDate && report && (
						<Card
							className="xl:col-start-1 xl:col-span-2"
							style={{ background: "#FFFFFF", padding: 20 }}
						>
							<SectionLabel>Tom por conversa</SectionLabel>
							{dayConversations.length > 0 ? (
								<div style={{ display: "flex", flexDirection: "column" }}>
									{dayConversations.map((conv, i) => {
										const tone = conv.emotionalTone;
										const pill = isMissingTone(tone)
											? tonePill(-1)
											: tonePill(toneScore(tone));
										const isExpanded = expandedConv === i;
										return (
											<div
												key={`${conv.startTime}-${i}`}
												style={{
													borderBottom:
														i < dayConversations.length - 1
															? `0.5px solid ${C.divider}`
															: "none",
												}}
											>
												<button
													type="button"
													onClick={() => setExpandedConv(isExpanded ? null : i)}
													style={{
														width: "100%",
														display: "flex",
														alignItems: "center",
														gap: 12,
														background: "none",
														border: "none",
														cursor: "pointer",
														padding: "14px 0",
														textAlign: "left",
													}}
												>
													<span
														style={{
															fontSize: 14,
															fontWeight: 500,
															color: C.tealDark,
															width: 44,
															flexShrink: 0,
															fontFamily: SF_TEXT,
														}}
													>
														{conv
															? new Date(conv.startTime).toLocaleTimeString(
																	"pt-PT",
																	{ hour: "2-digit", minute: "2-digit" },
																)
															: `#${i + 1}`}
													</span>
													<span
														style={{
															fontSize: 12,
															fontWeight: 500,
															color: pill.text,
															background: pill.bg,
															borderRadius: 100,
															padding: "4px 12px",
															fontFamily: SF_TEXT,
														}}
													>
														{toneLabel(tone)}
													</span>
													{conv.userOutcome &&
														conv.userOutcome !== "Sucesso" && (
															<span
																style={{
																	fontSize: 12,
																	fontWeight: 500,
																	color: (
																		SESSION_STATUS_STYLES[conv.userOutcome] ??
																		SESSION_STATUS_STYLES.Cancelada
																	).text,
																	background: (
																		SESSION_STATUS_STYLES[conv.userOutcome] ??
																		SESSION_STATUS_STYLES.Cancelada
																	).bg,
																	borderRadius: 100,
																	padding: "4px 12px",
																	fontFamily: SF_TEXT,
																}}
															>
																{conv.userOutcome}
															</span>
														)}
													{conv && (
														<span
															style={{
																fontSize: 13,
																color: C.textSub,
																marginLeft: "auto",
																fontFamily: SF_TEXT,
															}}
														>
															{conv.duration} min
														</span>
													)}
													<span
														style={{
															fontSize: 10,
															color: C.textMuted,
															marginLeft: 8,
															fontFamily: SF_TEXT,
														}}
													>
														{isExpanded ? "▲" : "▼"}
													</span>
												</button>
												{isExpanded && conv && (
													<div
														style={{
															background: "rgba(255,255,255,0.58)",
															borderRadius: 16,
															padding: "12px 14px",
															marginTop: 0,
															marginBottom: 12,
														}}
													>
														{conv.summary && (
															<p
																style={{
																	fontSize: 13,
																	color: C.text,
																	marginBottom: 8,
																	lineHeight: 1.5,
																	fontFamily: SF_TEXT,
																}}
															>
																{conv.summary}
															</p>
														)}
														{!conv.summary && (
															<p
																style={{
																	fontSize: 13,
																	color: C.textSub,
																	marginBottom: conv.userNote ? 8 : 0,
																	lineHeight: 1.5,
																	fontFamily: SF_TEXT,
																}}
															>
																Sessão sem resumo disponível.
															</p>
														)}
														{conv.userNote && (
															<div
																style={{
																	background: "rgba(45,191,160,0.07)",
																	border: "1px solid rgba(45,191,160,0.18)",
																	borderRadius: 8,
																	padding: "6px 10px",
																	marginBottom:
																		conv.keyPoints.length > 0 ? 8 : 0,
																}}
															>
																<span
																	style={{
																		fontSize: 10,
																		fontWeight: 700,
																		color: C.teal,
																		letterSpacing: "0.4px",
																		textTransform: "uppercase",
																		marginRight: 6,
																		fontFamily: SF_TEXT,
																	}}
																>
																	Nota
																</span>
																<span
																	style={{
																		fontSize: 12,
																		color: C.text,
																		fontFamily: SF_TEXT,
																		lineHeight: 1.4,
																	}}
																>
																	{conv.userNote}
																</span>
															</div>
														)}
														{conv.keyPoints.length > 0 && (
															<ul style={{ paddingLeft: 14, margin: 0 }}>
																{conv.keyPoints.map((kp, j) => (
																	<li
																		key={j}
																		style={{
																			fontSize: 12,
																			color: C.textSub,
																			lineHeight: 1.6,
																			fontFamily: SF_TEXT,
																		}}
																	>
																		{kp}
																	</li>
																))}
															</ul>
														)}
													</div>
												)}
											</div>
										);
									})}
								</div>
							) : (
								<p
									style={{
										fontSize: 13,
										color: C.textSub,
										fontFamily: SF_TEXT,
									}}
								>
									Sem dados para este dia
								</p>
							)}
						</Card>
					)}

					<Card
						className="xl:row-start-2 xl:col-start-2"
						style={{ background: "#FFFFFF", padding: 18 }}
					>
						<SectionLabel>Registo de sessões</SectionLabel>
						{visibleSessionLogs.length === 0 ? (
							<p
								style={{ fontSize: 13, color: C.textSub, fontFamily: SF_TEXT }}
							>
								Sem sessões registadas.
							</p>
						) : (
							<div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
								{pagedSessionLogs.map((log) => {
									const logStyle =
										SESSION_STATUS_STYLES[log.status] ??
										SESSION_STATUS_STYLES.Abandonada;
									const logDate = log.timestamp.split("T")[0];
									const isLogActive = logDate === selectedDate;
									return (
										<button
											key={sessionLogIdentity(log)}
											type="button"
											onClick={() =>
												setSelectedDate(isLogActive ? null : logDate)
											}
											className="text-left transition-all hover:opacity-90 active:scale-[0.99]"
											style={{
												display: "flex",
												flexDirection: "column",
												gap: 4,
												background: isLogActive
													? "rgba(45,191,160,0.06)"
													: "rgba(255,255,255,0.72)",
												borderRadius: 12,
												padding: "12px 16px",
												marginBottom: 8,
												border: isLogActive
													? `1px solid rgba(45,191,160,0.28)`
													: "1px solid transparent",
												cursor: "pointer",
												width: "100%",
											}}
										>
											<div
												style={{
													display: "flex",
													alignItems: "center",
													gap: 10,
												}}
											>
												<span
													style={{
														fontSize: 12,
														fontWeight: 500,
														color: logStyle.text,
														background: logStyle.bg,
														borderRadius: 100,
														padding: "4px 12px",
														fontFamily: SF_TEXT,
													}}
												>
													{log.status}
												</span>
												<span
													style={{
														fontSize: 13,
														color: C.textSub,
														marginLeft: "auto",
														fontFamily: SF_TEXT,
													}}
												>
													{new Date(log.timestamp).toLocaleString("pt-PT")}
												</span>
											</div>
											{log.note && (
												<div
													style={{
														background: "rgba(45,191,160,0.07)",
														border: "1px solid rgba(45,191,160,0.18)",
														borderRadius: 8,
														padding: "6px 10px",
														marginTop: 4,
													}}
												>
													<span
														style={{
															fontSize: 10,
															fontWeight: 700,
															color: C.teal,
															letterSpacing: "0.4px",
															textTransform: "uppercase",
															marginRight: 6,
															fontFamily: SF_TEXT,
														}}
													>
														Nota
													</span>
													<span
														style={{
															fontSize: 12,
															color: C.text,
															fontFamily: SF_TEXT,
															lineHeight: 1.4,
														}}
													>
														{log.note}
													</span>
												</div>
											)}
										</button>
									);
								})}
								{totalSessionPages > 1 && (
									<div
										style={{
											display: "flex",
											alignItems: "center",
											justifyContent: "space-between",
											paddingTop: 8,
										}}
									>
										<button
											type="button"
											disabled={sessionLogPage === 0}
											onClick={() =>
												setSessionLogPage((p) => Math.max(0, p - 1))
											}
											style={{
												fontSize: 12,
												color: sessionLogPage === 0 ? C.textMuted : C.tealDark,
												background: "none",
												border: "none",
												cursor: sessionLogPage === 0 ? "default" : "pointer",
												fontFamily: SF_TEXT,
											}}
										>
											← Anterior
										</button>
										<span
											style={{
												fontSize: 11,
												color: C.textSub,
												fontFamily: SF_TEXT,
											}}
										>
											{sessionLogPage + 1} / {totalSessionPages}
										</span>
										<button
											type="button"
											disabled={sessionLogPage === totalSessionPages - 1}
											onClick={() =>
												setSessionLogPage((p) =>
													Math.min(totalSessionPages - 1, p + 1),
												)
											}
											style={{
												fontSize: 12,
												color:
													sessionLogPage === totalSessionPages - 1
														? C.textMuted
														: C.tealDark,
												background: "none",
												border: "none",
												cursor:
													sessionLogPage === totalSessionPages - 1
														? "default"
														: "pointer",
												fontFamily: SF_TEXT,
											}}
										>
											Próximo →
										</button>
									</div>
								)}
							</div>
						)}
					</Card>
				</div>

				<div
					className="flex"
					style={{
						marginTop: 48,
						marginBottom: 8,
						justifyContent: "center",
						pointerEvents: "none",
					}}
				>
					<PoweredByKindtech />
				</div>
			</div>

			{selectedTopic &&
				(() => {
					const detail = visibleTopicDetailMap.get(selectedTopic);
					if (!detail) return null;
					return (
						<TopicDetailModal
							label={selectedTopic}
							detail={detail}
							onClose={() => setSelectedTopic(null)}
							onDateSelect={(date) => {
								setSelectedDate(date);
								setSelectedTopic(null);
							}}
						/>
					);
				})()}
		</div>
	);
}
