import { createLazyFileRoute, useNavigate } from "@tanstack/react-router";
import { useSessionStore } from "@/frontend/stores/session";
import { useEffect, useRef, useState } from "react";
import { usePageBackgroundStore } from "@/frontend/stores/pageBackground";
import { DS } from "@/frontend/designSystem";
import {
	HiPhone,
	HiXMark,
	HiCalendarDays,
	HiChevronLeft,
	HiChevronRight,
	HiMiniUserCircle,
	HiCheck,
	HiChevronDown,
	HiMagnifyingGlass,
} from "react-icons/hi2";
import * as Select from "@radix-ui/react-select";
import { Settings } from "@/frontend/components/settings/settings";
import { PoweredByKindtech } from "@/frontend/components/ui/PoweredByKindtech";
import { dictionary } from "@/frontend/assets/i18n";
import { api_client } from "@/frontend/utils/api";
import type {
	CaregiverDailyOverviewResponse,
	CaregiverDashboardResponse,
} from "@/shared/contracts";

export const Route = createLazyFileRoute(
	"/$lang/_app/_app/_caretaker/caretaker/",
)({
	component: RouteComponent,
});

const BG =
	"radial-gradient(circle at 12% 24%, rgba(255,252,226,0.96) 0%, rgba(255,252,226,0.74) 24%, rgba(255,252,226,0.18) 42%, rgba(255,252,226,0) 58%), radial-gradient(circle at 92% 80%, rgba(185,235,220,0.86) 0%, rgba(185,235,220,0.52) 18%, rgba(185,235,220,0.14) 36%, rgba(185,235,220,0) 54%), linear-gradient(135deg, #fffce2 0%, #ffffff 52%, #b9ebdc 100%)";
const CARD_SHADOW = "0 14px 34px rgba(31,80,73,0.1)";
const CARD_ARROW = "/seta_diagonal_v3.svg";

const C = {
	teal: "#2DBFA0",
	tealDark: "#111111",
	text: "#111111",
	textSub: "#4d4d4d",
	textMuted: "#767676",
	card: "#ffffff",
	cardBorder: "rgba(17,75,69,0.18)",
	track: "rgba(255,255,255,0.9)",
};

const SESSION_COLOR = {
	successful: "#2DBFA0",
	cancelled: "#F5A623",
	failed: "#E88080",
	abandoned: "#9a9a9a",
};

const TONE_COLOR: Record<string, string> = {
	positive: "#2DBFA0",
	neutral: "#A8E6DA",
	negative: "#E88080",
};

const TONE_LABEL: Record<string, string> = {
	positive: "Positivo",
	neutral: "Neutro",
	negative: "Melancólico",
};

// ── Types ──────────────────────────────────────────────────────────────────
type Senior = CaregiverDashboardResponse["seniors"][number];
type DailyEntry = CaregiverDailyOverviewResponse["entries"][number];
type SortKey = "recent" | "name" | "sentiment";
type CategoryFilter =
	| {
			type: "session";
			key: "successful" | "cancelled" | "failed" | "abandoned";
			label: string;
	  }
	| {
			type: "emotion";
			key: "positive" | "neutral" | "negative";
			label: string;
	  };

type TrendDirection = "up" | "down" | "flat";
type TrendIndicator = {
	direction: TrendDirection;
	color: string;
	title: string;
	deltaLabel: string;
};

// ── Helpers ────────────────────────────────────────────────────────────────
function formatDate(dateStr: string): string {
	const [year, month, day] = dateStr.split("-").map(Number);
	return new Date(year, month - 1, day).toLocaleDateString("pt-PT", {
		weekday: "long",
		day: "numeric",
		month: "long",
	});
}

function formatDateChip(dateStr: string): string {
	const [year, month, day] = dateStr.split("-").map(Number);
	const date = new Date(year, month - 1, day);
	const today = new Date();
	today.setHours(0, 0, 0, 0);
	const yesterday = new Date(today);
	yesterday.setDate(today.getDate() - 1);
	if (date.getTime() === today.getTime()) return "Hoje";
	if (date.getTime() === yesterday.getTime()) return "Ontem";
	return date.toLocaleDateString("pt-PT", { day: "numeric", month: "short" });
}

function timeAgo(dateStr: string | null): string {
	if (!dateStr) return "—";
	const diffMs = Date.now() - new Date(dateStr).getTime();
	const hours = Math.floor(diffMs / (1000 * 60 * 60));
	if (hours < 1) return "há menos de 1 hora";
	if (hours < 24) return `há ${hours} hora${hours === 1 ? "" : "s"}`;
	const days = Math.floor(hours / 24);
	return `há ${days} dia${days === 1 ? "" : "s"}`;
}

function shiftDate(dateStr: string, deltaDays: number): string {
	const [year, month, day] = dateStr.split("-").map(Number);
	const date = new Date(Date.UTC(year, month - 1, day));
	date.setUTCDate(date.getUTCDate() + deltaDays);
	return date.toISOString().slice(0, 10);
}

function averagePreviousSevenDays(
	entries: DailyEntry[],
	dateStr: string,
	getValue: (entry: DailyEntry) => number,
) {
	const entriesByDate = new Map(entries.map((entry) => [entry.date, entry]));
	let total = 0;

	for (let offset = 1; offset <= 7; offset += 1) {
		const entry = entriesByDate.get(shiftDate(dateStr, -offset));
		total += entry ? getValue(entry) : 0;
	}

	return total / 7;
}

function resolveTrendDirection(
	currentValue: number,
	baseline: number,
): TrendDirection {
	const delta = currentValue - baseline;
	if (Math.abs(delta) < 0.35) return "flat";
	return delta > 0 ? "up" : "down";
}

function calculateTrendDelta(currentValue: number, baseline: number) {
	return Math.round(currentValue - baseline);
}

function buildTrendIndicator(
	entries: DailyEntry[],
	dateStr: string,
	currentValue: number,
	getValue: (entry: DailyEntry) => number,
): TrendIndicator {
	const baseline = averagePreviousSevenDays(entries, dateStr, getValue);
	const direction = resolveTrendDirection(currentValue, baseline);
	const delta = calculateTrendDelta(currentValue, baseline);
	const color =
		direction === "up"
			? "#2DBFA0"
			: direction === "down"
				? "#D96B6B"
				: "#93A09E";
	const title =
		direction === "flat"
			? "Em linha com a média dos últimos 7 dias"
			: direction === "up"
				? "Acima da média dos últimos 7 dias"
				: "Abaixo da média dos últimos 7 dias";

	return {
		direction,
		color,
		title,
		deltaLabel: `${delta > 0 ? "+" : ""}${delta}`,
	};
}

