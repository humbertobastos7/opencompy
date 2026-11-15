import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useState } from "react";
import { DS } from "@/frontend/designSystem";
import { termsOfService } from "@/frontend/assets/i18n/pt/termsOfService";
import {
	unlockAudioForIOS,
	useOnboardingVoicePrompt,
} from "./useOnboardingVoicePrompt";

type LivingWith = "sozinho" | "familia" | "lar";
const MOTION_EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

export type OnboardingAnswers = {
	nickname: string;
	livingWith: LivingWith | null;
	hobbies: string[];
	context?: string;
};

const LIVING_OPTIONS: { value: LivingWith; emoji: string; label: string }[] = [
	{ value: "sozinho", emoji: "🏠", label: "Sozinho" },
	{ value: "familia", emoji: "👨‍👩‍👦", label: "Com família" },
	{ value: "lar", emoji: "🏢", label: "Num lar" },
];

const HOBBY_OPTIONS = [
	{ id: "jardim", emoji: "🌱", label: "Jardim" },
	{ id: "televisao", emoji: "📺", label: "Televisão" },
	{ id: "leitura", emoji: "📚", label: "Leitura" },
	{ id: "musica", emoji: "🎵", label: "Música" },
	{ id: "cozinha", emoji: "🍳", label: "Cozinha" },
	{ id: "familia", emoji: "👨‍👩‍👧", label: "Família" },
	{ id: "desporto", emoji: "⚽", label: "Desporto" },
	{ id: "jogos", emoji: "🧩", label: "Jogos" },
] as const;

type HobbyId = (typeof HOBBY_OPTIONS)[number]["id"];

const buildStepAudioText = (step: number, gender?: "f" | "m" | null) => {
	const f = gender === "f";
	switch (step) {
		case 0:
			return `Como prefere que lhe chamem? O Compy vai chamá-${f ? "la" : "lo"} assim.`;
		case 1:
			return "Com quem vive?";
		case 2:
			return "Do que gosta de falar? Pode selecionar vários!";
		case 3:
			return `Quer deixar algum contexto ao Compy? Isto ajuda-me a conhecê-${f ? "la" : "lo"} melhor!`;
		default:
			return null;
	}
};

const HOBBY_ICON_ANIMATIONS: Record<
	HobbyId,
	{ rotate?: number[]; y?: number[]; x?: number[]; scale?: number[] }
> = {
	jardim: {
		rotate: [0, -10, 7, -4, 0],
		y: [0, -5, 0, -2, 0],
		scale: [1, 1.06, 0.98, 1.03, 1],
	},
	televisao: {
		rotate: [0, -2, 2, -1, 0],
		scale: [1, 1.05, 0.99, 1.02, 1],
		x: [0, -1, 1, -1, 0],
	},
	leitura: {
		rotate: [0, -8, 6, -3, 0],
		y: [0, -3, 0, -1, 0],
		scale: [1, 1.04, 0.99, 1.02, 1],
	},
	musica: {
		rotate: [0, -10, 8, -6, 0],
		y: [0, -6, 0, -3, 0],
		scale: [1, 1.08, 0.98, 1.04, 1],
	},
	cozinha: {
		rotate: [0, -12, 10, -6, 0],
		y: [0, -4, 0, -2, 0],
		scale: [1, 1.06, 0.98, 1.03, 1],
	},
	familia: {
		scale: [1, 1.12, 0.98, 1.05, 1],
		y: [0, -4, 0, -2, 0],
	},
	desporto: {
		rotate: [0, 12, -10, 6, 0],
		y: [0, -8, 0, -4, 0],
		scale: [1, 1.1, 0.97, 1.04, 1],
	},
	jogos: {
		rotate: [0, -10, 10, -6, 0],
		scale: [1, 1.08, 0.97, 1.03, 1],
		y: [0, -4, 0, -2, 0],
	},
};

interface SelectCardProps {
	emoji?: string;
	imageSrc?: string;
	label: string;
	selected: boolean;
	onClick: () => void;
	shouldReduceMotion: boolean;
}

