import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ShiningText } from "./shining-text";

export const THINKING_STATUS_CYCLE_MS = 2000;

const PHRASES = {
	listening: [
		"Todo ouvidos...",
		"Estou aqui, fala...",
		"A escutar-te...",
		"Não perco uma palavra...",
	],
	thinking: [
		"Deixa cá ver...",
		"Hmm, deixa-me pensar...",
		"A escolher as palavras certas...",
		"Um momentinho...",
	],
};

interface VoiceStatusProps {
	mode: "listening" | "thinking";
	className?: string;
}

export function VoiceStatus({ mode, className }: VoiceStatusProps) {
	const [index, setIndex] = useState(0);

	useEffect(() => {
		setIndex(
			mode === "thinking"
				? Math.floor(Math.random() * PHRASES.thinking.length)
				: 0,
		);
	}, [mode]);

	useEffect(() => {
		const id = setInterval(
			() => {
				setIndex((i) => (i + 1) % PHRASES[mode].length);
			},
			mode === "thinking" ? THINKING_STATUS_CYCLE_MS : 2500,
		);
		return () => clearInterval(id);
	}, [mode]);

	return (
		<motion.div
			className={`flex items-center justify-center ${className ?? ""}`}
			style={{ height: 96, flexShrink: 0 }}
			initial={{ opacity: 0, y: 6, filter: "blur(6px)" }}
			animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
			exit={{ opacity: 0, y: -4, filter: "blur(6px)" }}
			transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
		>
			<AnimatePresence mode="wait">
				<motion.div
					key={`${mode}-${index}`}
					initial={{ opacity: 0, filter: "blur(6px)" }}
					animate={{ opacity: 1, filter: "blur(0px)" }}
					exit={{ opacity: 0, filter: "blur(6px)" }}
					transition={{ duration: 0.35, ease: "easeInOut" }}
				>
					<ShiningText
						text={PHRASES[mode][index]}
						className="text-3xl sm:text-4xl"
						shineDurationSec={
							mode === "thinking" ? THINKING_STATUS_CYCLE_MS / 1000 : undefined
						}
					/>
				</motion.div>
			</AnimatePresence>
		</motion.div>
	);
}