function TrendGlyph({
	direction,
	color,
}: { direction: TrendDirection; color: string }) {
	// Sparkline chart: up = rising curve, down = falling curve, flat = horizontal line
	const linePath =
		direction === "up"
			? "M1,16 C4,16 5,12 8,9 S13,3 17,1"
			: direction === "down"
				? "M1,2 C4,2 5,6 8,9 S13,15 17,17"
				: "M1,9 Q6,7 9,9 Q12,11 17,9";

	const fillPath =
		direction === "up"
			? "M1,16 C4,16 5,12 8,9 S13,3 17,1 L17,18 L1,18 Z"
			: direction === "down"
				? "M1,2 C4,2 5,6 8,9 S13,15 17,17 L17,18 L1,18 Z"
				: "M1,9 Q6,7 9,9 Q12,11 17,9 L17,18 L1,18 Z";

	return (
		<svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
			<path d={fillPath} fill={color} opacity="0.15" />
			<path
				d={linePath}
				fill="none"
				stroke={color}
				strokeWidth="1.8"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	);
}

// ── MiniCalendar ───────────────────────────────────────────────────────────
const WEEK_DAYS = ["D", "S", "T", "Q", "Q", "S", "S"];

function MiniCalendar({
	availableDates,
	selectedDate,
	onSelect,
}: {
	availableDates: string[];
	selectedDate: string | null;
	onSelect: (date: string) => void;
}) {
	const available = new Set(availableDates);
	const ref = selectedDate ?? availableDates[0];
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
				background: "rgba(255,255,255,0.98)",
				borderRadius: 24,
				padding: "16px 18px",
				boxShadow: "0 16px 38px rgba(31,80,73,0.12)",
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
					aria-label="Mês anterior"
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
					}}
				>
					{monthLabel}
				</p>
				<button
					type="button"
					onClick={() => shiftMonth(1)}
					aria-label="Mês seguinte"
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
								fontWeight: isSelected ? 600 : 400,
								cursor: isAvailable ? "pointer" : "default",
								backgroundColor: isSelected
									? "#2DBFA0"
									: isAvailable
										? "#F3F3F3"
										: "transparent",
								color: isSelected
									? "#fff"
									: isAvailable
										? "#111111"
										: C.textMuted,
								transition: "all 0.15s ease",
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

// ── Category Modal ──────────────────────────────────────────────────────────
function CategoryModal({
	category,
	entry,
	onClose,
	onSeniorClick,
}: {
	category: CategoryFilter;
	entry: DailyEntry;
	onClose: () => void;
	onSeniorClick: (seniorId: string) => void;
}) {
	const filtered = entry.seniorBreakdown.filter((s) => {
		if (category.type === "session") return s.sessions[category.key] > 0;
		return s.dominantEmotion === category.key;
	});
	const accentColor =
		category.type === "session"
			? SESSION_COLOR[category.key]
			: TONE_COLOR[category.key];

	return (
		<div
			className="flex items-center justify-center"
			style={{
				position: "fixed",
				inset: 0,
				zIndex: 600,
				backdropFilter: "blur(6px)",
				backgroundColor: "rgba(0,0,0,0.25)",
			}}
			onClick={(e) => {
				if (e.target === e.currentTarget) onClose();
			}}
		>
			<div
				className="rounded-2xl shadow-2xl mx-4 w-full sm:max-w-sm overflow-hidden"
				style={{
					maxHeight: "80vh",
					display: "flex",
					flexDirection: "column",
					background: "#ffffff",
					borderRadius: 20,
					border: `1px solid ${C.cardBorder}`,
					boxShadow: "0 22px 50px rgba(31,80,73,0.14)",
				}}
			>
				<div className="flex items-start justify-between px-5 pt-5 pb-3">
					<div>
						<h2
							className="text-base font-bold"
							style={{ color: "rgb(10, 74, 69)" }}
						>
							{category.label}
						</h2>
						<p className="text-xs mt-0.5" style={{ color: C.textSub }}>
							{filtered.length} sénior{filtered.length !== 1 ? "es" : ""}
						</p>
					</div>
					<button
						type="button"
						onClick={onClose}
						className="flex items-center justify-center transition-opacity hover:opacity-70"
						style={{
							width: 18,
							height: 18,
							color: C.text,
							background: "transparent",
							border: "none",
							padding: 0,
						}}
					>
						<HiXMark size={14} />
					</button>
				</div>
				<div
					style={{ height: 1, backgroundColor: C.cardBorder, margin: "0 20px" }}
				/>
				<div className="overflow-y-auto flex-1 px-4 py-3 flex flex-col gap-2">
					{category.type === "emotion" && category.key === "negative" && (
						<p
							className="text-xs leading-relaxed px-1 pb-1"
							style={{ color: C.textSub }}
						>
							Estes são os idosos que apresentaram tom emocional melancólico.
						</p>
					)}
					{filtered.length === 0 ? (
						<p
							className="text-sm text-center py-6"
							style={{ color: C.textSub }}
						>
							Nenhum sénior nesta categoria.
						</p>
					) : (
						filtered.map((s) => {
							const name = s.fullName || s.nickname;
							const initial = name.charAt(0).toUpperCase();
							const matchingLogs =
								category.type === "session"
									? s.sessionLogs.filter((l) => {
											const outcomeMap: Record<string, string> = {
												successful: "Sucesso",
												cancelled: "Cancelada",
												failed: "Falha",
												abandoned: "Abandonada",
											};
											return l.outcome === outcomeMap[category.key];
										})
									: [];
							const count =
								category.type === "session" ? matchingLogs.length : undefined;
							return (
								<div
									key={s.seniorId}
									role="button"
									tabIndex={0}
									onClick={() => {
										onSeniorClick(s.seniorId);
										onClose();
									}}
									onKeyDown={(e) => {
										if (e.key === "Enter" || e.key === " ") {
											onSeniorClick(s.seniorId);
											onClose();
										}
									}}
									className="flex flex-col gap-2 rounded-xl px-3 py-3 cursor-pointer transition-all hover:opacity-80 active:scale-[0.98]"
									style={{ ...DS.glassCard, borderRadius: 12 }}
								>
									<div className="flex items-center gap-3">
										<div
											className="flex items-center justify-center rounded-lg shrink-0 text-sm font-bold"
											style={{
												width: 36,
												height: 36,
												backgroundColor: accentColor,
												color: "#fff",
											}}
										>
											{initial}
										</div>
										<div className="flex-1 min-w-0">
											<p
												className="font-semibold text-sm leading-tight"
												style={{ color: C.tealDark }}
											>
												{name}
											</p>
											{s.nickname && s.nickname !== s.fullName && (
												<p
													className="text-xs mt-0.5"
													style={{ color: C.textSub }}
												>
													{s.nickname}
												</p>
											)}
										</div>
										{count !== undefined && (
											<span
												className="shrink-0 text-sm font-bold px-2 py-0.5 rounded-full"
												style={{
													backgroundColor: `${accentColor}20`,
													color: accentColor,
												}}
											>
												{count}
											</span>
										)}
									</div>
									{matchingLogs.length > 0 &&
										matchingLogs.some((l) => l.note) && (
											<div className="flex flex-col gap-1 pl-12">
												{matchingLogs
													.filter((l) => l.note)
													.map((l) => (
														<div
															key={l.createdAt}
															className="flex items-start justify-between gap-2 rounded-lg px-2 py-1"
															style={{ backgroundColor: `${accentColor}12` }}
														>
															<p
																className="text-base"
																style={{ color: C.text }}
															>
																{l.note}
															</p>
															<span
																className="text-xs shrink-0 mt-0.5"
																style={{ color: C.textMuted }}
															>
																{new Date(l.createdAt).toLocaleTimeString(
																	"pt-PT",
																	{ hour: "2-digit", minute: "2-digit" },
																)}
															</span>
														</div>
													))}
											</div>
										)}
								</div>
							);
						})
					)}
				</div>
			</div>
		</div>
	);
}