const SelectCard: React.FC<SelectCardProps> = ({
	emoji,
	imageSrc,
	label,
	selected,
	onClick,
	shouldReduceMotion,
}) => (
	<motion.button
		type="button"
		onClick={onClick}
		whileTap={shouldReduceMotion ? undefined : { scale: 0.985 }}
		style={{
			display: "flex",
			alignItems: "center",
			gap: DS.space.lg,
			padding: "20px 24px",
			width: "100%",
			borderRadius: DS.radius.lg,
			border: selected
				? `2px solid ${DS.C.teal400}`
				: "2px solid rgba(255,255,255,0.7)",
			background: selected ? "rgba(31,181,181,0.12)" : "rgba(255,255,255,0.88)",
			backdropFilter: "blur(12px)",
			WebkitBackdropFilter: "blur(12px)",
			boxShadow: selected
				? `0 0 0 3px rgba(31,181,181,0.25), ${DS.shadow.md}`
				: DS.shadow.sm,
			cursor: "pointer",
			transition: DS.transition.fast,
			fontSize: "1.26rem",
			fontWeight: 500,
			color: DS.C.teal700,
			textAlign: "left",
		}}
	>
		{imageSrc ? (
			<motion.div
				animate={
					selected && !shouldReduceMotion
						? { scale: [1, 1.04, 1], y: [0, -2, 0] }
						: { scale: 1, y: 0 }
				}
				transition={{ duration: 0.34, ease: MOTION_EASE }}
				style={{
					width: 68,
					height: 68,
					borderRadius: 24,
					background: selected
						? "linear-gradient(180deg, rgba(31,181,181,0.16), rgba(31,181,181,0.08))"
						: "linear-gradient(180deg, rgba(255,255,255,0.92), rgba(240,251,250,0.82))",
					boxShadow: selected
						? "0 12px 24px rgba(13,138,138,0.12)"
						: "0 8px 18px rgba(13,138,138,0.06)",
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					flexShrink: 0,
					overflow: "hidden",
				}}
			>
				<img
					src={imageSrc}
					alt={label}
					style={{
						width: "100%",
						height: "100%",
						objectFit: "contain",
						transform: "scale(1.12)",
					}}
				/>
			</motion.div>
		) : (
			<span className="noto-emoji" style={{ fontSize: "2rem", lineHeight: 1 }}>
				{emoji}
			</span>
		)}
		{label}
	</motion.button>
);

interface HobbyTileProps {
	id: HobbyId;
	emoji: string;
	label: string;
	selected: boolean;
	onClick: () => void;
	shouldReduceMotion: boolean;
	animationTick: number;
}

const HobbyTile: React.FC<HobbyTileProps> = ({
	id,
	emoji,
	label,
	selected,
	onClick,
	shouldReduceMotion,
	animationTick,
}) => (
	<motion.button
		type="button"
		onClick={onClick}
		whileTap={shouldReduceMotion ? undefined : { scale: 0.97 }}
		style={{
			display: "flex",
			flexDirection: "column",
			alignItems: "center",
			justifyContent: "center",
			padding: "16px 8px",
			gap: 8,
			borderRadius: DS.radius.lg,
			border: selected
				? `2px solid ${DS.C.teal400}`
				: "2px solid rgba(255,255,255,0.7)",
			background: selected ? "rgba(31,181,181,0.12)" : "rgba(255,255,255,0.88)",
			backdropFilter: "blur(12px)",
			WebkitBackdropFilter: "blur(12px)",
			boxShadow: selected
				? `0 0 0 2px rgba(31,181,181,0.25), ${DS.shadow.sm}`
				: DS.shadow.sm,
			cursor: "pointer",
			transition: DS.transition.fast,
			fontSize: "0.92rem",
			fontWeight: 500,
			color: DS.C.teal700,
			minHeight: 88,
		}}
	>
		<motion.span
			key={`${id}-${animationTick}`}
			className="noto-emoji"
			initial={
				shouldReduceMotion ? false : { scale: 0.92, rotate: 0, x: 0, y: 0 }
			}
			animate={
				shouldReduceMotion
					? { scale: 1, rotate: 0, x: 0, y: 0 }
					: HOBBY_ICON_ANIMATIONS[id]
			}
			transition={{
				duration: 0.56,
				ease: MOTION_EASE,
				times: [0, 0.28, 0.58, 0.82, 1],
			}}
			style={{
				fontSize: "2rem",
				lineHeight: 1,
				display: "inline-flex",
				transformOrigin: "50% 60%",
				filter: selected
					? "drop-shadow(0 6px 14px rgba(13,138,138,0.14))"
					: "none",
			}}
		>
			{emoji}
		</motion.span>
		{label}
	</motion.button>
);

interface Props {
	initialNickname: string;
	gender?: "f" | "m" | null;
	birthDate?: string | null;
	onComplete: (answers: OnboardingAnswers) => void;
	submitting?: boolean;
}

