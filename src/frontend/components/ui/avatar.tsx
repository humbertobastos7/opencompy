import type React from "react";
import { useEffect, useRef, useState } from "react";
import { PiSpinnerBold } from "react-icons/pi";

type CharTimings = { chars: string[]; startTimesMs: number[] };

export interface AvatarProps {
	listening: boolean;
	loading: boolean;
	speaking: boolean;
	emotion?: "entusiasmo" | "triste" | null;
	charTimingsRef?: { current: CharTimings | null };
	speakingStartTimeRef?: { current: number | null };
}

const BURST_DURATION_MS = 900;
const SLEEP_CYCLE_MS = 2400;

const IMG = (name: string) => `/avatar/newcompy/${name}.png`;

// Map a spoken text character to the matching viseme image.
// AEI (default open mouth) is replaced by the emotion face when active.
function charToVisemeSrc(
	char: string,
	emotion: "entusiasmo" | "triste" | null,
): string {
	const c = char.toUpperCase();
	if ("BMP".includes(c)) return IMG("BMP");
	if ("OUWQ".includes(c)) return IMG("OUWQ");
	if ("JH".includes(c)) return IMG("OUWQ");
	if ("FVSTDNZC".includes(c)) return IMG("FV");
	// AEI / default open — show emotion face if one is active
	if (emotion === "entusiasmo") return IMG("entusiasmo");
	if (emotion === "triste") return IMG("triste");
	return IMG("AEI");
}

// Three 3D Z's that float upward and fade while sleeping
function SleepZs({ visible }: { visible: boolean }) {
	const zs = [
		{ name: "z1", size: 18, right: "16%", top: "32%", delay: "0s" },
		{ name: "z2", size: 23, right: "22%", top: "20%", delay: "0.8s" },
		{ name: "z3", size: 28, right: "10%", top: "10%", delay: "1.6s" },
	];
	return (
		<div
			style={{
				position: "absolute",
				inset: 0,
				pointerEvents: "none",
				zIndex: 4,
			}}
		>
			{zs.map(({ name, size, right, top, delay }) => (
				<img
					key={name}
					src={IMG(name)}
					alt=""
					style={{
						position: "absolute",
						width: size,
						height: size,
						right,
						top,
						objectFit: "contain",
						opacity: 0,
						animation: visible
							? `sleepZFloat 2.4s ease-in-out ${delay} infinite`
							: "none",
					}}
				/>
			))}
		</div>
	);
}