function TodaySessionsModal({
	seniors,
	onClose,
	onSeniorClick,
}: {
	seniors: DailyEntry["seniorBreakdown"];
	onClose: () => void;
	onSeniorClick: (seniorId: string) => void;
}) {
	return (
		<div
			className="flex items-center justify-center"
			style={{
				position: "fixed",
				inset: 0,
				zIndex: 600,
				backdropFilter: "blur(6px)",
				backgroundColor: "rgba(0,0,0,0.25)",
			}}
			onClick={(e) => {
				if (e.target === e.currentTarget) onClose();
			}}
		>
			<div
				className="rounded-2xl shadow-2xl mx-4 w-full sm:max-w-sm overflow-hidden"
				style={{
					maxHeight: "80vh",
					display: "flex",
					flexDirection: "column",
					background: "#ffffff",
					borderRadius: 20,
					border: `1px solid ${C.cardBorder}`,
					boxShadow: "0 22px 50px rgba(31,80,73,0.14)",
				}}
			>
				<div className="flex items-start justify-between px-5 pt-5 pb-3">
					<div>
						<h2
							className="text-base font-bold"
							style={{ color: "rgb(10, 74, 69)" }}
						>
							Idosos com sessão hoje
						</h2>
						<p className="text-xs mt-0.5" style={{ color: C.textSub }}>
							{seniors.length} idoso{seniors.length !== 1 ? "s" : ""}
						</p>
					</div>
					<button
						type="button"
						onClick={onClose}
						className="flex items-center justify-center transition-opacity hover:opacity-70"
						style={{
							width: 18,
							height: 18,
							color: C.text,
							background: "transparent",
							border: "none",
							padding: 0,
						}}
					>
						<HiXMark size={14} />
					</button>
				</div>
				<div
					style={{ height: 1, backgroundColor: C.cardBorder, margin: "0 20px" }}
				/>
				<div className="overflow-y-auto flex-1 px-4 py-3 flex flex-col gap-2">
					{seniors.map((senior) => {
						const name = senior.fullName || senior.nickname;
						const initial = name.charAt(0).toUpperCase();
						const totalSessions =
							senior.sessions.successful +
							senior.sessions.cancelled +
							senior.sessions.failed +
							senior.sessions.abandoned;
						return (
							<div
								key={senior.seniorId}
								role="button"
								tabIndex={0}
								onClick={() => {
									onSeniorClick(senior.seniorId);
									onClose();
								}}
								onKeyDown={(e) => {
									if (e.key === "Enter" || e.key === " ") {
										onSeniorClick(senior.seniorId);
										onClose();
									}
								}}
								className="flex items-center gap-3 rounded-xl px-3 py-3 cursor-pointer transition-all hover:opacity-80 active:scale-[0.98]"
								style={{
									...DS.glassCard,
									borderRadius: 12,
									background:
										"linear-gradient(135deg, rgba(11, 96, 90, 0.1) 0%, rgb(127 188 183 / 30%) 100%)",
								}}
							>
								<div
									className="flex items-center justify-center rounded-lg shrink-0 text-sm font-bold"
									style={{
										width: 36,
										height: 36,
										backgroundColor: "rgb(10, 74, 69, 0.7)",
										color: "#fff",
									}}
								>
									{initial}
								</div>
								<div className="flex-1 min-w-0">
									<p
										className="font-semibold text-sm leading-tight"
										style={{ color: "#111111" }}
									>
										{name}
									</p>
									{senior.nickname && senior.nickname !== senior.fullName && (
										<p className="text-xs mt-0.5" style={{ color: C.textSub }}>
											{senior.nickname}
										</p>
									)}
								</div>
								<span
									className="shrink-0 text-sm font-bold px-2 py-0.5 rounded-full"
									style={{
										backgroundColor: "rgba(0,0,0,0.06)",
										color: "#111111",
									}}
								>
									{totalSessions}
								</span>
							</div>
						);
					})}
				</div>
			</div>
		</div>
	);
}

function OutcomeSummaryModal({
	entry,
	onClose,
	onSeniorClick,
}: {
	entry: DailyEntry;
	onClose: () => void;
	onSeniorClick: (seniorId: string) => void;
}) {
	const sections: Array<{
		label: string;
		key: "cancelled" | "failed" | "abandoned";
		color: string;
		colorBg: string;
		colorBorder: string;
	}> = [
		{
			label: "Canceladas",
			key: "cancelled",
			color: "#D4900A",
			colorBg: "rgba(230,160,32,0.07)",
			colorBorder: "rgba(230,160,32,0.32)",
		},
		{
			label: "Com falha",
			key: "failed",
			color: "#C94040",
			colorBg: "rgba(210,70,70,0.07)",
			colorBorder: "rgba(210,70,70,0.32)",
		},
		{
			label: "Abandonadas",
			key: "abandoned",
			color: "#5A7A96",
			colorBg: "rgba(90,122,150,0.07)",
			colorBorder: "rgba(90,122,150,0.32)",
		},
	];

	return (
		<div
			className="flex items-center justify-center"
			style={{
				position: "fixed",
				inset: 0,
				zIndex: 600,
				backdropFilter: "blur(6px)",
				backgroundColor: "rgba(0,0,0,0.25)",
			}}
			onClick={(e) => {
				if (e.target === e.currentTarget) onClose();
			}}
		>
			<div
				className="rounded-2xl shadow-2xl mx-4 w-full sm:max-w-md overflow-hidden"
				style={{
					maxHeight: "80vh",
					display: "flex",
					flexDirection: "column",
					background: "#ffffff",
					borderRadius: 20,
					border: `1px solid ${C.cardBorder}`,
					boxShadow: "0 22px 50px rgba(31,80,73,0.14)",
				}}
			>
				<div className="flex items-start justify-between px-5 pt-5 pb-3">
					<div>
						<h2
							className="text-base font-bold"
							style={{ color: "rgb(10, 74, 69)" }}
						>
							Sessões não concluídas
						</h2>
						<p className="text-xs mt-0.5" style={{ color: C.textSub }}>
							Canceladas, com falha e abandonadas
						</p>
					</div>
					<button
						type="button"
						onClick={onClose}
						className="flex items-center justify-center transition-opacity hover:opacity-70"
						style={{
							width: 18,
							height: 18,
							color: C.text,
							background: "transparent",
							border: "none",
							padding: 0,
						}}
					>
						<HiXMark size={14} />
					</button>
				</div>
				<div
					style={{ height: 1, backgroundColor: C.cardBorder, margin: "0 20px" }}
				/>
				<div className="overflow-y-auto flex-1 px-4 py-3 flex flex-col gap-4">
					{sections.map((section) => {
						const matches = entry.seniorBreakdown.filter(
							(senior) => senior.sessions[section.key] > 0,
						);
						return (
							<div key={section.key} className="flex flex-col gap-2">
								<div className="flex items-center justify-between">
									<div className="flex items-center gap-2">
										<span
											style={{
												width: 8,
												height: 8,
												borderRadius: "50%",
												background: section.color,
												flexShrink: 0,
												display: "inline-block",
											}}
										/>
										<h3
											className="text-sm font-semibold"
											style={{ color: "rgb(10, 74, 69)" }}
										>
											{section.label}
										</h3>
									</div>
									<span
										className="text-xs font-semibold px-2 py-1 rounded-full"
										style={{
											background: section.colorBg,
											color: section.color,
											border: `1px solid ${section.colorBorder}`,
										}}
									>
										{matches.length}
									</span>
								</div>
								{matches.length === 0 ? (
									<p className="text-xs" style={{ color: C.textSub }}>
										Sem idosos nesta categoria.
									</p>
								) : (
									matches.map((senior) => {
										const name = senior.fullName || senior.nickname;
										return (
											<button
												key={`${section.key}-${senior.seniorId}`}
												type="button"
												onClick={() => {
													onSeniorClick(senior.seniorId);
													onClose();
												}}
												className="flex items-center justify-between gap-3 rounded-xl px-3 py-3 text-left transition-all hover:opacity-80 active:scale-[0.98]"
												style={{
													borderRadius: 12,
													background: section.colorBg,
													border: `1px solid ${section.colorBorder}`,
												}}
											>
												<div className="min-w-0">
													<p
														className="text-sm font-semibold truncate"
														style={{ color: "#111111" }}
													>
														{name}
													</p>
													<p className="text-xs" style={{ color: C.textSub }}>
														{senior.sessions[section.key]} registo
														{senior.sessions[section.key] !== 1 ? "s" : ""}
													</p>
												</div>
												<img
													src={CARD_ARROW}
													alt=""
													aria-hidden="true"
													style={{
														width: 16,
														height: 16,
														objectFit: "contain",
														flexShrink: 0,
													}}
												/>
											</button>
										);
									})
								)}
							</div>
						);
					})}
				</div>
			</div>
		</div>
	);
}

