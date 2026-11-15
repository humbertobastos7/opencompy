import { motion, useReducedMotion } from "framer-motion";
import { useState } from "react";
import { DS } from "@/frontend/designSystem";
import {
	unlockAudioForIOS,
	useOnboardingVoicePrompt,
} from "./useOnboardingVoicePrompt";

type SlideTextPart = {
	text: string;
	strong?: boolean;
};

type SlideLine = {
	id: string;
	parts: SlideTextPart[];
	slides: number[];
};

const buildSlideLines = (
	firstName: string,
	gender: "f" | "m" | null,
): SlideLine[] => {
	const f = gender === "f";
	return [
		{
			id: "greeting",
			parts: [{ text: `Olá ${firstName},` }],
			slides: [0],
		},
		{
			id: "welcome",
			parts: [{ text: f ? "Que bom tê-la aqui!" : "Que bom tê-lo aqui!" }],
			slides: [0],
		},
		{
			id: "compy",
			parts: [
				{ text: "Sou o " },
				{ text: "Compy", strong: true },
				{ text: "." },
			],
			slides: [0, 1],
		},
		{
			id: "companion",
			parts: [
				{ text: "O seu " },
				{ text: "companheiro", strong: true },
				{ text: " de todos os dias" },
			],
			slides: [1],
		},
		{
			id: "here1",
			parts: [
				{ text: "Estou aqui para " },
				{ text: "conversar", strong: true },
				{ text: "," },
			],
			slides: [2, 3],
		},
		{
			id: "here2",
			parts: [
				{ text: f ? "para a " : "para o " },
				{ text: "ajudar", strong: true },
				{ text: " e para nunca" },
			],
			slides: [2, 3],
		},
		{
			id: "here3",
			parts: [
				{ text: f ? "a deixar " : "o deixar " },
				{ text: f ? "sozinha" : "sozinho", strong: true },
				{ text: "." },
			],
			slides: [2, 3],
		},
		{
			id: "question1",
			parts: [{ text: "Vamos conhecermo-nos" }],
			slides: [3],
		},
		{
			id: "question2",
			parts: [{ text: "melhor", strong: true }, { text: "?" }],
			slides: [3],
		},
	];
};

const SLIDE_BUTTONS = ["Avançar", "Avançar", "Avançar", "Vamos lá"];
const SLIDE_EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];
const TEXT_REVEAL_EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

const buildSlideAudioText = (
	slideIndex: number,
	firstName: string,
	gender: "f" | "m" | null,
) => {
	const f = gender === "f";
	switch (slideIndex) {
		case 0:
			return `Olá ${firstName}, ${f ? "Que bom tê-la aqui" : "Que bom tê-lo aqui"}! Sou o Compy.`;
		case 1:
			return "O seu companheiro de todos os dias.";
		case 2:
			return `Estou aqui para conversar, para ${f ? "a" : "o"} ajudar e para nunca ${f ? "a deixar sozinha" : "o deixar sozinho"}.`;
		case 3:
			return "Vamos conhecermo-nos melhor?";
		default:
			return null;
	}
};

interface Props {
	firstName: string;
	gender: "f" | "m" | null;
	onComplete: () => void;
}

