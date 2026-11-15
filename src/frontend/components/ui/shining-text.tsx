import { AnimatePresence, motion } from "framer-motion";

interface ShiningTextProps {
	text: string;
	className?: string;
	shineDurationSec?: number;
}

export function ShiningText({
	text,
	className,
	shineDurationSec = 2.2,
}: ShiningTextProps) {
	return (
		<AnimatePresence mode="wait">
			<motion.p
				key={text}
				className={`bg-[linear-gradient(110deg,#44a5aa,35%,#ffffff,50%,#44a5aa,75%,#44a5aa)] bg-[length:200%_100%] bg-clip-text text-transparent font-semibold tracking-[-0.02em] ${className ?? ""}`}
				initial={{
					backgroundPosition: "200% 0",
					opacity: 0,
					filter: "blur(8px)",
				}}
				animate={{
					backgroundPosition: "-200% 0",
					opacity: 1,
					filter: "blur(0px)",
				}}
				exit={{ opacity: 0, filter: "blur(8px)" }}
				transition={{
					backgroundPosition: {
						repeat: Infinity,
						duration: shineDurationSec,
						ease: "linear",
					},
					opacity: { duration: 0.35 },
					filter: { duration: 0.35 },
				}}
			>
				{text}
			</motion.p>
		</AnimatePresence>
	);
}