// ── DashSelect ─────────────────────────────────────────────────────────────
function DashSelect<T extends string>({
	value,
	onChange,
	options,
}: {
	value: T;
	onChange: (v: T) => void;
	options: Array<{ value: T; label: string }>;
}) {
	return (
		<Select.Root value={value} onValueChange={onChange}>
			<Select.Trigger
				className="appearance-none focus:outline-none"
				style={{
					borderRadius: 999,
					width: 120,
					backgroundColor: "rgba(255,255,255,0.9)",
					border: `1px solid rgba(33,91,88,0.18)`,
					color: C.text,
					fontSize: 12,
					fontWeight: 500,
					cursor: "pointer",
					padding: "7px 10px 7px 14px",
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
					gap: 6,
					userSelect: "none",
				}}
			>
				<span
					style={{
						overflow: "hidden",
						textOverflow: "ellipsis",
						whiteSpace: "nowrap",
						flex: 1,
						textAlign: "left",
					}}
				>
					<Select.Value />
				</span>
				<Select.Icon asChild>
					<HiChevronDown
						size={11}
						style={{ color: "#0c5c5c", flexShrink: 0 }}
					/>
				</Select.Icon>
			</Select.Trigger>

			<Select.Portal>
				<Select.Content
					position="popper"
					sideOffset={6}
					style={{
						backgroundColor: "#ffffff",
						borderRadius: 16,
						padding: 6,
						boxShadow: "0 16px 38px rgba(31,80,73,0.16)",
						border: `1px solid rgba(33,91,88,0.14)`,
						zIndex: 400,
						minWidth: "var(--radix-select-trigger-width)",
						overflow: "hidden",
					}}
				>
					<Select.Viewport>
						{options.map((opt) => (
							<Select.Item
								key={opt.value}
								value={opt.value}
								className="data-[highlighted]:bg-[rgba(45,191,160,0.09)] data-[state=checked]:font-semibold focus:outline-none"
								style={{
									display: "flex",
									alignItems: "center",
									justifyContent: "space-between",
									gap: 8,
									padding: "8px 10px 8px 12px",
									borderRadius: 10,
									fontSize: 12,
									color: C.text,
									cursor: "pointer",
									userSelect: "none",
									listStyle: "none",
								}}
							>
								<Select.ItemText>{opt.label}</Select.ItemText>
								<Select.ItemIndicator>
									<HiCheck size={12} color="#2DBFA0" />
								</Select.ItemIndicator>
							</Select.Item>
						))}
					</Select.Viewport>
				</Select.Content>
			</Select.Portal>
		</Select.Root>
	);
}