export const IntroSlides: React.FC<Props> = ({
	firstName,
	gender,
	onComplete,
}) => {
	const [slideIndex, setSlideIndex] = useState(0);
	const shouldReduceMotion = useReducedMotion();
	const allLines = buildSlideLines(firstName, gender);
	const audioDone = useOnboardingVoicePrompt(
		buildSlideAudioText(slideIndex, firstName, gender),
	);

	const handleNext = () => {
		unlockAudioForIOS();
		if (slideIndex < 3) {
			setSlideIndex((i) => i + 1);
		} else {
			onComplete();
		}
	};

	return (
		<div
			style={{
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				justifyContent: "center",
				height: "100%",
				padding: `${DS.space.xl}px`,
				gap: DS.space["2xl"],
				maxWidth: 720,
				margin: "0 auto",
				width: "100%",
			}}
		>
			<motion.div
				layout
				transition={{ layout: { type: "spring", duration: 0.52, bounce: 0 } }}
				style={{
					textAlign: "center",
					width: "100%",
					minHeight: "clamp(180px, 30vh, 228px)",
					display: "flex",
					flexDirection: "column",
					justifyContent: "center",
				}}
			>
				{allLines.map((line, lineIndex) => {
					const isActive = line.slides.includes(slideIndex);
					const wasActiveOnPreviousSlide =
						slideIndex > 0 && line.slides.includes(slideIndex - 1);
					const shouldBlurReveal = isActive && !wasActiveOnPreviousSlide;

					return (
						<motion.div
							key={line.id}
							layout
							initial={false}
							animate={
								isActive
									? {
											opacity: 1,
											y: 0,
											filter: "blur(0px)",
											height: "auto",
										}
									: shouldReduceMotion
										? {
												opacity: 0,
												height: 0,
											}
										: {
												opacity: 0,
												y: -6,
												filter: "blur(6px)",
												height: 0,
											}
							}
							transition={{
								opacity: { duration: 0.36, ease: SLIDE_EASE },
								y: { duration: 0.56, ease: SLIDE_EASE },
								filter: { duration: 0.62, ease: SLIDE_EASE },
								height: { duration: 0.58, ease: SLIDE_EASE },
								layout: { type: "spring", duration: 0.68, bounce: 0 },
							}}
							style={{
								overflow: "hidden",
								willChange: shouldReduceMotion
									? undefined
									: "transform, opacity, filter",
							}}
						>
							<motion.p
								key={`${line.id}-${shouldBlurReveal ? slideIndex : "stable"}`}
								layout="position"
								initial={
									shouldReduceMotion || !shouldBlurReveal
										? false
										: {
												opacity: 0.68,
												y: 14,
												scale: 0.992,
												filter: "blur(16px)",
											}
								}
								animate={
									isActive
										? {
												opacity: 1,
												y: 0,
												scale: 1,
												filter: "blur(0px)",
											}
										: shouldReduceMotion
											? { opacity: 0 }
											: {
													opacity: 0.72,
													y: -3,
													scale: 0.996,
													filter: "blur(8px)",
												}
								}
								transition={{
									opacity: { duration: 0.62, ease: TEXT_REVEAL_EASE },
									y: { duration: 0.92, ease: TEXT_REVEAL_EASE },
									scale: { duration: 0.92, ease: TEXT_REVEAL_EASE },
									filter: { duration: 1, ease: TEXT_REVEAL_EASE },
								}}
								style={{
									fontSize: "clamp(1.6rem, 4.1vw, 2.35rem)",
									fontWeight: 300,
									color: DS.C.teal700,
									lineHeight: 1.25,
									margin: 0,
									padding: "2px 0",
									fontFamily: "var(--font-heading)",
									letterSpacing: "-0.01em",
									willChange: shouldReduceMotion
										? undefined
										: "transform, opacity, filter",
								}}
							>
								{line.parts.map((part, index) => {
									const textStyle = {
										display: shouldReduceMotion ? undefined : "inline-block",
										whiteSpace: "pre-wrap",
										fontWeight: part.strong ? 600 : 300,
										color: part.strong ? DS.C.teal800 : DS.C.teal700,
									} as const;

									if (shouldReduceMotion) {
										return (
											<span key={`${line.id}-${index}`} style={textStyle}>
												{part.text}
											</span>
										);
									}

									return (
										<motion.span
											key={`${line.id}-${shouldBlurReveal ? slideIndex : "stable"}-${index}`}
											initial={
												shouldBlurReveal
													? {
															opacity: 0,
															y: 10,
															filter: "blur(12px)",
														}
													: false
											}
											animate={
												isActive
													? {
															opacity: 1,
															y: 0,
															filter: "blur(0px)",
														}
													: {
															opacity: 0.82,
															y: -2,
															filter: "blur(6px)",
														}
											}
											transition={{
												duration: 0.88,
												ease: TEXT_REVEAL_EASE,
												delay: shouldBlurReveal
													? 0.08 + lineIndex * 0.06 + index * 0.075
													: 0,
											}}
											style={textStyle}
										>
											{part.text}
										</motion.span>
									);
								})}
							</motion.p>
						</motion.div>
					);
				})}
			</motion.div>

			<motion.button
				initial={shouldReduceMotion ? false : { opacity: 0, y: 14 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ delay: 0.18, duration: 0.28, ease: SLIDE_EASE }}
				style={{
					...DS.btnPrimary,
					backgroundColor: DS.C.teal500,
					fontSize: "1.2rem",
					padding: "18px 48px",
					minWidth: 220,
					minHeight: 60,
					borderRadius: DS.radius.full,
					letterSpacing: "0.01em",
					cursor: "pointer",
					boxShadow: DS.shadow.sm,
				}}
				onClick={handleNext}
				whileTap={shouldReduceMotion ? undefined : { scale: 0.97 }}
				type="button"
			>
				{SLIDE_BUTTONS[slideIndex]}
			</motion.button>
		</div>
	);
};
