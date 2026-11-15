import { createLazyFileRoute, useRouter } from "@tanstack/react-router";
import type {
	ChangeEvent,
	InputHTMLAttributes,
	KeyboardEvent,
	ReactNode,
	TextareaHTMLAttributes,
} from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
	HiArrowLeft,
	HiCamera,
	HiCheck,
	HiChevronDown,
	HiMiniUserCircle,
	HiOutlineSparkles,
	HiSquare2Stack,
	HiTrash,
} from "react-icons/hi2";
import * as Select from "@radix-ui/react-select";
import { toast } from "react-toastify";
import { api_client } from "@/frontend/utils/api";
import { usePageBackgroundStore } from "@/frontend/stores/pageBackground";
import { readApiError } from "@/frontend/utils/apiErrors";
import { DS } from "@/frontend/designSystem";
import { GlowingButton } from "@/frontend/components/ui/glowing-button";
import { LoginShapeBackground } from "@/frontend/components/ui/shape-landing-background";
import type {
	CaregiverNoteCategory,
	CaregiverNoteResponse,
	CaregiverNotesResponse,
	SeniorResponse,
} from "@/shared/contracts";

export const Route = createLazyFileRoute(
	"/$lang/_app/_app/_caretaker/caretaker/seniors/$residentId",
)({
	component: RouteComponent,
});

// ── Constants ──────────────────────────────────────────────────────────────

const HEADER_BG =
	"radial-gradient(circle at 12% 24%, rgba(255,252,226,0.96) 0%, rgba(255,252,226,0.74) 24%, rgba(255,252,226,0.18) 42%, rgba(255,252,226,0) 58%), radial-gradient(circle at 92% 80%, rgba(185,235,220,0.86) 0%, rgba(185,235,220,0.52) 18%, rgba(185,235,220,0.14) 36%, rgba(185,235,220,0) 54%), linear-gradient(135deg, #fffce2 0%, #ffffff 52%, #b9ebdc 100%)";

const BODY_BG =
	"radial-gradient(circle at 12% 24%, rgba(255,252,226,0.32) 0%, rgba(255,252,226,0.16) 24%, rgba(255,252,226,0.04) 42%, rgba(255,252,226,0) 58%), radial-gradient(circle at 92% 80%, rgba(185,235,220,0.22) 0%, rgba(185,235,220,0.10) 18%, rgba(185,235,220,0.03) 36%, rgba(185,235,220,0) 54%), linear-gradient(135deg, #fffefb 0%, #ffffff 52%, #f8fefb 100%)";

const SF =
	'-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", sans-serif';
const SF_TEXT =
	'-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif';

const C = {
	text: DS.C.text,
	textSub: DS.C.textSub,
	textMuted: DS.C.textMuted,
	teal: "#2DBFA0",
	tealDark: DS.C.teal700,
	border: "rgba(26,95,90,0.12)",
	divider: "rgba(26,95,90,0.07)",
	surface: "rgba(255,255,255,0.88)",
	chip: "rgba(45,191,160,0.10)",
	chipText: DS.C.teal700,
	alert: "#7a3010",
	alertBg: "rgba(215,120,60,0.06)",
	alertBorder: "rgba(215,120,60,0.25)",
	amber: "#c06a20",
	amberBg: "rgba(212,132,90,0.07)",
	amberBorder: "rgba(212,132,90,0.22)",
	cardBorder: "rgba(17,75,69,0.12)",
};

const NOTE_CATEGORIES: CaregiverNoteCategory[] = [
	"Humor",
	"Saúde",
	"Alimentação",
	"Sono",
	"Mobilidade",
	"Social",
	"Medicação",
	"Geral",
];

const CATEGORY_STYLES: Record<
	CaregiverNoteCategory,
	{ bg: string; border: string; text: string; accent: string }
> = {
	Humor: {
		bg: "#FFF7CC",
		border: "#E4C85B",
		text: "#6C5A10",
		accent: "#D5A916",
	},
	Saúde: {
		bg: "#EAF7F2",
		border: "#A7D9C7",
		text: "#1F6758",
		accent: "#2DBFA0",
	},
	Alimentação: {
		bg: "#FFF0DB",
		border: "#E6BB7D",
		text: "#735021",
		accent: "#D18B2B",
	},
	Sono: {
		bg: "#EEF1FF",
		border: "#B9C2EA",
		text: "#48527C",
		accent: "#7181D8",
	},
	Mobilidade: {
		bg: "#ECF7E9",
		border: "#B9DFAF",
		text: "#3F6B38",
		accent: "#73B861",
	},
	Social: {
		bg: "#F8EAF3",
		border: "#E0B4CE",
		text: "#7A4365",
		accent: "#C06A9B",
	},
	Medicação: {
		bg: "#FDEEEE",
		border: "#E6B2B2",
		text: "#7B3D3D",
		accent: "#D96B6B",
	},
	Geral: {
		bg: "#F7F7F2",
		border: "#D5D5C8",
		text: "#5F665F",
		accent: "#8A938A",
	},
};

const UNCATEGORIZED_STYLE = {
	bg: "#FFFFFF",
	border: C.cardBorder,
	text: "#62716D",
	accent: "#A8B4B0",
};

// ── Types ──────────────────────────────────────────────────────────────────

type TabId = "perfil" | "memoria" | "notas";

type SeniorProfileForm = {
	fullName: string;
	age: string;
	family: string;
	familyMode: LivingOption;
	gender: "" | "m" | "f";
	diagnoses: string[];
	avoidTopics: string[];
	photoDataUrl: string | null;
	likes: SeniorResponse["likes"];
};

type NoteFormState = {
	content: string;
	category: CaregiverNoteCategory | null;
	pinned: boolean;
};

const LIVING_OPTIONS = [
	{ value: "", label: "Não definido" },
	{ value: "sozinho", label: "Sozinho" },
	{ value: "familia", label: "Com família" },
	{ value: "lar", label: "Num lar" },
	{ value: "outro", label: "Outro" },
] as const;

type LivingOption = (typeof LIVING_OPTIONS)[number]["value"];
type PresetLivingOption = Exclude<LivingOption, "" | "outro">;

const LIVING_STORED_VALUES: Record<PresetLivingOption, string> = {
	sozinho: "sozinho",
	familia: "família",
	lar: "lar",
};

// ── Utilities ──────────────────────────────────────────────────────────────

function calculateAge(birthDate: string | null | undefined) {
	if (!birthDate) return "";
	const birth = new Date(birthDate);
	if (Number.isNaN(birth.getTime())) return "";
	const today = new Date();
	let age = today.getFullYear() - birth.getFullYear();
	const monthDelta = today.getMonth() - birth.getMonth();
	if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < birth.getDate()))
		age -= 1;
	return String(Math.max(age, 0));
}

function isPresetLivingOption(
	value: LivingOption,
): value is PresetLivingOption {
	return value === "sozinho" || value === "familia" || value === "lar";
}

function getLivingOption(value: string): LivingOption {
	const normalized = value.trim().toLocaleLowerCase("pt-PT");
	if (!normalized) return "";
	if (normalized === "sozinho" || normalized === "vive sozinho")
		return "sozinho";
	if (
		normalized === "família" ||
		normalized === "familia" ||
		normalized === "com família" ||
		normalized === "com familia" ||
		normalized === "vive com família" ||
		normalized === "vive com familia"
	)
		return "familia";
	if (
		normalized === "lar" ||
		normalized === "num lar" ||
		normalized === "vive num lar"
	)
		return "lar";
	return "outro";
}

function normalizeTags(values: string[]) {
	return [...new Set(values.map((v) => v.trim()).filter(Boolean))];
}

function formatDateTime(value: string) {
	return new Date(value).toLocaleString("pt-PT", {
		day: "numeric",
		month: "short",
		hour: "2-digit",
		minute: "2-digit",
	});
}