// ── Route component ────────────────────────────────────────────────────────
function RouteComponent() {
	const { lang } = Route.useParams();
	const t = dictionary(lang);
	const navigate = useNavigate();
	const setPageBackground = usePageBackgroundStore((s) => s.setBackground);
	const setHideFooter = usePageBackgroundStore((s) => s.setHideFooter);
	const globalBackground = usePageBackgroundStore((s) => s.globalBackground);
	const { session } = useSessionStore();
	const caregiverName = session?.user.name ?? "";
	const effectiveBackground = globalBackground ?? BG;

	useEffect(() => {
		setPageBackground(effectiveBackground);
		setHideFooter(true);
		return () => {
			setPageBackground(null);
			setHideFooter(false);
		};
	}, [effectiveBackground, setPageBackground, setHideFooter]);

	const [dashboard, setDashboard] = useState<CaregiverDashboardResponse | null>(
		null,
	);
	const [dailyOverview, setDailyOverview] =
		useState<CaregiverDailyOverviewResponse | null>(null);
	const [selectedDate, setSelectedDate] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);
	const [sortKey, setSortKey] = useState<SortKey>("recent");
	const [filterInstitution, setFilterInstitution] = useState<string>("all");
	const [callingSenior, setCallingSenior] = useState<Senior | null>(null);
	const [activeCategory, setActiveCategory] = useState<CategoryFilter | null>(
		null,
	);
	const [showTodaySessions, setShowTodaySessions] = useState(false);
	const [showOutcomeSummary, setShowOutcomeSummary] = useState(false);
	const [showCalendar, setShowCalendar] = useState(false);
	const [searchQuery, setSearchQuery] = useState("");
	const calendarRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const load = async () => {
			setLoading(true);
			const [dashRes, overviewRes] = await Promise.all([
				api_client.caregiver.dashboard.$get(),
				api_client.caregiver["daily-overview"].$get(),
			]);
			if (dashRes.ok)
				setDashboard((await dashRes.json()) as CaregiverDashboardResponse);
			if (overviewRes.ok) {
				const data =
					(await overviewRes.json()) as CaregiverDailyOverviewResponse;
				setDailyOverview(data);
				if (data.entries.length > 0) setSelectedDate(data.entries[0].date);
			}
			setLoading(false);
		};
		void load();
	}, []);

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
		setActiveCategory(null);
	}, [selectedDate]);

	const institutions = dashboard
		? ([
				...new Set(
					dashboard.seniors.map((s) => s.institutionName).filter(Boolean),
				),
			] as string[])
		: [];

	const selectedEntry =
		dailyOverview?.entries.find((e) => e.date === selectedDate) ?? null;
	const dailyEntries = dailyOverview?.entries ?? [];
	const seniorsWithSession = selectedEntry
		? selectedEntry.seniorBreakdown.filter(
				(senior) =>
					senior.sessions.successful +
						senior.sessions.cancelled +
						senior.sessions.failed +
						senior.sessions.abandoned >
					0,
			)
		: [];

	// Sentiment from most recent daily entry per senior
	const sentimentMap: Record<string, string> = {};
	if (selectedEntry) {
		for (const s of selectedEntry.seniorBreakdown) {
			if (s.dominantEmotion) sentimentMap[s.seniorId] = s.dominantEmotion;
		}
	}

	const SENTIMENT_ORDER: Record<string, number> = {
		negative: 0,
		neutral: 1,
		positive: 2,
	};

	const sorted: Senior[] = dashboard
		? [...dashboard.seniors]
				.filter(
					(s) =>
						filterInstitution === "all" ||
						s.institutionName === filterInstitution,
				)
				.filter(
					(s) =>
						!searchQuery ||
						s.fullName.toLowerCase().includes(searchQuery.toLowerCase()),
				)
				.sort((a, b) => {
					if (sortKey === "name") return a.fullName.localeCompare(b.fullName);
					if (sortKey === "sentiment") {
						const sa = sentimentMap[a.seniorId];
						const sb = sentimentMap[b.seniorId];
						const oa = sa !== undefined ? (SENTIMENT_ORDER[sa] ?? 3) : 3;
						const ob = sb !== undefined ? (SENTIMENT_ORDER[sb] ?? 3) : 3;
						return oa !== ob ? oa - ob : a.fullName.localeCompare(b.fullName);
					}
					const ta = a.lastConversationAt
						? new Date(a.lastConversationAt).getTime()
						: 0;
					const tb = b.lastConversationAt
						? new Date(b.lastConversationAt).getTime()
						: 0;
					return tb - ta;
				})
		: [];

	const todayStr = new Date().toISOString().split("T")[0];
	const isToday = selectedDate === todayStr;
	const dateLabel = selectedDate ? formatDate(selectedDate) : "";
	const successfulTrend =
		selectedEntry && selectedDate
			? buildTrendIndicator(
					dailyEntries,
					selectedDate,
					selectedEntry.sessions.successful,
					(entry) => entry.sessions.successful,
				)
			: null;
	const melancholicTrend =
		selectedEntry && selectedDate
			? buildTrendIndicator(
					dailyEntries,
					selectedDate,
					selectedEntry.emotions.negative,
					(entry) => entry.emotions.negative,
				)
			: null;

	return (
		<div
			style={{
				height: "100%",
				minHeight: "100%",
				maxHeight: "100%",
				width: "100%",
				background: effectiveBackground,
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				overflow: "hidden",
				position: "relative",
			}}
		>
			{/* Ambient gradients */}
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
							"radial-gradient(circle at 12% 22%, rgba(255,252,226,0.24), transparent 32%)",
					}}
				/>
				<div
					style={{
						position: "absolute",
						inset: 0,
						background:
							"radial-gradient(circle at 90% 82%, rgba(185,235,220,0.2), transparent 32%)",
					}}
				/>
			</div>

			{/* ── Scrollable content (full page, header inside) ── */}
			<div
				style={{
					position: "relative",
					zIndex: 1,
					width: "100%",
					flex: 1,
					boxSizing: "border-box",
				}}
				className="px-5 sm:px-8 xl:px-12 pb-10 overflow-y-auto"
			>
				{/* Top bar — logo left, settings right — scrolls with content */}
				<div
					className="flex items-center justify-between"
					style={{ paddingTop: 20, paddingBottom: 0 }}
				>
					<img
						src="/compyTextLogo.png"
						alt="Compy"
						style={{ height: 28, filter: "brightness(0.12) saturate(1.05)" }}
						className="object-contain"
					/>
					<Settings locale={lang} btnClassName="text-black" />
				</div>

				{/* Two-column layout — full width */}
				<div
					className="flex flex-col xl:flex-row"
					style={{
						gap: 32,
						alignItems: "flex-start",
						marginTop: 0,
						minHeight: "calc(100vh - 150px)",
					}}
				>
					{/* ── LEFT — Visão geral (55%) ── */}
					<div style={{ flex: "0 0 56%", minWidth: 0, width: "100%" }}>
						{/* Greeting — left aligned, scrolls with content */}
						<div style={{ paddingTop: 64, paddingBottom: 30 }}>
							<div style={{ width: "fit-content" }}>
								<h1
									style={{
										fontSize: "clamp(2.15rem, 4.15vw, 3.45rem)",
										fontWeight: 300,
										lineHeight: 1.05,
										color: "#111111",
										fontFamily:
											'-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", sans-serif',
										letterSpacing: "-1.1px",
										marginBottom: 2,
									}}
								>
									<span style={{ fontWeight: 300 }}>Olá, </span>
									<span style={{ fontWeight: 430 }}>{caregiverName}</span>
								</h1>
								<p
									style={{
										fontSize: "clamp(1rem, 1.8vw, 1.2rem)",
										fontWeight: 400,
										color: "rgba(0,0,0,0.74)",
										fontFamily:
											'-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif',
										width: "100%",
										textAlign: "right",
									}}
								>
									que bom te ver de volta!
								</p>
							</div>
						</div>

						{/* Loading skeleton */}
						{loading && (
							<div className="flex flex-col gap-4">
								{[1, 2].map((i) => (
									<div
										key={i}
										className="skeleton-premium rounded-2xl"
										style={{ height: 110, opacity: 1 - (i - 1) * 0.3 }}
									/>
								))}
							</div>
						)}

						{/* Daily overview */}
						{!loading && dailyOverview && dailyOverview.entries.length > 0 && (
							<div>
								{/* Section title row */}
								<div
									className="flex items-start justify-between"
									style={{ marginBottom: 18 }}
								>
									<div>
										<div className="flex items-center gap-2">
											<span
												style={{
													fontSize: 18,
													fontWeight: 500,
													color: "#111111",
													textTransform: "capitalize",
													fontFamily:
														'-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif',
													lineHeight: 1.2,
												}}
											>
												{dateLabel}
											</span>
											<div ref={calendarRef} style={{ position: "relative" }}>
												<button
													type="button"
													onClick={() => setShowCalendar((v) => !v)}
													style={{
														width: 38,
														height: 38,
														borderRadius: 999,
														background: "rgba(255,255,255,0.88)",
														border: "1px solid rgba(0,0,0,0.12)",
														cursor: "pointer",
														color: "#111111",
														display: "flex",
														alignItems: "center",
														justifyContent: "center",
														boxShadow: "0 10px 20px rgba(0,0,0,0.08)",
													}}
												>
													<HiCalendarDays size={17} />
												</button>
												{showCalendar && (
													<div className="absolute top-[46px] left-1/2 z-[300] -translate-x-1/2 sm:left-0 sm:translate-x-0">
														<MiniCalendar
															availableDates={dailyOverview.entries.map(
																(e) => e.date,
															)}
															selectedDate={selectedDate}
															onSelect={(d) => {
																setSelectedDate(d);
																setShowCalendar(false);
															}}
														/>
													</div>
												)}
											</div>
										</div>
									</div>
								</div>

								{selectedEntry && (
									<>
										<button
											type="button"
											onClick={() => setShowTodaySessions(true)}
											className="w-full text-left transition-all hover:opacity-90 active:scale-[0.995]"
											style={{
												background: "#ffffff",
												borderRadius: 26,
												padding: "18px 22px",
												border: `1px solid ${C.cardBorder}`,
												marginBottom: 14,
												boxShadow: CARD_SHADOW,
											}}
										>
											<div className="flex items-start justify-between gap-3">
												<div style={{ minWidth: 0 }}>
													<p
														style={{
															fontSize: 11,
															fontWeight: 600,
															color: "rgba(0,0,0,0.52)",
															letterSpacing: "0.34px",
															textTransform: "uppercase",
															marginBottom: 7,
														}}
													>
														Idosos com sessão hoje
													</p>
													<p
														style={{
															fontSize: 24,
															fontWeight: 500,
															color: "#111111",
															lineHeight: 1.1,
															marginBottom: 4,
														}}
													>
														{seniorsWithSession.length}
													</p>
												</div>
												<img
													src={CARD_ARROW}
													alt=""
													aria-hidden="true"
													style={{
														width: 20,
														height: 20,
														objectFit: "contain",
														flexShrink: 0,
														marginTop: 2,
													}}
												/>
											</div>
										</button>

										{/* Hero metric cards */}
										<div
											className="grid grid-cols-2 gap-3 sm:gap-4"
											style={{ marginBottom: 14 }}
										>
											<div
												role="button"
												tabIndex={0}
												onClick={() =>
													setActiveCategory({
														type: "session",
														key: "successful",
														label: "Sessões bem-sucedidas",
													})
												}
												onKeyDown={(e) => {
													if (e.key === "Enter")
														setActiveCategory({
															type: "session",
															key: "successful",
															label: "Sessões bem-sucedidas",
														});
												}}
												className="cursor-pointer transition-all hover:opacity-90 active:scale-[0.99] px-4 py-5 sm:px-8 sm:py-[34px]"
												style={{
													background: "#ffffff",
													borderRadius: 30,
													border: `1px solid ${C.cardBorder}`,
													minHeight: 118,
													boxShadow: CARD_SHADOW,
													position: "relative",
												}}
											>
												<div className="flex items-start justify-between gap-3">
													<span
														className="text-[2.35rem] sm:text-[54px]"
														style={{
															fontWeight: 300,
															lineHeight: 1,
															color: "#2DBFA0",
															display: "block",
															fontFamily:
																'-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", sans-serif',
														}}
													>
														{selectedEntry.sessions.successful}
													</span>
													<img
														src={CARD_ARROW}
														alt=""
														aria-hidden="true"
														style={{
															width: 20,
															height: 20,
															objectFit: "contain",
															flexShrink: 0,
															marginTop: 2,
														}}
													/>
												</div>
												<span
													className="text-[10px] sm:text-[12px]"
													style={{
														fontWeight: 500,
														color: "rgba(0,0,0,0.64)",
														letterSpacing: "0.32px",
														marginTop: 10,
														display: "block",
														textTransform: "uppercase",
													}}
												>
													Bem-sucedidas
												</span>
												{successfulTrend && (
													<div
														aria-hidden="true"
														title={successfulTrend.title}
														style={{
															position: "absolute",
															right: 18,
															bottom: 14,
															display: "flex",
															alignItems: "center",
															gap: 4,
															color: successfulTrend.color,
														}}
													>
														<TrendGlyph
															direction={successfulTrend.direction}
															color={successfulTrend.color}
														/>
														<span
															style={{
																fontSize: 11,
																lineHeight: 1,
																fontWeight: 700,
																color: successfulTrend.color,
															}}
														>
															{successfulTrend.deltaLabel}
														</span>
													</div>
												)}
											</div>
											{(() => {
												const alerts = selectedEntry.emotions.negative;
												return (
													<div
														role="button"
														tabIndex={0}
														onClick={() =>
															setActiveCategory({
																type: "emotion",
																key: "negative",
																label: "Registos Melancólicos",
															})
														}
														onKeyDown={(e) => {
															if (e.key === "Enter")
																setActiveCategory({
																	type: "emotion",
																	key: "negative",
																	label: "Registos Melancólicos",
																});
														}}
														className="cursor-pointer transition-all hover:opacity-90 active:scale-[0.99] px-4 py-5 sm:px-8 sm:py-[34px]"
														style={{
															background: "#ffffff",
															borderRadius: 30,
															border: `1px solid ${C.cardBorder}`,
															minHeight: 118,
															boxShadow: CARD_SHADOW,
															position: "relative",
														}}
													>
														<div className="flex items-start justify-between gap-3">
															<span
																className="text-[2.35rem] sm:text-[54px]"
																style={{
																	fontWeight: 300,
																	lineHeight: 1,
																	color: "#E88080",
																	display: "block",
																	fontFamily:
																		'-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", sans-serif',
																}}
															>
																{alerts}
															</span>
															<img
																src={CARD_ARROW}
																alt=""
																aria-hidden="true"
																style={{
																	width: 20,
																	height: 20,
																	objectFit: "contain",
																	flexShrink: 0,
																	marginTop: 2,
																}}
															/>
														</div>
														<span
															className="text-[10px] sm:text-[12px]"
															style={{
																fontWeight: 500,
																color: "rgba(0,0,0,0.64)",
																letterSpacing: "0.32px",
																marginTop: 10,
																display: "block",
																textTransform: "uppercase",
															}}
														>
															Registos Melancólicos
														</span>
														{melancholicTrend && (
															<div
																aria-hidden="true"
																title={melancholicTrend.title}
																style={{
																	position: "absolute",
																	right: 18,
																	bottom: 14,
																	display: "flex",
																	alignItems: "center",
																	gap: 4,
																	color: melancholicTrend.color,
																}}
															>
																<TrendGlyph
																	direction={melancholicTrend.direction}
																	color={melancholicTrend.color}
																/>
																<span
																	style={{
																		fontSize: 11,
																		lineHeight: 1,
																		fontWeight: 700,
																		color: melancholicTrend.color,
																	}}
																>
																	{melancholicTrend.deltaLabel}
																</span>
															</div>
														)}
													</div>
												);
											})()}
										</div>

										{/* Secondary metrics strip */}
										<button
											type="button"
											onClick={() => setShowOutcomeSummary(true)}
											className="w-full flex-col max-sm:gap-1 max-sm:!rounded-[30px] sm:flex-row transition-opacity hover:opacity-90 active:scale-[0.995]"
											style={{
												background:
													"linear-gradient(135deg, rgba(11, 96, 90, 0.1) 0%, rgb(127 188 183 / 30%) 100%)",
												borderRadius: 999,
												padding: "20px 26px",
												display: "flex",
												alignItems: "center",
												marginBottom: 18,
												border: `1px solid ${C.cardBorder}`,
												boxShadow: "0 10px 24px rgba(31,80,73,0.08)",
											}}
										>
											{[
												{
													label: "Canceladas",
													value: selectedEntry.sessions.cancelled,
												},
												{
													label: "Com falha",
													value: selectedEntry.sessions.failed,
												},
												{
													label: "Abandonadas",
													value: selectedEntry.sessions.abandoned,
												},
											].map((item, i) => (
												<div
													key={item.label}
													className="flex items-center flex-1 max-sm:w-full"
												>
													{i > 0 && (
														<div
															className="hidden sm:block"
															style={{
																width: 1,
																height: 24,
																backgroundColor: "rgba(17,75,69,0.14)",
																flexShrink: 0,
															}}
														/>
													)}
													<div className="flex items-baseline gap-2 flex-1 justify-center">
														<span
															className="text-right"
															style={{
																fontSize: 16,
																fontWeight: 600,
																color: "#111111",
																fontFamily:
																	'-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", sans-serif',
																flex: 2,
															}}
														>
															{item.value}
														</span>
														<span
															className="text-left"
															style={{
																fontSize: 12,
																color: "rgba(0,0,0,0.64)",
																fontFamily:
																	'-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif',
																flex: 3,
															}}
														>
															{item.label}
														</span>
													</div>
												</div>
											))}
											<div
												className="hidden sm:flex ml-3 items-center justify-center pointer-events-none"
												style={{
													width: 30,
													height: 30,
													background: "transparent",
													padding: 0,
													flexShrink: 0,
												}}
											>
												<img
													src={CARD_ARROW}
													alt=""
													aria-hidden="true"
													style={{
														width: 18,
														height: 18,
														objectFit: "contain",
													}}
												/>
											</div>
										</button>
									</>
								)}
							</div>
						)}
					</div>

					{/* ── RIGHT — Os meus seniores (45%) ── */}
					<div
						className="pt-4 xl:pt-[78px]"
						style={{ flex: 1, minWidth: 0, width: "100%" }}
					>
						{/* Cream/warm yellow background panel */}
						<div
							className="xl:min-h-[498px]"
							style={{
								background: "#ffffff",
								borderRadius: 34,
								padding: "22px 22px 22px",
								border: `1px solid rgba(33,91,88,0.18)`,
								boxShadow: "0 18px 42px rgba(31,80,73,0.08)",
							}}
						>
							{/* Section header */}
							<div
								className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"
								style={{ marginBottom: 18 }}
							>
								<div style={{ minWidth: 0 }}>
									<h2
										style={{
											fontSize: 21,
											fontWeight: 400,
											color: "#111111",
											fontFamily:
												'-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", sans-serif',
											letterSpacing: "-0.35px",
											whiteSpace: "nowrap",
										}}
									>
										Os meus seniores
									</h2>
									{dashboard && (
										<p
											style={{
												fontSize: 12,
												marginTop: 2,
												color: "rgba(0,0,0,0.58)",
												textAlign: "left",
												fontFamily:
													'-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif',
											}}
										>
											{dashboard.totalSeniors} associados
										</p>
									)}
								</div>
								<div className="flex gap-2 flex-wrap justify-start sm:justify-end">
									{institutions.length > 0 && (
										<DashSelect
											value={filterInstitution}
											onChange={setFilterInstitution}
											options={[
												{ value: "all", label: "Todos" },
												...institutions.map((name) => ({
													value: name,
													label: name,
												})),
											]}
										/>
									)}
									<DashSelect
										value={sortKey}
										onChange={(v) => setSortKey(v as SortKey)}
										options={[
											{ value: "recent", label: "Recente" },
											{ value: "name", label: "Nome" },
											{ value: "sentiment", label: "Estado emocional" },
										]}
									/>
								</div>
							</div>

							{/* Search bar */}
							<div style={{ position: "relative", marginBottom: 12 }}>
								<HiMagnifyingGlass
									size={14}
									style={{
										position: "absolute",
										left: 13,
										top: "50%",
										transform: "translateY(-50%)",
										color: C.textMuted,
										pointerEvents: "none",
									}}
								/>
								<input
									type="text"
									placeholder="Pesquisar sénior..."
									value={searchQuery}
									onChange={(e) => setSearchQuery(e.target.value)}
									style={{
										width: "100%",
										boxSizing: "border-box",
										borderRadius: 14,
										border: `1px solid rgba(33,91,88,0.18)`,
										backgroundColor: "rgba(255,255,255,0.9)",
										padding: "8px 34px 8px 32px",
										fontSize: 12,
										color: C.text,
										outline: "none",
										height: 36,
									}}
								/>
								{searchQuery && (
									<button
										type="button"
										onClick={() => setSearchQuery("")}
										style={{
											position: "absolute",
											right: 10,
											top: "50%",
											transform: "translateY(-50%)",
											background: "none",
											border: "none",
											cursor: "pointer",
											color: C.textMuted,
											display: "flex",
											alignItems: "center",
											padding: 2,
										}}
									>
										<HiXMark size={13} />
									</button>
								)}
							</div>

							{/* Senior cards — compact horizontal */}
							{!loading && (
								<div
									className="flex flex-col xl:h-[338px]"
									style={{
										gap: 8,
										maxHeight: 338,
										overflowY: "auto",
										paddingRight: 2,
									}}
								>
									{sorted.map((senior) => {
										const initial = senior.fullName.charAt(0).toUpperCase();
										const sentiment = sentimentMap[senior.seniorId];
										const sentimentColor = sentiment
											? TONE_COLOR[sentiment]
											: null;
										const sentimentLabel = sentiment
											? TONE_LABEL[sentiment]
											: null;
										return (
											<div
												key={senior.seniorId}
												role="button"
												tabIndex={0}
												onClick={() =>
													navigate({
														to: "/$lang/caretaker/reports/$residentId",
														params: { lang, residentId: senior.seniorId },
													})
												}
												onKeyDown={(e) => {
													if (e.key === "Enter")
														navigate({
															to: "/$lang/caretaker/reports/$residentId",
															params: { lang, residentId: senior.seniorId },
														});
												}}
												className="flex items-center gap-3 cursor-pointer transition-all hover:opacity-90 active:scale-[0.99]"
												style={{
													background: "rgba(255,255,255,0.86)",
													borderRadius: 22,
													padding: "16px 16px",
													border: `1px solid rgba(33,91,88,0.18)`,
													boxShadow: "0 10px 24px rgba(31,80,73,0.06)",
												}}
												onMouseEnter={(e) => {
													(e.currentTarget as HTMLDivElement).style.background =
														"rgba(255,255,255,0.98)";
												}}
												onMouseLeave={(e) => {
													(e.currentTarget as HTMLDivElement).style.background =
														"rgba(255,255,255,0.86)";
												}}
											>
												<div
													style={{
														width: 40,
														height: 40,
														borderRadius: "50%",
														backgroundColor: "rgba(185,235,220,0.72)",
														color: "#1e6f64",
														fontSize: 15,
														fontWeight: 600,
														display: "flex",
														alignItems: "center",
														justifyContent: "center",
														flexShrink: 0,
														overflow: "hidden",
													}}
												>
													{senior.photoDataUrl ? (
														<img
															src={senior.photoDataUrl}
															alt={senior.fullName}
															style={{
																width: "100%",
																height: "100%",
																objectFit: "cover",
															}}
														/>
													) : (
														initial
													)}
												</div>
												<div className="flex flex-1 max-xl:flex-col gap-2">
													<div className="flex-1 min-w-0">
														<div className="flex items-center gap-1.5 flex-wrap">
															<p
																style={{
																	fontSize: 14,
																	fontWeight: 600,
																	color: "#111111",
																	lineHeight: 1.2,
																	fontFamily:
																		'-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif',
																}}
															>
																{senior.fullName}
															</p>
															{sentimentLabel && sentimentColor && (
																<span
																	style={{
																		fontSize: 10,
																		fontWeight: 400,
																		color:
																			sentimentColor === "#A8E6DA"
																				? "#111111"
																				: sentimentColor,
																		backgroundColor: `${sentimentColor}22`,
																		borderRadius: 100,
																		padding: "2px 8px",
																	}}
																>
																	{sentimentLabel}
																</span>
															)}
														</div>
														<p
															style={{
																fontSize: 11,
																color: "rgba(0,0,0,0.58)",
																marginTop: 2,
																fontFamily:
																	'-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif',
															}}
														>
															{timeAgo(senior.lastConversationAt)}
														</p>
													</div>
													<div
														className="flex items-center gap-1.5 shrink-0"
														onClick={(e) => e.stopPropagation()}
														onKeyDown={(e) => e.stopPropagation()}
													>
														<button
															type="button"
															aria-label={`Abrir perfil de ${senior.fullName}`}
															onClick={(e) => {
																e.stopPropagation();
																navigate({
																	to: "/$lang/caretaker/seniors/$residentId",
																	params: { lang, residentId: senior.seniorId },
																	search: { tab: undefined },
																});
															}}
															className="flex items-center justify-center transition-opacity hover:opacity-80 active:scale-95"
															style={{
																width: 34,
																height: 34,
																borderRadius: 100,
																background: "rgba(255,255,255,0.96)",
																border: "1px solid rgba(0,0,0,0.16)",
																color: "#111111",
																cursor: "pointer",
															}}
														>
															<HiMiniUserCircle size={17} />
														</button>
														<button
															type="button"
															onClick={(e) => {
																e.stopPropagation();
																navigate({
																	to: "/$lang/caretaker/reports/$residentId",
																	params: { lang, residentId: senior.seniorId },
																});
															}}
															className="transition-opacity hover:opacity-80 active:scale-95"
															style={{
																background: "rgba(255,255,255,0.96)",
																border: "1px solid rgba(0,0,0,0.16)",
																color: "#111111",
																borderRadius: 100,
																padding: "6px 12px",
																fontSize: 11,
																fontWeight: 600,
																cursor: "pointer",
																whiteSpace: "nowrap",
															}}
														>
															Ver relatório
														</button>
														<button
															type="button"
															onClick={(e) => {
																e.stopPropagation();
																setCallingSenior(senior);
															}}
															className="flex items-center justify-center transition-opacity hover:opacity-80"
															style={{
																width: 32,
																height: 32,
																borderRadius: 100,
																backgroundColor: "#111111",
																color: "#fff",
																border: "none",
																cursor: "pointer",
																boxShadow: "0 8px 16px rgba(0,0,0,0.14)",
															}}
														>
															<HiPhone size={13} />
														</button>
													</div>
												</div>
											</div>
										);
									})}
									{sorted.length === 0 && (
										<p
											style={{
												fontSize: 13,
												color: C.textSub,
												textAlign: "center",
												padding: "24px 0",
											}}
										>
											Nenhum sénior associado.
										</p>
									)}
								</div>
							)}
						</div>
					</div>
				</div>

				<div
					style={{
						display: "flex",
						justifyContent: "center",
						marginTop: 48,
						paddingBottom: 12,
						pointerEvents: "none",
					}}
				>
					<PoweredByKindtech />
				</div>
			</div>

			{/* ── Modal de chamada ── */}
			{callingSenior && (
				<div
					className="flex items-center justify-center"
					style={{
						position: "fixed",
						inset: 0,
						zIndex: 500,
						backdropFilter: "blur(6px)",
						backgroundColor: "rgba(0,0,0,0.2)",
					}}
				>
					<div
						className="rounded-2xl shadow-xl mx-4"
						style={{
							...DS.solidCard,
							maxWidth: 440,
							width: "100%",
							padding: 24,
						}}
					>
						<h2
							className="text-lg font-bold mb-2"
							style={{ color: C.tealDark }}
						>
							Em breve!
						</h2>
						<p className="text-sm mb-6" style={{ color: C.textSub }}>
							Esta funcionalidade estará disponível em breve.
						</p>
						<div className="flex justify-end gap-3">
							<button
								type="button"
								onClick={() => setCallingSenior(null)}
								className="rounded-xl px-5 py-2.5 text-sm font-semibold transition-opacity hover:opacity-80"
								style={{
									backgroundColor: "transparent",
									color: C.textSub,
									border: `1px solid ${C.cardBorder}`,
								}}
							>
								Cancelar
							</button>
							<button
								type="button"
								onClick={() => setCallingSenior(null)}
								className="rounded-xl px-5 py-2.5 text-sm font-semibold transition-opacity hover:opacity-85"
								style={{ backgroundColor: C.teal, color: "#fff" }}
							>
								Fechar
							</button>
						</div>
					</div>
				</div>
			)}

			{/* ── Modal de categoria ── */}
			{activeCategory && selectedEntry && (
				<CategoryModal
					category={activeCategory}
					entry={selectedEntry}
					onClose={() => setActiveCategory(null)}
					onSeniorClick={(seniorId) =>
						navigate({
							to: "/$lang/caretaker/reports/$residentId",
							params: { lang, residentId: seniorId },
						})
					}
				/>
			)}
			{showTodaySessions && selectedEntry && (
				<TodaySessionsModal
					seniors={seniorsWithSession}
					onClose={() => setShowTodaySessions(false)}
					onSeniorClick={(seniorId) =>
						navigate({
							to: "/$lang/caretaker/reports/$residentId",
							params: { lang, residentId: seniorId },
						})
					}
				/>
			)}
			{showOutcomeSummary && selectedEntry && (
				<OutcomeSummaryModal
					entry={selectedEntry}
					onClose={() => setShowOutcomeSummary(false)}
					onSeniorClick={(seniorId) =>
						navigate({
							to: "/$lang/caretaker/reports/$residentId",
							params: { lang, residentId: seniorId },
						})
					}
				/>
			)}
		</div>
	);
}