function computeAgeFromBirthDate(birthDate?: string | null): number | null {
	if (!birthDate) return null;
	const birth = new Date(birthDate);
	if (Number.isNaN(birth.getTime())) return null;
	const today = new Date();
	let age = today.getFullYear() - birth.getFullYear();
	const monthDiff = today.getMonth() - birth.getMonth();
	if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
		age -= 1;
	}
	return age >= 0 ? age : null;
}

export const OnboardingQuestions: React.FC<Props> = ({
	initialNickname,
	gender,
	birthDate,
	onComplete,
	submitting = false,
}) => {
	const f = gender === "f";
	const contextualArticle = f ? "A" : "O";
	const contextualAge = computeAgeFromBirthDate(birthDate) ?? 81;
	const livingOptions = LIVING_OPTIONS.map((option) =>
		option.value === "sozinho"
			? { ...option, label: f ? "Sozinha" : "Sozinho" }
			: option,
	);
	const [step, setStep] = useState(0);
	const [direction, setDirection] = useState(1);
	const shouldReduceMotion = useReducedMotion() ?? false;
	const audioDone = useOnboardingVoicePrompt(buildStepAudioText(step, gender));

	const [nickname, setNickname] = useState(initialNickname);
	const [livingWith, setLivingWith] = useState<LivingWith | null>(null);
	const [hobbies, setHobbies] = useState<HobbyId[]>([]);
	const [context, setContext] = useState("");
	const [hobbyAnimationTicks, setHobbyAnimationTicks] = useState<
		Partial<Record<HobbyId, number>>
	>({});

	const goNext = () => {
		if (!canProceed) return;
		unlockAudioForIOS();
		if (step === 4) {
			onComplete({ nickname, livingWith, hobbies, context });
			return;
		}
		setDirection(1);
		setStep((s) => s + 1);
	};

	const goBack = () => {
		unlockAudioForIOS();
		setDirection(-1);
		setStep((s) => s - 1);
	};

	const toggleHobby = (id: HobbyId) => {
		setHobbyAnimationTicks((prev) => ({
			...prev,
			[id]: (prev[id] ?? 0) + 1,
		}));
		setHobbies((prev) =>
			prev.includes(id) ? prev.filter((h) => h !== id) : [...prev, id],
		);
	};

	const canProceedBase =
		step === 0
			? nickname.trim().length > 0
			: step === 1
				? livingWith !== null
				: true;
	const canProceed = canProceedBase && !submitting;

	const stepContent = [
		/* Q1 - Nickname */
		<div
			key="q1"
			style={{
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				gap: DS.space.lg,
				width: "100%",
			}}
		>
			<p
				style={{
					fontSize: "clamp(1.5rem, 3.7vw, 1.98rem)",
					fontWeight: 300,
					color: DS.C.teal700,
					textAlign: "center",
					margin: 0,
					lineHeight: 1.4,
				}}
			>
				Como prefere que lhe chamem?
			</p>
			<p
				style={{
					fontSize: "1.05rem",
					color: DS.C.textMuted,
					margin: 0,
					marginTop: -DS.space.xs,
				}}
			>
				{f ? "O Compy vai chamá-la assim" : "O Compy vai chamá-lo assim"}{" "}
				<img
					src="/avatar/compy.png"
					alt=""
					style={{
						width: "1.7rem",
						height: "1.7rem",
						objectFit: "contain",
						display: "inline-block",
						verticalAlign: "middle",
					}}
				/>
			</p>
			<input
				type="text"
				value={nickname}
				onChange={(e) => setNickname(e.target.value)}
				style={{
					...DS.formInput,
					fontSize: "1.58rem",
					textAlign: "center",
					padding: "20px 24px",
					maxWidth: 320,
					fontWeight: 400,
					color: DS.C.teal700,
					borderColor: "rgba(31,181,181,0.35)",
				}}
				autoFocus
			/>
		</div>,

		/* Q2 - Living with */
		<div
			key="q2"
			style={{
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				gap: DS.space.lg,
				width: "100%",
			}}
		>
			<p
				style={{
					fontSize: "clamp(1.5rem, 3.7vw, 1.98rem)",
					fontWeight: 300,
					color: DS.C.teal700,
					textAlign: "center",
					margin: 0,
					lineHeight: 1.4,
				}}
			>
				Com quem vive?
			</p>
			<div
				style={{
					display: "flex",
					flexDirection: "column",
					gap: DS.space.md,
					width: "100%",
					maxWidth: 380,
				}}
			>
				{livingOptions.map((opt) => (
					<SelectCard
						key={opt.value}
						emoji={opt.emoji}
						label={opt.label}
						selected={livingWith === opt.value}
						onClick={() => setLivingWith(opt.value)}
						shouldReduceMotion={shouldReduceMotion}
					/>
				))}
			</div>
		</div>,

		/* Q3 - Hobbies */
		<div
			key="q3"
			style={{
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				gap: DS.space.lg,
				width: "100%",
			}}
		>
			<p
				style={{
					fontSize: "clamp(1.5rem, 3.7vw, 1.98rem)",
					fontWeight: 300,
					color: DS.C.teal700,
					textAlign: "center",
					margin: 0,
					lineHeight: 1.4,
				}}
			>
				Do que gosta de falar?
			</p>
			<p
				style={{
					fontSize: "1rem",
					color: DS.C.textMuted,
					margin: 0,
					marginTop: -DS.space.xs,
				}}
			>
				Pode selecionar vários!
			</p>
			<div
				style={{
					display: "grid",
					gridTemplateColumns: "repeat(4, 1fr)",
					gap: DS.space.sm,
					width: "100%",
					maxWidth: 420,
				}}
			>
				{HOBBY_OPTIONS.map((opt) => (
					<HobbyTile
						key={opt.id}
						id={opt.id}
						emoji={opt.emoji}
						label={opt.label}
						selected={hobbies.includes(opt.id)}
						onClick={() => toggleHobby(opt.id)}
						shouldReduceMotion={shouldReduceMotion}
						animationTick={hobbyAnimationTicks[opt.id] ?? 0}
					/>
				))}
			</div>
		</div>,

		/* Q4 - Context */
		<div
			key="q4"
			style={{
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				gap: DS.space.lg,
				width: "100%",
			}}
		>
			<p
				style={{
					fontSize: "clamp(1.5rem, 3.7vw, 1.98rem)",
					fontWeight: 300,
					color: DS.C.teal700,
					textAlign: "center",
					margin: 0,
					lineHeight: 1.4,
				}}
			>
				Quer deixar algum
				<br />
				<strong style={{ fontWeight: 700 }}>contexto</strong> ao Compy?
			</p>
			<p
				style={{
					fontSize: "1rem",
					color: DS.C.textMuted,
					margin: 0,
					marginTop: -DS.space.xs,
					textAlign: "center",
				}}
			>
				Isto ajuda-me
				<br />
				{f ? "a conhecê-la melhor!" : "a conhecê-lo melhor!"}
			</p>
			<div
				style={{
					position: "relative",
					width: "100%",
					maxWidth: 420,
				}}
			>
				{!context.trim() && (
					<div
						aria-hidden="true"
						style={{
							position: "absolute",
							top: 17,
							left: 20,
							right: 20,
							fontSize: "0.82rem",
							fontStyle: "italic",
							color: "rgba(15,106,98,0.62)",
							lineHeight: 1.55,
							pointerEvents: "none",
							whiteSpace: "pre-wrap",
						}}
					>
						{`Ex.: ${contextualArticle} ${nickname.trim() || "nome"} tem ${contextualAge} anos, sofre de Alzheimer em fase inicial e hipertensão, e toma Aricept às 8h e Ramipril ao almoço. Gosta de falar sobre a família, receitas de cozinha e novelas, e não gosta de falar sobre a morte do marido ou assuntos de dinheiro. Comunica melhor quando as frases são curtas, o tom é calmo e lhe dão tempo para responder sem pressa.`}
					</div>
				)}
				<textarea
					value={context}
					onChange={(e) => setContext(e.target.value)}
					placeholder=""
					rows={4}
					style={{
						...DS.formInput,
						fontSize: "1.05rem",
						padding: "16px 20px",
						maxWidth: 420,
						width: "100%",
						minHeight: "clamp(160px, 28vh, 272px)",
						resize: "vertical",
						borderColor: "rgba(31,181,181,0.35)",
						fontFamily: "inherit",
						lineHeight: "1.6",
						background: "transparent",
						position: "relative",
						zIndex: 1,
					}}
				/>
			</div>
		</div>,

		/* Q5 - Terms */
		<div
			key="q5"
			style={{
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				gap: DS.space.lg,
				width: "100%",
			}}
		>
			<p
				style={{
					fontSize: "clamp(1.5rem, 3.7vw, 1.98rem)",
					fontWeight: 300,
					color: DS.C.teal700,
					textAlign: "center",
					margin: 0,
					lineHeight: 1.4,
				}}
			>
				{termsOfService.title}
			</p>
			<div
				style={{
					width: "100%",
					maxWidth: 480,
					maxHeight: "clamp(180px, 32vh, 380px)",
					overflowY: "auto",
					borderRadius: 18,
					border: "1px solid rgba(10,74,69,0.14)",
					background:
						"linear-gradient(180deg, rgba(255,252,226,0.42) 0%, rgba(240,251,250,0.34) 46%, rgba(185,235,220,0.28) 100%)",
					boxShadow:
						"0 16px 38px rgba(10,74,69,0.09), inset 0 1px 0 rgba(255,255,255,0.42)",
					backdropFilter: "blur(10px)",
					WebkitBackdropFilter: "blur(10px)",
					padding: "22px 18px",
					fontSize: "0.98rem",
					lineHeight: 1.85,
					color: DS.C.teal700,
					whiteSpace: "pre-wrap",
					textAlign: "left",
				}}
			>
				{termsOfService.content}
			</div>
		</div>,
	];

	return (
		<div
			style={{
				display: "flex",
				flexDirection: "column",
				height: "100%",
				maxWidth: 520,
				margin: "0 auto",
				width: "100%",
				paddingTop: DS.space.xl,
				paddingLeft: DS.space.lg,
				paddingRight: DS.space.lg,
				paddingBottom: `calc(clamp(64px, 15vh, 110px) + var(--sab, 0px))`,
			}}
		>
			{/* Progress dots */}
			<div
				style={{
					display: "flex",
					justifyContent: "center",
					alignItems: "center",
					gap: DS.space.xs,
					marginBottom: "clamp(20px, 5vh, 48px)",
					flexShrink: 0,
				}}
			>
				{[0, 1, 2, 3, 4].map((i) => (
					<div
						key={i}
						style={{
							width: i === step ? 28 : 8,
							height: 8,
							borderRadius: DS.radius.full,
							background:
								i < step
									? DS.C.teal500
									: i === step
										? DS.C.teal400
										: "rgba(31,181,181,0.22)",
							transition: "all 350ms cubic-bezier(0.34, 1.56, 0.64, 1)",
						}}
					/>
				))}
			</div>

			{/* Question */}
			<div
				style={{
					flex: 1,
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					overflow: "hidden",
					minHeight: 0,
				}}
			>
				<AnimatePresence mode="wait" custom={direction}>
					<motion.div
						key={step}
						custom={direction}
						initial={
							shouldReduceMotion
								? false
								: { opacity: 0, x: direction * 44, filter: "blur(6px)" }
						}
						animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
						exit={
							shouldReduceMotion
								? { opacity: 0 }
								: {
										opacity: 0,
										x: direction * -44,
										filter: "blur(6px)",
									}
						}
						transition={{ type: "spring", duration: 0.45, bounce: 0 }}
						style={{
							width: "100%",
							display: "flex",
							justifyContent: "center",
						}}
					>
						{stepContent[step]}
					</motion.div>
				</AnimatePresence>
			</div>

			{/* Navigation */}
			<div
				style={{
					display: "flex",
					gap: DS.space.md,
					paddingTop: DS.space.lg,
					flexShrink: 0,
				}}
			>
				{step > 0 && (
					<button
						type="button"
						onClick={goBack}
						style={{
							...DS.btnGhost,
							flex: 1,
							fontSize: "1.1rem",
							minHeight: 58,
							borderRadius: DS.radius.full,
						}}
					>
						Voltar
					</button>
				)}
				<button
					type="button"
					onClick={goNext}
					disabled={!canProceed}
					style={{
						...DS.btnPrimary,
						backgroundColor: canProceed ? DS.C.teal500 : "#a9b8b6",
						flex: step > 0 ? 2 : 1,
						fontSize: "1.15rem",
						minHeight: 58,
						borderRadius: DS.radius.full,
						opacity: 1,
						transition: DS.transition.fast,
						letterSpacing: "0.01em",
						cursor: canProceed ? "pointer" : "default",
						boxShadow: canProceed ? DS.shadow.sm : "none",
					}}
				>
					{step === 4 && submitting
						? "A guardar..."
						: step === 4
							? "Aceitar e começar"
							: "Avançar"}
				</button>
			</div>
		</div>
	);
};