function formatNoteDate(timestamp: string) {
	const date = new Date(timestamp);
	if (Number.isNaN(date.getTime())) return timestamp;
	return date.toLocaleString("pt-PT", {
		day: "2-digit",
		month: "short",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
}

function createFormState(senior: SeniorResponse): SeniorProfileForm {
	return {
		fullName: senior.fullName,
		age: calculateAge(senior.birthDate),
		family: senior.family ?? "",
		familyMode: getLivingOption(senior.family ?? ""),
		gender: senior.gender ?? "",
		diagnoses: senior.diagnoses ?? [],
		avoidTopics: senior.avoidTopics ?? [],
		photoDataUrl: senior.photoDataUrl ?? null,
		likes: {
			football: senior.likes.football ?? [],
			music: senior.likes.music ?? [],
			cinema: senior.likes.cinema ?? [],
			gastronomy: senior.likes.gastronomy ?? [],
			hobbies: senior.likes.hobbies ?? [],
			others: senior.likes.others ?? {},
		},
	};
}

function initialsFromName(name: string) {
	return name
		.split(/\s+/)
		.filter(Boolean)
		.slice(0, 2)
		.map((p) => p[0]?.toUpperCase() ?? "")
		.join("");
}

async function compressImageToDataUrl(file: File) {
	const original = await readFileAsDataUrl(file);
	const image = await loadImage(original);
	const canvas = document.createElement("canvas");
	const ctx = canvas.getContext("2d");
	if (!ctx) throw new Error("Não foi possível preparar a imagem.");
	const maxSide = 720;
	const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
	canvas.width = Math.max(1, Math.round(image.width * scale));
	canvas.height = Math.max(1, Math.round(image.height * scale));
	ctx.fillStyle = "#f7f7f4";
	ctx.fillRect(0, 0, canvas.width, canvas.height);
	ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
	return canvas.toDataURL("image/jpeg", 0.82);
}

function readFileAsDataUrl(file: File) {
	return new Promise<string>((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(String(reader.result ?? ""));
		reader.onerror = () =>
			reject(new Error("Não foi possível ler a imagem selecionada."));
		reader.readAsDataURL(file);
	});
}

function loadImage(src: string) {
	return new Promise<HTMLImageElement>((resolve, reject) => {
		const image = new Image();
		image.onload = () => resolve(image);
		image.onerror = () =>
			reject(new Error("Não foi possível processar a imagem selecionada."));
		image.src = src;
	});
}

// ── Design primitives ──────────────────────────────────────────────────────

function Divider() {
	return <div style={{ height: 1, background: C.divider, margin: "32px 0" }} />;
}

function SectionHeader({
	title,
	subtitle,
}: { title: string; subtitle?: string }) {
	return (
		<div style={{ marginBottom: 20 }}>
			<h3
				style={{
					margin: 0,
					fontSize: 15,
					fontWeight: 700,
					letterSpacing: "-0.01em",
					color: C.text,
				}}
			>
				{title}
			</h3>
			{subtitle && (
				<p
					style={{
						margin: "4px 0 0",
						fontSize: 13,
						lineHeight: 1.5,
						color: C.textMuted,
					}}
				>
					{subtitle}
				</p>
			)}
		</div>
	);
}

function FormRow({
	label,
	last,
	children,
}: { label: string; last?: boolean; children: ReactNode }) {
	return (
		<div
			className="grid grid-cols-1 gap-2 sm:grid-cols-[156px_1fr] sm:items-start sm:gap-4"
			style={{
				padding: "13px 0",
				borderBottom: last ? "none" : `1px solid ${C.divider}`,
			}}
		>
			<span
				style={{
					fontSize: 13,
					fontWeight: 600,
					color: C.textSub,
					paddingTop: 10,
					lineHeight: 1.3,
				}}
			>
				{label}
			</span>
			<div>{children}</div>
		</div>
	);
}

function ReadOnlyProfileValue({
	value,
	placeholder = "Não definido",
}: { value: string; placeholder?: string }) {
	return (
		<div
			aria-readonly="true"
			style={{
				width: "100%",
				borderRadius: DS.radius.md,
				border: `1px solid ${C.border}`,
				background: "rgba(255,255,255,0.54)",
				color: value ? C.textSub : C.textMuted,
				padding: "10px 14px",
				fontSize: 14,
				lineHeight: "20px",
				boxSizing: "border-box",
			}}
		>
			{value || placeholder}
		</div>
	);
}

function StyledInput(props: InputHTMLAttributes<HTMLInputElement>) {
	return (
		<input
			{...props}
			style={{
				width: "100%",
				borderRadius: DS.radius.md,
				border: `1px solid ${C.border}`,
				background: "rgba(255,255,255,0.9)",
				color: C.text,
				padding: "10px 14px",
				fontSize: 14,
				outline: "none",
				transition: DS.transition.fast,
				boxSizing: "border-box",
				...(props.style ?? {}),
			}}
		/>
	);
}

function StyledTextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
	return (
		<textarea
			{...props}
			style={{
				width: "100%",
				minHeight: 96,
				resize: "vertical",
				borderRadius: DS.radius.md,
				border: `1px solid ${C.border}`,
				background: "rgba(255,255,255,0.9)",
				color: C.text,
				padding: "10px 14px",
				fontSize: 14,
				outline: "none",
				transition: DS.transition.fast,
				boxSizing: "border-box",
				fontFamily: "inherit",
				...(props.style ?? {}),
			}}
		/>
	);
}

const PROFILE_SELECT_NONE = "__none__";

function ProfileSelect({
	value,
	onChange,
	options,
}: {
	value: string;
	onChange: (v: string) => void;
	options: Array<{ value: string; label: string }>;
}) {
	const toInternal = (v: string) => (v === "" ? PROFILE_SELECT_NONE : v);
	const fromInternal = (v: string) => (v === PROFILE_SELECT_NONE ? "" : v);
	return (
		<Select.Root
			value={toInternal(value)}
			onValueChange={(v) => onChange(fromInternal(v))}
		>
			<Select.Trigger
				className="appearance-none focus:outline-none"
				style={{
					width: "100%",
					boxSizing: "border-box",
					borderRadius: DS.radius.md,
					border: `1px solid ${C.border}`,
					background: "rgba(255,255,255,0.9)",
					color: value ? C.text : C.textMuted,
					fontSize: 14,
					cursor: "pointer",
					padding: "10px 14px",
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
					gap: 6,
					userSelect: "none",
					transition: DS.transition.fast,
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
						size={13}
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
								key={toInternal(opt.value)}
								value={toInternal(opt.value)}
								className="data-[highlighted]:bg-[rgba(45,191,160,0.09)] data-[state=checked]:font-semibold focus:outline-none"
								style={{
									display: "flex",
									alignItems: "center",
									justifyContent: "space-between",
									gap: 8,
									padding: "8px 10px 8px 12px",
									borderRadius: 10,
									fontSize: 14,
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

function TagPills({
	values,
	onRemove,
	accent,
	shouldReduce,
}: {
	values: string[];
	onRemove: (v: string) => void;
	accent?: "amber";
	shouldReduce: boolean;
}) {
	return (
		<div className="flex flex-wrap gap-1.5">
			<AnimatePresence mode="popLayout">
				{values.map((v) => (
					<motion.button
						key={v}
						type="button"
						layout
						initial={shouldReduce ? false : { opacity: 0, scale: 0.84 }}
						animate={{ opacity: 1, scale: 1 }}
						exit={shouldReduce ? undefined : { opacity: 0, scale: 0.84 }}
						transition={{ type: "spring", duration: 0.17, bounce: 0 }}
						onClick={() => onRemove(v)}
						title="Clique para remover"
						style={{
							display: "inline-flex",
							alignItems: "center",
							gap: 4,
							borderRadius: DS.radius.full,
							border: `1px solid ${accent === "amber" ? C.amberBorder : "rgba(45,191,160,0.22)"}`,
							background: accent === "amber" ? C.amberBg : C.chip,
							color: accent === "amber" ? C.amber : C.chipText,
							padding: "5px 10px",
							fontSize: 13,
							fontWeight: 500,
							cursor: "pointer",
							transition: DS.transition.fast,
						}}
					>
						{v}
						<span style={{ fontSize: 14, opacity: 0.55, lineHeight: 1 }}>
							×
						</span>
					</motion.button>
				))}
			</AnimatePresence>
			{values.length === 0 && (
				<span style={{ fontSize: 13, color: C.textMuted }}>
					Ainda sem registos.
				</span>
			)}
		</div>
	);
}

function TagEditor({
	label,
	placeholder,
	values,
	onChange,
	accent,
	last,
	shouldReduce,
}: {
	label: string;
	placeholder: string;
	values: string[];
	onChange: (values: string[]) => void;
	accent?: "amber";
	last?: boolean;
	shouldReduce: boolean;
}) {
	const [draft, setDraft] = useState("");
	const commit = () => {
		const next = draft.trim();
		if (!next) return;
		onChange(normalizeTags([...values, next]));
		setDraft("");
	};
	const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Enter" || e.key === ",") {
			e.preventDefault();
			commit();
		}
	};
	return (
		<FormRow label={label} last={last}>
			<div className="flex flex-col gap-2">
				<TagPills
					values={values}
					onRemove={(v) => onChange(values.filter((item) => item !== v))}
					accent={accent}
					shouldReduce={shouldReduce}
				/>
				<div className="flex gap-2">
					<StyledInput
						value={draft}
						onChange={(e) => setDraft(e.target.value)}
						onKeyDown={onKeyDown}
						placeholder={placeholder}
						style={{ flex: 1 }}
					/>
					<button
						type="button"
						onClick={commit}
						style={{
							...DS.btnSecondary,
							padding: "9px 14px",
							fontSize: 13,
							borderRadius: DS.radius.md,
							whiteSpace: "nowrap",
						}}
					>
						+ Adicionar
					</button>
				</div>
			</div>
		</FormRow>
	);
}

function EmptyState({ message }: { message: string }) {
	return (
		<div
			style={{
				padding: "22px 16px",
				borderRadius: DS.radius.lg,
				border: `1px dashed ${C.border}`,
				textAlign: "center",
				color: C.textMuted,
				fontSize: 14,
			}}
		>
			{message}
		</div>
	);
}

// ── Note components (from notes page) ─────────────────────────────────────

function NoteCard({
	note,
	onEdit,
	onDelete,
	onTogglePinned,
	busy,
}: {
	note: CaregiverNoteResponse;
	onEdit: (note: CaregiverNoteResponse) => void;
	onDelete: (note: CaregiverNoteResponse) => void;
	onTogglePinned: (note: CaregiverNoteResponse) => void;
	busy?: boolean;
}) {
	const categoryStyle = note.category
		? CATEGORY_STYLES[note.category]
		: UNCATEGORIZED_STYLE;
	const categoryLabel = note.category ?? "Geral";
	return (
		<article
			style={{
				minHeight: 190,
				border: "1px dashed rgba(96,111,107,0.24)",
				borderRadius: 0,
				background: `linear-gradient(145deg, rgba(255,255,255,0.98) 0%, rgba(255,255,255,0.94) 52%, ${categoryStyle.bg} 100%)`,
				padding: 18,
				position: "relative",
				overflow: "hidden",
				display: "flex",
				flexDirection: "column",
			}}
		>
			<div
				aria-hidden="true"
				style={{
					position: "absolute",
					width: 116,
					height: 116,
					borderRadius: "50%",
					top: -48,
					right: -42,
					background: `radial-gradient(circle, ${categoryStyle.accent}26 0%, ${categoryStyle.accent}12 42%, transparent 72%)`,
				}}
			/>
			<div
				aria-hidden="true"
				style={{
					position: "absolute",
					inset: 0,
					backgroundImage: `linear-gradient(rgba(96,111,107,0.14) 1px, transparent 1px), linear-gradient(90deg, rgba(96,111,107,0.14) 1px, transparent 1px)`,
					backgroundSize: "18px 18px",
					opacity: 0.34,
					WebkitMaskImage:
						"linear-gradient(135deg, rgba(0,0,0,0.22) 0%, rgba(0,0,0,0.68) 52%, rgba(0,0,0,0.92) 100%)",
					maskImage:
						"linear-gradient(135deg, rgba(0,0,0,0.22) 0%, rgba(0,0,0,0.68) 52%, rgba(0,0,0,0.92) 100%)",
				}}
			/>
			<div
				className="flex items-start justify-between gap-3"
				style={{ marginBottom: 14, position: "relative", zIndex: 1 }}
			>
				<span
					style={{
						display: "inline-flex",
						alignItems: "center",
						borderRadius: 6,
						background: "#fff",
						color: categoryStyle.text,
						border: `1px solid ${categoryStyle.border}`,
						minHeight: 30,
						padding: "5px 10px",
						fontSize: 11,
						fontWeight: 700,
						fontFamily: SF_TEXT,
					}}
				>
					{categoryLabel}
				</span>
				<button
					type="button"
					onClick={() => onTogglePinned(note)}
					disabled={busy}
					style={{
						border: "none",
						borderRadius: 8,
						background: note.pinned ? C.tealDark : "rgba(255,255,255,0.52)",
						color: note.pinned ? "#fff" : categoryStyle.text,
						padding: "5px 9px",
						fontSize: 11,
						fontWeight: 700,
						fontFamily: SF_TEXT,
						cursor: busy ? "default" : "pointer",
						whiteSpace: "nowrap",
					}}
				>
					{note.pinned ? "Fixada" : "Fixar"}
				</button>
			</div>
			<p
				style={{
					margin: 0,
					color: "#1F2F2C",
					fontSize: 14,
					lineHeight: 1.58,
					fontFamily: SF_TEXT,
					whiteSpace: "pre-wrap",
					overflowWrap: "anywhere",
					position: "relative",
					zIndex: 1,
					flex: 1,
					maxHeight: 14 * 1.58 * 9,
					overflowY: "auto",
					paddingRight: 4,
				}}
			>
				{note.content}
			</p>
			<div
				className="flex items-center justify-between gap-3 flex-wrap"
				style={{ marginTop: 14, position: "relative", zIndex: 1 }}
			>
				<span
					style={{
						color: "#7A8683",
						fontSize: 11,
						fontWeight: 600,
						fontFamily: SF_TEXT,
					}}
				>
					{formatNoteDate(note.createdAt)}
				</span>
				<div className="flex items-center gap-2">
					<button
						type="button"
						onClick={() => onEdit(note)}
						style={{
							border: "none",
							background: "rgba(255,255,255,0.58)",
							color: categoryStyle.text,
							borderRadius: 7,
							padding: "6px 9px",
							fontSize: 11,
							fontWeight: 700,
							fontFamily: SF_TEXT,
							cursor: "pointer",
						}}
					>
						Editar
					</button>
					<button
						type="button"
						onClick={() => onDelete(note)}
						disabled={busy}
						style={{
							border: "none",
							background: "rgba(255,255,255,0.58)",
							color: "#8D4141",
							borderRadius: 7,
							padding: "6px 9px",
							fontSize: 11,
							fontWeight: 700,
							fontFamily: SF_TEXT,
							cursor: busy ? "default" : "pointer",
						}}
					>
						Apagar
					</button>
				</div>
			</div>
		</article>
	);
}

// ── Main component ─────────────────────────────────────────────────────────

function RouteComponent() {
	const { residentId: seniorId, lang } = Route.useParams();
	const router = useRouter();
	const setPageBackground = usePageBackgroundStore((s) => s.setBackground);
	const setHideFooter = usePageBackgroundStore((s) => s.setHideFooter);
	const shouldReduce = useReducedMotion() ?? false;

	// ── Profile state
	const [senior, setSenior] = useState<SeniorResponse | null>(null);
	const [form, setForm] = useState<SeniorProfileForm | null>(null);
	const [initialForm, setInitialForm] = useState<SeniorProfileForm | null>(
		null,
	);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [saveFeedback, setSaveFeedback] = useState<string | null>(null);
	const [copied, setCopied] = useState(false);
	const [activeTab, setActiveTab] = useState<TabId>(() => {
		const t = new URLSearchParams(window.location.search).get("tab");
		return t === "notas" || t === "memoria" ? t : "perfil";
	});
	const fileInputRef = useRef<HTMLInputElement>(null);

	// ── Unsaved changes guard
	const [confirmLeaveOpen, setConfirmLeaveOpen] = useState(false);
	const [pendingNavigate, setPendingNavigate] = useState<(() => void) | null>(
		null,
	);

	// ── Notes state
	const [notes, setNotes] = useState<CaregiverNoteResponse[]>([]);
	const [search, setSearch] = useState("");
	const [categoryFilter, setCategoryFilter] =
		useState<CaregiverNoteCategory | null>(null);
	const [noteModalOpen, setNoteModalOpen] = useState(false);
	const [editingNote, setEditingNote] = useState<CaregiverNoteResponse | null>(
		null,
	);
	const [noteForm, setNoteForm] = useState<NoteFormState>({
		content: "",
		category: null,
		pinned: false,
	});
	const [savingNoteModal, setSavingNoteModal] = useState(false);
	const [busyNoteId, setBusyNoteId] = useState<string | null>(null);

	// ── Context IA (quick add) state
	const [draftContext, setDraftContext] = useState("");
	const [draftContextCategory, setDraftContextCategory] =
		useState<CaregiverNoteCategory | null>(null);
	const [savingContext, setSavingContext] = useState(false);

	useEffect(() => {
		setPageBackground(null);
		setHideFooter(true);
		return () => {
			setHideFooter(false);
		};
	}, [setHideFooter, setPageBackground]);

	useEffect(() => {
		const load = async () => {
			setLoading(true);
			setError(null);

			const [seniorRes, notesRes] = await Promise.all([
				api_client.seniors[":seniorId"].$get({ param: { seniorId } }),
				api_client.caregiver.seniors[":seniorId"].notes.$get({
					param: { seniorId },
				}),
			]);

			if (!seniorRes.ok) {
				setError(await readApiError(seniorRes, lang));
				setLoading(false);
				return;
			}

			const seniorPayload = (await seniorRes.json()) as SeniorResponse;
			setSenior(seniorPayload);
			const fs = createFormState(seniorPayload);
			setForm(fs);
			setInitialForm(fs);

			if (notesRes.ok) {
				const notesPayload = (await notesRes.json()) as CaregiverNotesResponse;
				setNotes(notesPayload.notes);
			}

			setLoading(false);
		};
		void load();
	}, [lang, seniorId]);

	const refreshSenior = async () => {
		const res = await api_client.seniors[":seniorId"].$get({
			param: { seniorId },
		});
		if (!res.ok) throw new Error(await readApiError(res, lang));
		const payload = (await res.json()) as SeniorResponse;
		setSenior(payload);
		const fs = createFormState(payload);
		setForm(fs);
		setInitialForm(fs);
	};

	const saveProfile = async () => {
		if (!senior || !form) return;
		setSaving(true);
		setSaveFeedback(null);

		const profileRes = await api_client.seniors[":seniorId"].profile.$patch({
			param: { seniorId },
			json: {
				family: form.family.trim() || null,
				gender: form.gender || null,
				diagnoses: normalizeTags(form.diagnoses),
				avoidTopics: normalizeTags(form.avoidTopics),
				photoDataUrl: form.photoDataUrl,
			},
		});

		if (!profileRes.ok) {
			setSaveFeedback(await readApiError(profileRes, lang));
			setSaving(false);
			return;
		}

		const likesRes = await api_client.seniors[":seniorId"].likes.$patch({
			param: { seniorId },
			json: {
				likes: {
					football: normalizeTags(form.likes.football),
					music: normalizeTags(form.likes.music),
					cinema: normalizeTags(form.likes.cinema),
					gastronomy: normalizeTags(form.likes.gastronomy),
					hobbies: normalizeTags(form.likes.hobbies),
					others: form.likes.others ?? {},
				},
			},
		});

		if (!likesRes.ok) {
			setSaveFeedback(await readApiError(likesRes, lang));
			setSaving(false);
			return;
		}

		try {
			await refreshSenior();
			setSaveFeedback("Perfil atualizado com sucesso.");
		} catch (e) {
			setSaveFeedback(
				e instanceof Error
					? e.message
					: "Guardado, mas não foi possível atualizar.",
			);
		} finally {
			setSaving(false);
		}
	};

	const saveContext = async () => {
		const content = draftContext.trim();
		if (!content) return;
		setSavingContext(true);
		const res = await api_client.caregiver.seniors[":seniorId"].notes.$post({
			param: { seniorId },
			json: { content, category: draftContextCategory, pinned: true },
		});
		if (!res.ok) {
			toast.error(await readApiError(res, lang));
			setSavingContext(false);
			return;
		}
		const saved = (await res.json()) as CaregiverNoteResponse;
		setNotes((prev) => [saved, ...prev]);
		setDraftContext("");
		setDraftContextCategory(null);
		toast.success("Contexto guardado para o Compy.");
		setSavingContext(false);
	};

	const handlePhotoSelection = async (event: ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		if (!file || !form) return;
		try {
			const photoDataUrl = await compressImageToDataUrl(file);
			setForm({ ...form, photoDataUrl });
		} catch (e) {
			toast.error(
				e instanceof Error
					? e.message
					: "Não foi possível preparar a fotografia.",
			);
		} finally {
			event.target.value = "";
		}
	};

	const copyAccessCode = () => {
		if (!senior?.accessCode) return;
		void navigator.clipboard.writeText(senior.accessCode);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	// ── Notes CRUD
	const openCreateModal = () => {
		setEditingNote(null);
		setNoteForm({ content: "", category: null, pinned: false });
		setNoteModalOpen(true);
	};
	const openEditModal = (note: CaregiverNoteResponse) => {
		setEditingNote(note);
		setNoteForm({
			content: note.content,
			category: note.category,
			pinned: note.pinned,
		});
		setNoteModalOpen(true);
	};
	const saveNoteModal = async () => {
		const content = noteForm.content.trim();
		if (!content) return;
		setSavingNoteModal(true);
		const res = editingNote
			? await api_client.caregiver.seniors[":seniorId"].notes[":noteId"].$patch(
					{
						param: { seniorId, noteId: editingNote.id },
						json: {
							content,
							category: noteForm.category,
							pinned: noteForm.pinned,
						},
					},
				)
			: await api_client.caregiver.seniors[":seniorId"].notes.$post({
					param: { seniorId },
					json: {
						content,
						category: noteForm.category,
						pinned: noteForm.pinned,
					},
				});
		setSavingNoteModal(false);
		if (!res.ok) {
			toast.error(await readApiError(res, lang));
			return;
		}
		const saved = (await res.json()) as CaregiverNoteResponse;
		setNotes((prev) =>
			[saved, ...prev.filter((n) => n.id !== saved.id)].sort(
				(a, b) =>
					new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
			),
		);
		setNoteModalOpen(false);
		setEditingNote(null);
		toast.success(editingNote ? "Nota atualizada." : "Nota guardada.");
	};
	const togglePinned = async (note: CaregiverNoteResponse) => {
		setBusyNoteId(note.id);
		const res = await api_client.caregiver.seniors[":seniorId"].notes[
			":noteId"
		].$patch({
			param: { seniorId, noteId: note.id },
			json: { pinned: !note.pinned },
		});
		setBusyNoteId(null);
		if (!res.ok) {
			toast.error(await readApiError(res, lang));
			return;
		}
		const updated = (await res.json()) as CaregiverNoteResponse;
		setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
	};
	const deleteNote = async (note: CaregiverNoteResponse) => {
		if (!window.confirm("Apagar esta nota?")) return;
		setBusyNoteId(note.id);
		const res = await api_client.caregiver.seniors[":seniorId"].notes[
			":noteId"
		].$delete({
			param: { seniorId, noteId: note.id },
		});
		setBusyNoteId(null);
		if (!res.ok) {
			toast.error(await readApiError(res, lang));
			return;
		}
		setNotes((prev) => prev.filter((n) => n.id !== note.id));
		toast.success("Nota apagada.");
	};

	const isDirty = useMemo(() => {
		if (!form || !initialForm) return false;
		return JSON.stringify(form) !== JSON.stringify(initialForm);
	}, [form, initialForm]);

	const filteredNotes = useMemo(() => {
		const needle = search.trim().toLowerCase();
		return notes.filter((n) => {
			const matchesSearch = !needle || n.content.toLowerCase().includes(needle);
			const matchesCategory = !categoryFilter || n.category === categoryFilter;
			return matchesSearch && matchesCategory;
		});
	}, [notes, search, categoryFilter]);

	const pinnedNotes = filteredNotes.filter((n) => n.pinned);
	const regularNotes = filteredNotes.filter((n) => !n.pinned);
	const memoryContextNotes = notes.slice(0, 5);

	const navigateBack = () =>
		router.navigate({ to: "/$lang/caretaker", params: { lang } });

	const goBack = () => {
		if (isDirty) {
			setPendingNavigate(() => navigateBack);
			setConfirmLeaveOpen(true);
		} else {
			navigateBack();
		}
	};

	const isSuccess = !!(
		saveFeedback?.includes("sucesso") || saveFeedback?.includes("guardado")
	);
	const seniorAge = form ? form.age || calculateAge(senior?.birthDate) : "";
	const profileInitials = senior
		? initialsFromName(form?.fullName || senior.nickname || senior.fullName)
		: "";

	// ── Loading
	if (loading) {
		return (
			<div
				style={{
					height: "100%",
					width: "100%",
					background: HEADER_BG,
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
				}}
			>
				<div
					className="animate-spin"
					style={{
						width: 44,
						height: 44,
						borderRadius: "50%",
						border: "3px solid rgba(26,95,90,0.12)",
						borderTopColor: C.teal,
					}}
				/>
			</div>
		);
	}

	// ── Error
	if (!senior || !form) {
		return (
			<div
				style={{
					height: "100%",
					width: "100%",
					background: HEADER_BG,
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					padding: 24,
				}}
			>
				<div
					style={{
						...DS.glassCard,
						maxWidth: 480,
						width: "100%",
						padding: 32,
						textAlign: "center",
					}}
				>
					<h1 style={{ margin: 0, fontSize: 20, color: C.text }}>
						Não foi possível abrir este perfil.
					</h1>
					{error && (
						<p
							style={{
								marginTop: 12,
								fontSize: 14,
								lineHeight: 1.6,
								color: C.textSub,
							}}
						>
							{error}
						</p>
					)}
					<button
						type="button"
						onClick={goBack}
						style={{ ...DS.btnPrimary, marginTop: 20 }}
					>
						Voltar ao dashboard
					</button>
				</div>
			</div>
		);
	}

	const genderLabel =
		form.gender === "m" ? "Masculino" : form.gender === "f" ? "Feminino" : null;
	const handleLivingOptionChange = (option: LivingOption) => {
		if (isPresetLivingOption(option)) {
			setForm({
				...form,
				family: LIVING_STORED_VALUES[option],
				familyMode: option,
			});
			return;
		}
		if (option === "") {
			setForm({ ...form, family: "", familyMode: "" });
			return;
		}
		setForm({
			...form,
			family: form.familyMode === "outro" ? form.family : "",
			familyMode: "outro",
		});
	};

	return (
		<div
			style={{
				height: "100%",
				width: "100%",
				display: "flex",
				flexDirection: "column",
				overflow: "hidden",
			}}
		>
			{/* Note modal */}
			<AnimatePresence>
				{noteModalOpen && (
					<motion.div
						key="note-modal-backdrop"
						initial={shouldReduce ? false : { opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={shouldReduce ? undefined : { opacity: 0 }}
						transition={{ duration: 0.18 }}
						role="presentation"
						onClick={() => setNoteModalOpen(false)}
						style={{
							position: "fixed",
							inset: 0,
							zIndex: 600,
							background: "rgba(8,34,35,0.34)",
							backdropFilter: "blur(12px)",
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							padding: 20,
						}}
					>
						<motion.div
							key="note-modal-panel"
							initial={
								shouldReduce
									? false
									: { opacity: 0, y: 12, filter: "blur(4px)" }
							}
							animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
							exit={
								shouldReduce
									? undefined
									: { opacity: 0, y: -6, filter: "blur(4px)" }
							}
							transition={{ type: "spring", duration: 0.35, bounce: 0 }}
							role="dialog"
							aria-modal="true"
							onClick={(e) => e.stopPropagation()}
							style={{
								width: "min(540px, 100%)",
								background: "#fff",
								borderRadius: 20,
								border: `1px solid ${C.cardBorder}`,
								boxShadow: "0 28px 80px rgba(8,34,35,0.24)",
								padding: 20,
							}}
						>
							<div className="flex items-start justify-between gap-4">
								<div>
									<h2
										style={{
											margin: 0,
											color: C.tealDark,
											fontSize: 20,
											fontWeight: 500,
											fontFamily: SF,
										}}
									>
										{editingNote ? "Editar nota" : "Nova nota"}
									</h2>
									<p
										style={{
											margin: "4px 0 0",
											color: C.textSub,
											fontSize: 13,
											fontFamily: SF_TEXT,
										}}
									>
										Texto simples para consulta rápida.
									</p>
								</div>
								<button
									type="button"
									onClick={() => setNoteModalOpen(false)}
									style={{
										border: "none",
										borderRadius: 8,
										background: "rgba(17,75,69,0.06)",
										color: "#4f736d",
										padding: "7px 10px",
										cursor: "pointer",
										fontSize: 12,
										fontWeight: 700,
										fontFamily: SF_TEXT,
									}}
								>
									Fechar
								</button>
							</div>

							<textarea
								value={noteForm.content}
								onChange={(e) =>
									setNoteForm((prev) => ({ ...prev, content: e.target.value }))
								}
								maxLength={2000}
								placeholder="Escreve uma nota sobre este idoso..."
								// biome-ignore lint/a11y/noAutofocus: modal context
								autoFocus
								style={{
									width: "100%",
									minHeight: 130,
									resize: "vertical",
									marginTop: 16,
									border: `1px solid ${C.cardBorder}`,
									borderRadius: 13,
									background: "#FAFCFB",
									color: C.text,
									outline: "none",
									padding: 14,
									fontSize: 14,
									lineHeight: 1.5,
									fontFamily: SF_TEXT,
								}}
							/>

							<div style={{ marginTop: 14 }}>
								<p
									style={{
										margin: "0 0 8px",
										color: C.textSub,
										fontSize: 12,
										fontWeight: 700,
										fontFamily: SF_TEXT,
									}}
								>
									Categoria
								</p>
								<div className="flex items-center gap-2 flex-wrap">
									<GlowingButton
										type="button"
										glowColor={C.teal}
										selected={noteForm.category === null}
										onClick={() =>
											setNoteForm((p) => ({ ...p, category: null }))
										}
										className="h-9 !px-3 text-xs font-bold"
										style={{ fontFamily: SF_TEXT }}
									>
										Sem categoria
									</GlowingButton>
									{NOTE_CATEGORIES.map((cat) => {
										const s = CATEGORY_STYLES[cat];
										return (
											<GlowingButton
												key={cat}
												type="button"
												glowColor={s.accent}
												selected={noteForm.category === cat}
												onClick={() =>
													setNoteForm((p) => ({ ...p, category: cat }))
												}
												className="h-9 !px-3 text-xs font-bold"
												style={{ color: s.text, fontFamily: SF_TEXT }}
											>
												{cat}
											</GlowingButton>
										);
									})}
								</div>
							</div>

							<div
								className="flex items-center justify-between gap-3 flex-wrap"
								style={{ marginTop: 16 }}
							>
								<button
									type="button"
									onClick={() =>
										setNoteForm((p) => ({ ...p, pinned: !p.pinned }))
									}
									style={{
										border: `1px solid ${noteForm.pinned ? C.tealDark : C.cardBorder}`,
										borderRadius: 8,
										background: noteForm.pinned ? C.tealDark : "#fff",
										color: noteForm.pinned ? "#fff" : C.tealDark,
										padding: "9px 12px",
										cursor: "pointer",
										fontSize: 13,
										fontWeight: 700,
										fontFamily: SF_TEXT,
									}}
								>
									{noteForm.pinned ? "Nota fixada" : "Fixar no topo"}
								</button>
								<button
									type="button"
									onClick={() => void saveNoteModal()}
									disabled={savingNoteModal || !noteForm.content.trim()}
									style={{
										border: "none",
										borderRadius: 8,
										background:
											savingNoteModal || !noteForm.content.trim()
												? "rgba(17,75,69,0.12)"
												: C.teal,
										color:
											savingNoteModal || !noteForm.content.trim()
												? "#8AA29E"
												: "#fff",
										padding: "9px 16px",
										cursor:
											savingNoteModal || !noteForm.content.trim()
												? "default"
												: "pointer",
										fontSize: 13,
										fontWeight: 800,
										fontFamily: SF_TEXT,
										minWidth: 120,
									}}
								>
									{savingNoteModal ? "A guardar..." : "Guardar"}
								</button>
							</div>
						</motion.div>
					</motion.div>
				)}
			</AnimatePresence>

			{/* ── Header: full width, BG + grid ──────────────────────────────── */}
			<div
				style={{ background: HEADER_BG, position: "relative", flexShrink: 0 }}
			>
				<LoginShapeBackground />
				<div
					style={{ position: "relative", zIndex: 1 }}
					className="px-5 sm:px-10 xl:px-14"
				>
					{/* Back button row */}
					<div style={{ paddingTop: 18, paddingBottom: 0 }}>
						<button
							type="button"
							onClick={goBack}
							className="flex items-center gap-1.5 transition-opacity hover:opacity-70 active:scale-[0.97]"
							style={{
								background: "none",
								border: "none",
								padding: 0,
								cursor: "pointer",
								color: C.textSub,
								fontSize: 13,
								fontWeight: 500,
							}}
						>
							<HiArrowLeft size={14} />
							Voltar ao dashboard
						</button>
					</div>

					{/* Header main row */}
					<div className="flex flex-col gap-4 pb-7 pt-5 sm:flex-row sm:items-center sm:justify-between">
						{/* Left: photo + identity */}
						<div className="flex items-center gap-4">
							{/* Avatar */}
							<div style={{ position: "relative", flexShrink: 0 }}>
								<div
									style={{
										width: 76,
										height: 76,
										borderRadius: "50%",
										overflow: "hidden",
										border: "3px solid rgba(255,255,255,0.9)",
										boxShadow: "0 4px 20px rgba(10,74,69,0.18)",
										background:
											"linear-gradient(180deg, rgba(45,191,160,0.18) 0%, rgba(255,252,226,0.6) 100%)",
										display: "flex",
										alignItems: "center",
										justifyContent: "center",
									}}
								>
									{form.photoDataUrl ? (
										<img
											src={form.photoDataUrl}
											alt={form.fullName}
											style={{
												width: "100%",
												height: "100%",
												objectFit: "cover",
											}}
										/>
									) : profileInitials ? (
										<span
											style={{
												fontSize: 24,
												fontWeight: 700,
												color: C.tealDark,
											}}
										>
											{profileInitials}
										</span>
									) : (
										<HiMiniUserCircle
											size={40}
											style={{ color: C.tealDark, opacity: 0.45 }}
										/>
									)}
								</div>
								{/* Camera button */}
								<button
									type="button"
									onClick={() => fileInputRef.current?.click()}
									title="Alterar foto"
									className="flex items-center justify-center transition-opacity hover:opacity-80 active:scale-95"
									style={{
										position: "absolute",
										bottom: 0,
										right: -2,
										width: 26,
										height: 26,
										borderRadius: "50%",
										background: "rgba(255,255,255,0.95)",
										border: `1px solid ${C.border}`,
										boxShadow: DS.shadow.sm,
										cursor: "pointer",
										color: C.tealDark,
									}}
								>
									<HiCamera size={13} />
								</button>
								{form.photoDataUrl && (
									<button
										type="button"
										onClick={() => setForm({ ...form, photoDataUrl: null })}
										title="Remover foto"
										className="flex items-center justify-center transition-opacity hover:opacity-80 active:scale-95"
										style={{
											position: "absolute",
											bottom: 0,
											left: -2,
											width: 26,
											height: 26,
											borderRadius: "50%",
											background: "rgba(255,255,255,0.95)",
											border: `1px solid ${C.border}`,
											boxShadow: DS.shadow.sm,
											cursor: "pointer",
											color: "#b83030",
										}}
									>
										<HiTrash size={11} />
									</button>
								)}
							</div>

							{/* Name + meta */}
							<div className="flex flex-col gap-1">
								<h1
									style={{
										margin: 0,
										fontSize: "clamp(1.5rem, 3vw, 2.2rem)",
										fontWeight: 600,
										letterSpacing: "-0.03em",
										lineHeight: 1.1,
										color: C.text,
									}}
								>
									{senior.nickname}
								</h1>
								{senior.fullName !== senior.nickname && (
									<p style={{ margin: 0, fontSize: 14, color: C.textSub }}>
										{senior.fullName}
									</p>
								)}
								<div
									className="flex flex-wrap items-center gap-2"
									style={{ marginTop: 2 }}
								>
									{seniorAge && (
										<span
											style={{
												fontSize: 12,
												fontWeight: 600,
												color: C.textSub,
											}}
										>
											{seniorAge} anos
										</span>
									)}
									{seniorAge && senior.accessCode && (
										<span style={{ fontSize: 11, color: C.textMuted }}>·</span>
									)}
									{senior.accessCode && (
										<button
											type="button"
											onClick={copyAccessCode}
											className="flex items-center gap-1 transition-opacity hover:opacity-70"
											style={{
												background: "none",
												border: "none",
												padding: 0,
												cursor: "pointer",
												fontSize: 12,
												fontWeight: 600,
												color: C.textSub,
											}}
										>
											{copied ? "Copiado!" : senior.accessCode}
											<HiSquare2Stack size={12} />
										</button>
									)}
									{genderLabel && (
										<>
											<span style={{ fontSize: 11, color: C.textMuted }}>
												·
											</span>
											<span
												style={{
													fontSize: 12,
													fontWeight: 600,
													color: C.textSub,
												}}
											>
												{genderLabel}
											</span>
										</>
									)}
								</div>
							</div>
						</div>

						{/* spacer — save moved to page footer */}
						<div />
					</div>
				</div>
			</div>

			{/* Hidden file input */}
			<input
				ref={fileInputRef}
				type="file"
				accept="image/*"
				onChange={(e) => void handlePhotoSelection(e)}
				style={{ display: "none" }}
			/>

			{/* ── Body: scrollable, lighter BG ───────────────────────────────── */}
			<div style={{ flex: 1, overflowY: "auto", background: BODY_BG }}>
				<div
					className="mx-auto w-full px-5 pb-16 pt-10 sm:px-10 xl:px-14"
					style={{ maxWidth: 920 }}
				>
					{/* Perfil essencial */}
					<SectionHeader
						title="Perfil essencial"
						subtitle="Dados de base que ajudam o cuidador e dão contexto ao Compy."
					/>
					<div>
						<FormRow label="Nome completo">
							<ReadOnlyProfileValue value={form.fullName} />
						</FormRow>
						<FormRow label="Idade">
							<ReadOnlyProfileValue value={form.age} />
						</FormRow>
						<FormRow label="Com quem vive">
							<div className="flex flex-col gap-2">
								<ProfileSelect
									value={form.familyMode}
									onChange={(v) => handleLivingOptionChange(v as LivingOption)}
									options={LIVING_OPTIONS.map((o) => ({
										value: o.value,
										label: o.label,
									}))}
								/>
								{form.familyMode === "outro" && (
									<StyledInput
										value={form.family}
										onChange={(e) =>
											setForm({ ...form, family: e.target.value })
										}
										placeholder="Escrever com quem vive"
									/>
								)}
							</div>
						</FormRow>
						<FormRow label="Género" last>
							<ProfileSelect
								value={form.gender}
								onChange={(v) =>
									setForm({ ...form, gender: v as SeniorProfileForm["gender"] })
								}
								options={[
									{ value: "", label: "Não definido" },
									{ value: "m", label: "Masculino" },
									{ value: "f", label: "Feminino" },
								]}
							/>
						</FormRow>
					</div>

					<Divider />

					{/* Tab switcher */}
					<div
						className="flex items-center gap-2 flex-wrap"
						style={{ marginBottom: 32 }}
					>
						{(
							[
								["perfil", "Perfil"],
								["memoria", "Memória"],
								["notas", "Notas"],
							] as [TabId, string][]
						).map(([id, label]) => (
							<button
								key={id}
								type="button"
								onClick={() => setActiveTab(id)}
								className="transition-all active:scale-[0.97]"
								style={{
									borderRadius: DS.radius.full,
									border: activeTab === id ? "none" : `1px solid ${C.border}`,
									background:
										activeTab === id ? C.tealDark : "rgba(255,255,255,0.7)",
									color: activeTab === id ? "#fff" : C.textSub,
									padding: "9px 20px",
									fontSize: 14,
									fontWeight: 600,
									cursor: "pointer",
									transition: DS.transition.fast,
								}}
							>
								{label}
							</button>
						))}
					</div>

					{/* ── Tab: Perfil ──────────────────────────────────────────── */}
					{activeTab === "perfil" && (
						<div className="flex flex-col gap-0">
							<SectionHeader
								title="Gostos e interesses"
								subtitle="O que veio do onboarding e o que pode ser enriquecido pelo cuidador."
							/>
							<div>
								<TagEditor
									label="Hobbies"
									placeholder="Adicionar hobby (Enter)"
									values={form.likes.hobbies}
									onChange={(v) =>
										setForm({ ...form, likes: { ...form.likes, hobbies: v } })
									}
									shouldReduce={shouldReduce}
								/>
								<TagEditor
									label="Desporto / futebol"
									placeholder="Adicionar gosto desportivo"
									values={form.likes.football}
									onChange={(v) =>
										setForm({ ...form, likes: { ...form.likes, football: v } })
									}
									shouldReduce={shouldReduce}
								/>
								<TagEditor
									label="Música"
									placeholder="Adicionar gosto musical"
									values={form.likes.music}
									onChange={(v) =>
										setForm({ ...form, likes: { ...form.likes, music: v } })
									}
									shouldReduce={shouldReduce}
								/>
								<TagEditor
									label="Cinema / televisão"
									placeholder="Adicionar gosto audiovisual"
									values={form.likes.cinema}
									onChange={(v) =>
										setForm({ ...form, likes: { ...form.likes, cinema: v } })
									}
									shouldReduce={shouldReduce}
								/>
								<TagEditor
									label="Gastronomia"
									placeholder="Adicionar gosto gastronómico"
									values={form.likes.gastronomy}
									onChange={(v) =>
										setForm({
											...form,
											likes: { ...form.likes, gastronomy: v },
										})
									}
									last
									shouldReduce={shouldReduce}
								/>
							</div>

							<Divider />

							<SectionHeader
								title="Contexto clínico e sensível"
								subtitle="Informação útil para o acompanhamento e para o Compy saber o que deve evitar."
							/>
							<div>
								<TagEditor
									label="Diagnósticos"
									placeholder="Adicionar diagnóstico ou contexto"
									values={form.diagnoses}
									onChange={(v) => setForm({ ...form, diagnoses: v })}
									shouldReduce={shouldReduce}
								/>
								<TagEditor
									label="Tópicos a evitar"
									placeholder="Adicionar tópico sensível"
									values={form.avoidTopics}
									onChange={(v) => setForm({ ...form, avoidTopics: v })}
									accent="amber"
									last
									shouldReduce={shouldReduce}
								/>
							</div>
						</div>
					)}

					{/* ── Tab: Memória ─────────────────────────────────────────── */}
					{activeTab === "memoria" && (
						<div className="flex flex-col gap-0">
							<SectionHeader
								title="Adicionar contexto ao Compy"
								subtitle="Estas notas ficam associadas ao idoso e orientam melhor as conversas."
							/>
							<div>
								<FormRow label="Categoria">
									<ProfileSelect
										value={draftContextCategory ?? ""}
										onChange={(v) =>
											setDraftContextCategory(
												v ? (v as CaregiverNoteCategory) : null,
											)
										}
										options={[
											{ value: "", label: "Sem categoria" },
											...NOTE_CATEGORIES.map((cat) => ({
												value: cat,
												label: cat,
											})),
										]}
									/>
								</FormRow>
								<FormRow label="Nova nota" last>
									<div className="flex flex-col gap-2">
										<StyledTextArea
											value={draftContext}
											onChange={(e) => setDraftContext(e.target.value)}
											placeholder="Ex.: Fica mais à vontade quando se fala da aldeia e das vindimas."
										/>
										<div className="flex justify-end">
											<button
												type="button"
												onClick={() => void saveContext()}
												disabled={savingContext || !draftContext.trim()}
												className="flex items-center gap-2 transition-opacity hover:opacity-85 active:scale-[0.97]"
												style={{
													...DS.btnPrimary,
													background: C.teal,
													padding: "10px 18px",
													fontSize: 13,
													opacity:
														savingContext || !draftContext.trim() ? 0.5 : 1,
													cursor:
														savingContext || !draftContext.trim()
															? "default"
															: "pointer",
												}}
											>
												<HiCheck size={15} />
												{savingContext ? "A guardar..." : "Guardar contexto"}
											</button>
										</div>
									</div>
								</FormRow>
							</div>

							{memoryContextNotes.length > 0 && (
								<div style={{ marginTop: 20 }}>
									<div
										className="flex items-center justify-between gap-3"
										style={{ marginBottom: 10 }}
									>
										<p
											style={{
												margin: 0,
												fontSize: 12,
												fontWeight: 800,
												letterSpacing: "0.5px",
												color: C.tealDark,
												textTransform: "uppercase",
												fontFamily: SF_TEXT,
											}}
										>
											Contexto já guardado
										</p>
										<span
											style={{
												fontSize: 12,
												color: C.textSub,
												fontFamily: SF_TEXT,
											}}
										>
											{memoryContextNotes.length}
										</span>
									</div>
									<div className="grid gap-3 md:grid-cols-2">
										{memoryContextNotes.map((note) => {
											const categoryStyle = note.category
												? CATEGORY_STYLES[note.category]
												: null;
											return (
												<div
													key={note.id}
													style={{
														padding: "14px 16px",
														borderRadius: DS.radius.lg,
														border: `1px solid ${categoryStyle?.border ?? C.border}`,
														background: categoryStyle?.bg ?? C.surface,
														display: "flex",
														flexDirection: "column",
														gap: 8,
													}}
												>
													<div className="flex items-center gap-2">
														<HiOutlineSparkles
															size={14}
															style={{
																color: categoryStyle?.accent ?? C.teal,
																flexShrink: 0,
															}}
														/>
														<span
															style={{
																fontSize: 11,
																fontWeight: 800,
																letterSpacing: "0.05em",
																textTransform: "uppercase",
																color: categoryStyle?.text ?? C.chipText,
															}}
														>
															{note.category ?? "Contexto Compy"}
														</span>
														<span
															style={{
																marginLeft: "auto",
																fontSize: 12,
																color: C.textMuted,
																flexShrink: 0,
															}}
														>
															{formatNoteDate(note.createdAt)}
														</span>
													</div>
													<p
														style={{
															margin: 0,
															fontSize: 14,
															lineHeight: 1.65,
															color: C.text,
														}}
													>
														{note.content}
													</p>
												</div>
											);
										})}
									</div>
								</div>
							)}

							<Divider />

							<SectionHeader
								title="O que o Compy já aprendeu"
								subtitle="Memórias extraídas das conversas que ajudam o assistente ao longo do tempo."
							/>
							{senior.memories.length === 0 ? (
								<EmptyState message="Ainda não existem memórias guardadas a partir das conversas." />
							) : (
								<div className="grid gap-3 md:grid-cols-2">
									{senior.memories.map((memory) => (
										<div
											key={memory.id}
											style={{
												padding: "14px 16px",
												borderRadius: DS.radius.lg,
												border: `1px solid ${C.border}`,
												background: C.surface,
												display: "flex",
												flexDirection: "column",
												gap: 8,
											}}
										>
											<div className="flex items-center gap-2">
												<HiOutlineSparkles
													size={14}
													style={{ color: C.teal, flexShrink: 0 }}
												/>
												<span
													style={{
														fontSize: 11,
														fontWeight: 700,
														letterSpacing: "0.05em",
														textTransform: "uppercase",
														color: C.chipText,
													}}
												>
													Aprendido pelo Compy
												</span>
												<span
													style={{
														marginLeft: "auto",
														fontSize: 12,
														color: C.textMuted,
														flexShrink: 0,
													}}
												>
													{formatDateTime(memory.createdAt)}
												</span>
											</div>
											<p
												style={{
													margin: 0,
													fontSize: 14,
													lineHeight: 1.65,
													color: C.text,
												}}
											>
												{memory.content}
											</p>
										</div>
									))}
								</div>
							)}
						</div>
					)}

					{/* ── Tab: Notas ───────────────────────────────────────────── */}
					{activeTab === "notas" && (
						<div>
							{/* Notes header */}
							<div
								className="flex items-center justify-between gap-4 flex-wrap"
								style={{ marginBottom: 18 }}
							>
								<SectionHeader
									title="Notas do cuidador"
									subtitle="Histórico de notas e contexto registado sobre este idoso."
								/>
								<button
									type="button"
									onClick={openCreateModal}
									style={{
										border: "none",
										borderRadius: 999,
										background: C.tealDark,
										color: "#fff",
										padding: "10px 16px",
										cursor: "pointer",
										fontSize: 13,
										fontWeight: 800,
										fontFamily: SF_TEXT,
										boxShadow: "0 10px 24px rgba(10,74,69,0.16)",
										whiteSpace: "nowrap",
										flexShrink: 0,
									}}
									className="transition-opacity hover:opacity-90 active:scale-[0.97]"
								>
									+ Nova Nota
								</button>
							</div>

							{/* Search + filter */}
							<div
								className="flex items-center gap-3 flex-wrap"
								style={{
									background: "rgba(255,255,255,0.74)",
									border: `1px solid ${C.cardBorder}`,
									borderRadius: 18,
									padding: 12,
									marginBottom: 16,
								}}
							>
								<input
									value={search}
									onChange={(e) => setSearch(e.target.value)}
									placeholder="Pesquisar notas..."
									style={{
										minWidth: "min(200px, 80vw)",
										flex: "1 1 220px",
										height: 40,
										border: `1px solid ${C.cardBorder}`,
										borderRadius: 10,
										background: "#fff",
										color: C.text,
										outline: "none",
										padding: "0 13px",
										fontSize: 13,
										fontFamily: SF_TEXT,
									}}
								/>
								<div className="flex items-center gap-2 flex-wrap">
									<GlowingButton
										type="button"
										glowColor={C.teal}
										selected={categoryFilter === null}
										onClick={() => setCategoryFilter(null)}
										className="h-9 !px-3 text-[11px] font-bold"
										style={{ color: C.tealDark, fontFamily: SF_TEXT }}
									>
										Todas
									</GlowingButton>
									{NOTE_CATEGORIES.map((cat) => {
										const s = CATEGORY_STYLES[cat];
										return (
											<GlowingButton
												key={cat}
												type="button"
												glowColor={s.accent}
												selected={categoryFilter === cat}
												onClick={() =>
													setCategoryFilter((prev) =>
														prev === cat ? null : cat,
													)
												}
												className="h-9 !px-3 text-[11px] font-bold"
												style={{ color: s.text, fontFamily: SF_TEXT }}
											>
												{cat}
											</GlowingButton>
										);
									})}
								</div>
							</div>

							{/* Pinned notes */}
							{pinnedNotes.length > 0 && (
								<div style={{ marginBottom: 16 }}>
									<div
										className="flex items-center justify-between gap-3"
										style={{ marginBottom: 8 }}
									>
										<p
											style={{
												margin: 0,
												fontSize: 12,
												fontWeight: 800,
												letterSpacing: "0.5px",
												color: C.tealDark,
												textTransform: "uppercase",
												fontFamily: SF_TEXT,
											}}
										>
											Notas fixadas
										</p>
										<span
											style={{
												fontSize: 12,
												color: C.textSub,
												fontFamily: SF_TEXT,
											}}
										>
											{pinnedNotes.length}
										</span>
									</div>
									<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
										{pinnedNotes.map((note) => (
											<NoteCard
												key={note.id}
												note={note}
												onEdit={openEditModal}
												onDelete={(n) => void deleteNote(n)}
												onTogglePinned={(n) => void togglePinned(n)}
												busy={busyNoteId === note.id}
											/>
										))}
									</div>
								</div>
							)}

							{/* Regular notes */}
							<div>
								<div
									className="flex items-center justify-between gap-3"
									style={{ marginBottom: 8 }}
								>
									<p
										style={{
											margin: 0,
											fontSize: 12,
											fontWeight: 800,
											letterSpacing: "0.5px",
											color: C.tealDark,
											textTransform: "uppercase",
											fontFamily: SF_TEXT,
										}}
									>
										Notas livres
									</p>
									<span
										style={{
											fontSize: 12,
											color: C.textSub,
											fontFamily: SF_TEXT,
										}}
									>
										{regularNotes.length}
									</span>
								</div>
								{filteredNotes.length === 0 ? (
									<EmptyState message="Ainda não há notas para estes filtros." />
								) : regularNotes.length > 0 ? (
									<div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
										{regularNotes.map((note) => (
											<NoteCard
												key={note.id}
												note={note}
												onEdit={openEditModal}
												onDelete={(n) => void deleteNote(n)}
												onTogglePinned={(n) => void togglePinned(n)}
												busy={busyNoteId === note.id}
											/>
										))}
									</div>
								) : (
									<EmptyState message="Só há notas fixadas nestes filtros." />
								)}
							</div>
						</div>
					)}

					{/* ── Save footer (profile fields only) ─────────────────────── */}
					{activeTab !== "notas" && (
						<div
							style={{
								marginTop: 48,
								paddingTop: 24,
								borderTop: `1px solid ${C.divider}`,
								display: "flex",
								flexDirection: "column",
								gap: 12,
							}}
						>
							<AnimatePresence>
								{saveFeedback && (
									<motion.div
										key="save-feedback"
										initial={
											shouldReduce
												? false
												: { opacity: 0, y: 6, filter: "blur(4px)" }
										}
										animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
										exit={
											shouldReduce
												? undefined
												: { opacity: 0, filter: "blur(4px)" }
										}
										transition={{ type: "spring", duration: 0.28, bounce: 0 }}
										style={{
											borderRadius: DS.radius.lg,
											padding: "10px 14px",
											fontSize: 13,
											background: isSuccess ? C.chip : C.alertBg,
											color: isSuccess ? C.chipText : C.alert,
											border: `1px solid ${isSuccess ? "rgba(45,191,160,0.22)" : C.alertBorder}`,
										}}
									>
										{saveFeedback}
									</motion.div>
								)}
							</AnimatePresence>
							<div className="flex items-center justify-end gap-3">
								<button
									type="button"
									onClick={goBack}
									className="transition-opacity hover:opacity-70 active:scale-[0.97]"
									style={{ ...DS.btnGhost }}
								>
									Cancelar
								</button>
								<button
									type="button"
									onClick={() => void saveProfile()}
									disabled={saving}
									className="flex items-center gap-2 transition-opacity hover:opacity-90 active:scale-[0.97]"
									style={{
										...DS.btnPrimary,
										background: C.tealDark,
										opacity: saving ? 0.7 : 1,
										cursor: saving ? "default" : "pointer",
									}}
								>
									<HiCheck size={15} />
									{saving ? "A guardar..." : "Guardar alterações"}
								</button>
							</div>
						</div>
					)}
				</div>
			</div>

			{/* ── Unsaved changes dialog ─────────────────────────────────────── */}
			<AnimatePresence>
				{confirmLeaveOpen && (
					<motion.div
						key="confirm-leave-backdrop"
						initial={shouldReduce ? false : { opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={shouldReduce ? undefined : { opacity: 0 }}
						transition={{ duration: 0.15 }}
						role="presentation"
						onClick={() => setConfirmLeaveOpen(false)}
						style={{
							position: "fixed",
							inset: 0,
							zIndex: 700,
							background: "rgba(8,34,35,0.38)",
							backdropFilter: "blur(10px)",
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							padding: 20,
						}}
					>
						<motion.div
							key="confirm-leave-panel"
							initial={
								shouldReduce
									? false
									: { opacity: 0, y: 10, filter: "blur(4px)" }
							}
							animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
							exit={
								shouldReduce
									? undefined
									: { opacity: 0, y: 6, filter: "blur(4px)" }
							}
							transition={{ type: "spring", duration: 0.3, bounce: 0 }}
							role="dialog"
							aria-modal="true"
							onClick={(e) => e.stopPropagation()}
							style={{
								width: "min(440px, 100%)",
								background: "#fff",
								borderRadius: 20,
								border: `1px solid ${C.cardBorder}`,
								boxShadow: "0 28px 80px rgba(8,34,35,0.22)",
								padding: "28px 24px",
							}}
						>
							<h2
								style={{
									margin: 0,
									fontSize: 18,
									fontWeight: 600,
									color: C.text,
									fontFamily: SF,
									letterSpacing: "-0.02em",
								}}
							>
								Alterações não guardadas
							</h2>
							<p
								style={{
									margin: "10px 0 0",
									fontSize: 14,
									lineHeight: 1.6,
									color: C.textSub,
									fontFamily: SF_TEXT,
								}}
							>
								Tens alterações no perfil que ainda não foram guardadas. O que
								pretendes fazer?
							</p>
							<div
								className="flex items-center justify-end gap-3 flex-wrap"
								style={{ marginTop: 24 }}
							>
								<button
									type="button"
									onClick={() => {
										setConfirmLeaveOpen(false);
										pendingNavigate?.();
										setPendingNavigate(null);
									}}
									className="transition-opacity hover:opacity-70 active:scale-[0.97]"
									style={{ ...DS.btnGhost, color: "#7a3535" }}
								>
									Sair sem guardar
								</button>
								<button
									type="button"
									onClick={async () => {
										setConfirmLeaveOpen(false);
										await saveProfile();
										pendingNavigate?.();
										setPendingNavigate(null);
									}}
									className="flex items-center gap-2 transition-opacity hover:opacity-90 active:scale-[0.97]"
									style={{ ...DS.btnPrimary, background: C.tealDark }}
								>
									<HiCheck size={15} />
									Guardar e sair
								</button>
							</div>
						</motion.div>
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	);
}