const Avatar: React.FC<AvatarProps> = ({
	listening,
	loading,
	speaking,
	emotion,
	charTimingsRef,
	speakingStartTimeRef,
}) => {
	const active = listening || loading || speaking;

	const [bursting, setBursting] = useState(false);
	const [sleepPhase, setSleepPhase] = useState<1 | 2>(1);
	const [visemeSrc, setVisemeSrc] = useState(IMG("normal"));

	const burstTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const wasActive = useRef(false);
	const rafRef = useRef(0);
	const lastVisemeTime = useRef(0);
	const emotionRef = useRef(emotion);
	emotionRef.current = emotion;

	// Preload all images so viseme swaps are instant
	useEffect(() => {
		for (const name of [
			"normal",
			"sleep1",
			"sleep2",
			"entusiasmo",
			"triste",
			"BMP",
			"AEI",
			"OUWQ",
			"FV",
			"CHJSH",
			"STDNZC",
			"z1",
			"z2",
			"z3",
		]) {
			const el = new window.Image();
			el.src = IMG(name);
		}
	}, []);

	// Burst glow on wake
	useEffect(() => {
		if (active && !wasActive.current) {
			setBursting(true);
			burstTimer.current = setTimeout(
				() => setBursting(false),
				BURST_DURATION_MS,
			);
		} else if (!active) {
			if (burstTimer.current) clearTimeout(burstTimer.current);
			setBursting(false);
		}
		wasActive.current = active;
		return () => {
			if (burstTimer.current) clearTimeout(burstTimer.current);
		};
	}, [active]);

	// Sleep cycle: alternate sleep1 ↔ sleep2 slowly
	useEffect(() => {
		if (active) {
			setSleepPhase(1);
			return;
		}
		const id = setInterval(
			() => setSleepPhase((p) => (p === 1 ? 2 : 1)),
			SLEEP_CYCLE_MS,
		);
		return () => clearInterval(id);
	}, [active]);

	// Viseme rAF loop — runs only while speaking
	useEffect(() => {
		cancelAnimationFrame(rafRef.current);
		if (!speaking) {
			setVisemeSrc(IMG("normal"));
			return;
		}
		const VISEME_THROTTLE_MS = 150;
		const tick = () => {
			const timings = charTimingsRef?.current;
			const startTime = speakingStartTimeRef?.current ?? null;
			if (timings && startTime !== null && timings.chars.length > 0) {
				const now = performance.now();
				if (now - lastVisemeTime.current >= VISEME_THROTTLE_MS) {
					const elapsed = now - startTime;
					let idx = 0;
					while (
						idx < timings.startTimesMs.length - 1 &&
						timings.startTimesMs[idx + 1] <= elapsed
					)
						idx++;
					const next = charToVisemeSrc(
						timings.chars[idx] ?? "",
						emotionRef.current ?? null,
					);
					setVisemeSrc((prev) => {
						if (prev === next) return prev;
						lastVisemeTime.current = now;
						return next;
					});
				}
			}
			rafRef.current = requestAnimationFrame(tick);
		};
		rafRef.current = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(rafRef.current);
	}, [speaking, charTimingsRef, speakingStartTimeRef]);

	const glowAnimation = !active
		? "none"
		: bursting
			? `amberBurst ${BURST_DURATION_MS}ms ease-out forwards`
			: "amberPulse 1.8s ease-in-out infinite";

	// Image priority: sleeping > speaking(viseme, emotion via AEI override) > emotion (listening) > normal
	const sleeping = !active;
	const mainSrc = sleeping
		? sleepPhase === 1
			? IMG("sleep1")
			: IMG("sleep2")
		: speaking
			? visemeSrc
			: emotion === "entusiasmo"
				? IMG("entusiasmo")
				: emotion === "triste"
					? IMG("triste")
					: IMG("normal");

	return (
		<div
			className="h-48 w-48 flex-shrink-0 relative"
			style={{
				animation: listening
					? "listeningPulse 2s ease-in-out infinite"
					: "none",
			}}
		>
			{/* Amber glow */}
			<div
				style={{
					position: "absolute",
					top: "50%",
					left: "50%",
					transform: "translate(-50%, -50%)",
					width: "300%",
					height: "300%",
					pointerEvents: "none",
					opacity: active ? 1 : 0,
					transition: "opacity 0.5s ease",
					zIndex: 0,
				}}
			>
				<div
					style={{
						width: "100%",
						height: "100%",
						borderRadius: "50%",
						background:
							"radial-gradient(circle, #f5c842 0%, rgba(245,200,66,0) 65%)",
						animation: glowAnimation,
					}}
				/>
			</div>

			{/* Listening spinners */}
			{listening && (
				<>
					<div
						className="absolute top-[30%] -left-3 flex items-center justify-center text-6xl text-white"
						style={{
							animation: "customPing 2s cubic-bezier(0,0,0.2,1) infinite",
							zIndex: 5,
						}}
					>
						<PiSpinnerBold />
					</div>
					<div
						className="absolute top-[30%] -right-3 flex items-center justify-center text-6xl text-white"
						style={{
							animation: "customPing 2s cubic-bezier(0,0,0.2,1) infinite",
							zIndex: 5,
						}}
					>
						<PiSpinnerBold />
					</div>
				</>
			)}

			{/* Main image */}
			<img
				src={mainSrc}
				className="absolute h-full w-full top-0 left-0 object-contain"
				alt="Compy"
				style={{
					transition: speaking ? "none" : "opacity 0.25s ease",
					zIndex: 1,
				}}
			/>

			{/* Floating Z's during sleep */}
			<SleepZs visible={sleeping} />

			<style>{`
				@keyframes sleepZFloat {
					0%   { transform: translateY(0px)  scale(1);    opacity: 0;   }
					18%  { opacity: 0.88; }
					72%  { opacity: 0.55; }
					100% { transform: translateY(-46px) scale(0.62); opacity: 0; }
				}
				@keyframes listeningPulse {
					0%, 100% { transform: scale(1);     }
					50%       { transform: scale(1.025); }
				}
			`}</style>
		</div>
	);
};

export default Avatar;
