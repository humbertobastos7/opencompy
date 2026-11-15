import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { synthesizeAssistantSpeech } from "@/frontend/lib/speech";
import { UiSoundPlayer } from "@/frontend/lib/ui-sound";
import type {
	MemoryGameResult,
	MemoryGameSessionResult,
} from "@/shared/contracts/chat";

type MemoryCard = {
	id: string;
	pairId: string;
	label: string;
	symbol: string;
};

type ActiveGameRun = {
	id: number;
	startedAt: number | null;
	errors: number;
	result: MemoryGameResult | null;
};

type Props = {
	open: boolean;
	seniorName: string;
	introAudioBase64?: string;
	introAudioMimeType?: "audio/mpeg" | "audio/wav";
	onClose: () => void;
	onComplete?: () => void;
	onRestart?: () => void;
	onReturnToConversation: (result: MemoryGameSessionResult) => void;
};

const basePairs = [
	{ pairId: "chave", label: "Chave", symbol: "🔑" },
	{ pairId: "radio", label: "Rádio", symbol: "📻" },
	{ pairId: "flor", label: "Flor", symbol: "🌼" },
	{ pairId: "chavena", label: "Chávena", symbol: "☕" },
	{ pairId: "livro", label: "Livro", symbol: "📘" },
	{ pairId: "casa", label: "Casa", symbol: "🏠" },
];

const successVoiceClips = [
	"/audio/games/muitoBem.mp3",
	"/audio/games/OtimaEscolha.mp3",
];

const retryVoiceClips = [
	"/audio/games/TenteOutraVez.mp3",
	"/audio/games/QuaseLa.mp3",
];
const staticVoiceClips = [...successVoiceClips, ...retryVoiceClips];
const completionPromptText =
	"Muito bem. Queres voltar à conversa ou repetir o jogo?";

const shuffleCards = (): MemoryCard[] =>
	basePairs
		.flatMap((card) => [
			{ ...card, id: `${card.pairId}-a` },
			{ ...card, id: `${card.pairId}-b` },
		])
		.sort(() => Math.random() - 0.5);

const pickRandom = (items: string[]) =>
	items[Math.floor(Math.random() * items.length)] ?? items[0];

const overlayStyle: CSSProperties = {
	position: "fixed",
	inset: 0,
	zIndex: 9500,
	height: "100dvh",
	width: "100vw",
	overflow: "hidden",
	background:
		"radial-gradient(circle at 18% 12%, rgba(255,252,226,0.94), transparent 30%), radial-gradient(circle at 86% 86%, rgba(185,235,220,0.9), transparent 32%), linear-gradient(135deg, #f7fffb 0%, #ffffff 48%, #dff8ef 100%)",
	display: "grid",
	gridTemplateRows: "auto 1fr auto",
	gap: 14,
	padding: "clamp(14px, 3vw, 26px)",
	boxSizing: "border-box",
	color: "#0a4a45",
};

const panelStyle: CSSProperties = {
	width: "min(1120px, 100%)",
	margin: "0 auto",
};

export default function MemoryPairsVoiceGame({
	open,
	seniorName,
	introAudioBase64,
	introAudioMimeType,
	onClose,
	onComplete,
	onRestart,
	onReturnToConversation,
}: Props) {
	const [cards, setCards] = useState<MemoryCard[]>(() => shuffleCards());
	const [flipped, setFlipped] = useState<string[]>([]);
	const [matched, setMatched] = useState<string[]>([]);

	// Animation states
	const [flippingCards, setFlippingCards] = useState<string[]>([]);
	const [revealingCards, setRevealingCards] = useState<string[]>([]);
	const [shakingCards, setShakingCards] = useState<string[]>([]);
	const [pulsatingPairs, setPulsatingPairs] = useState<string[]>([]);

	const audioContextRef = useRef<AudioContext | null>(null);
	const uiSoundPlayerRef = useRef<UiSoundPlayer | null>(null);
	const voiceAudioRef = useRef<HTMLAudioElement | null>(null);
	const objectUrlRefs = useRef<string[]>([]);
	const lastRetryVoiceAtRef = useRef(0);
	const timeoutRefs = useRef<number[]>([]);
	const completionPromptPlayedRef = useRef(false);
	const completionPromptArmedRef = useRef(false);
	const animationTokenRef = useRef(0);
	const sessionTokenRef = useRef(0);
	const completionPromptAbortRef = useRef<AbortController | null>(null);
	const gameRunIdRef = useRef(0);
	const activeGameRunRef = useRef<ActiveGameRun>({
		id: 0,
		startedAt: null,
		errors: 0,
		result: null,
	});

	const complete = matched.length === basePairs.length;

	const getUiSoundPlayer = () => {
		if (!uiSoundPlayerRef.current) {
			uiSoundPlayerRef.current = new UiSoundPlayer();
		}
		const audioContext = audioContextRef.current;
		if (audioContext) {
			uiSoundPlayerRef.current.setAudioContext(audioContext);
		}
		return uiSoundPlayerRef.current;
	};

	const resetGame = () => {
		animationTokenRef.current += 1;
		uiSoundPlayerRef.current?.stopAll();
		voiceAudioRef.current?.pause();
		voiceAudioRef.current = null;
		for (const objectUrl of objectUrlRefs.current) {
			URL.revokeObjectURL(objectUrl);
		}
		objectUrlRefs.current = [];
		setCards(shuffleCards());
		setFlipped([]);
		setFlippingCards([]);
		setRevealingCards([]);
		setShakingCards([]);
		setPulsatingPairs([]);
		setMatched([]);
		completionPromptPlayedRef.current = false;
		completionPromptArmedRef.current = false;
		gameRunIdRef.current += 1;
		activeGameRunRef.current = {
			id: gameRunIdRef.current,
			startedAt: null,
			errors: 0,
			result: null,
		};
	};

	const cancelCompletionPrompt = () => {
		completionPromptAbortRef.current?.abort();
		completionPromptAbortRef.current = null;
	};

	const clearScheduledAudio = () => {
		for (const timeoutId of timeoutRefs.current) {
			window.clearTimeout(timeoutId);
		}
		timeoutRefs.current = [];
	};

	const revokeObjectUrls = () => {
		for (const objectUrl of objectUrlRefs.current) {
			URL.revokeObjectURL(objectUrl);
		}
		objectUrlRefs.current = [];
	};

	const schedule = (callback: () => void, delayMs: number) => {
		const timeoutId = window.setTimeout(() => {
			timeoutRefs.current = timeoutRefs.current.filter(
				(id) => id !== timeoutId,
			);
			callback();
		}, delayMs);
		timeoutRefs.current.push(timeoutId);
	};

	const getAudioContext = () => {
		if (audioContextRef.current) return audioContextRef.current;
		const AudioContextClass =
			window.AudioContext ||
			(window as unknown as { webkitAudioContext?: typeof AudioContext })
				.webkitAudioContext;
		if (!AudioContextClass) return null;
		audioContextRef.current = new AudioContextClass();
		uiSoundPlayerRef.current?.setAudioContext(audioContextRef.current);
		return audioContextRef.current;
	};

	const playTone = (kind: "success" | "miss") => {
		const audioContext = getAudioContext();
		if (!audioContext) return;
		void audioContext.resume().catch(() => {});

		const oscillator = audioContext.createOscillator();
		const gain = audioContext.createGain();
		const now = audioContext.currentTime;

		oscillator.type = kind === "success" ? "sine" : "triangle";
		oscillator.frequency.setValueAtTime(kind === "success" ? 760 : 230, now);
		oscillator.frequency.exponentialRampToValueAtTime(
			kind === "success" ? 1280 : 150,
			now + 0.16,
		);
		gain.gain.setValueAtTime(0.0001, now);
		gain.gain.exponentialRampToValueAtTime(
			kind === "success" ? 0.09 : 0.055,
			now + 0.025,
		);
		gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);

		oscillator.connect(gain);
		gain.connect(audioContext.destination);
		oscillator.start(now);
		oscillator.stop(now + 0.22);
	};

	const playVoiceClip = (src: string) => {
		voiceAudioRef.current?.pause();
		voiceAudioRef.current = null;
		getUiSoundPlayer().play(src);
	};

	const playBase64VoiceClip = (base64: string, mimeType = "audio/mpeg") => {
		voiceAudioRef.current?.pause();
		const binary = window.atob(base64);
		const bytes = new Uint8Array(binary.length);
		for (let index = 0; index < binary.length; index += 1) {
			bytes[index] = binary.charCodeAt(index);
		}
		const objectUrl = URL.createObjectURL(
			new Blob([bytes], { type: mimeType }),
		);
		objectUrlRefs.current.push(objectUrl);
		const audio = new Audio(objectUrl);
		audio.volume = 0.94;
		audio.onended = () => {
			URL.revokeObjectURL(objectUrl);
			objectUrlRefs.current = objectUrlRefs.current.filter(
				(current) => current !== objectUrl,
			);
		};
		voiceAudioRef.current = audio;
		void audio.play().catch(() => {});
	};

	const playSuccessFeedback = () => {
		playTone("success");
		schedule(() => playVoiceClip(pickRandom(successVoiceClips)), 180);
	};

	const playMissFeedback = () => {
		playTone("miss");
		const now = Date.now();
		if (now - lastRetryVoiceAtRef.current < 7000) return;
		if (Math.random() > 0.35) return;
		lastRetryVoiceAtRef.current = now;
		schedule(() => playVoiceClip(pickRandom(retryVoiceClips)), 220);
	};

	const playIntro = () => {
		if (introAudioBase64) {
			playBase64VoiceClip(introAudioBase64, introAudioMimeType);
		}
	};

	const playCompletionPrompt = async (sessionToken: number) => {
		cancelCompletionPrompt();
		const abortController = new AbortController();
		completionPromptAbortRef.current = abortController;
		try {
			const speech = await synthesizeAssistantSpeech(
				completionPromptText,
				abortController.signal,
			);
			if (
				sessionToken === sessionTokenRef.current &&
				!abortController.signal.aborted &&
				speech.audio_base64
			) {
				playBase64VoiceClip(speech.audio_base64, speech.audio_mime_type);
			}
		} catch (error) {
			if (!abortController.signal.aborted) {
				console.warn("Failed to play memory game completion prompt:", error);
			}
		} finally {
			if (completionPromptAbortRef.current === abortController) {
				completionPromptAbortRef.current = null;
			}
		}
	};

	const freezeCurrentGameResult = (completedAt = Date.now()) => {
		const gameRun = activeGameRunRef.current;
		if (!gameRun.result) {
			gameRun.result = {
				timeTakenSeconds: gameRun.startedAt
					? Math.round((completedAt - gameRun.startedAt) / 1000)
					: 0,
				errors: gameRun.errors,
				totalPairs: basePairs.length,
			};
		}
		return gameRun.result;
	};

	const repeatGame = () => {
		freezeCurrentGameResult();
		onRestart?.();
		resetGame();
		schedule(playIntro, 450);
	};

	useEffect(() => {
		if (!open) return;
		sessionTokenRef.current += 1;
		completionPromptArmedRef.current = false;
		resetGame();
		const audioContext = getAudioContext();
		const player = getUiSoundPlayer();
		if (audioContext) {
			void player.unlock(audioContext).catch(() => {});
		}
		player.preload(staticVoiceClips);
		schedule(playIntro, 450);

		return () => {
			sessionTokenRef.current += 1;
			cancelCompletionPrompt();
			clearScheduledAudio();
			uiSoundPlayerRef.current?.stopAll();
			voiceAudioRef.current?.pause();
			voiceAudioRef.current = null;
			revokeObjectUrls();
		};
	}, [open, seniorName, introAudioBase64, introAudioMimeType]);

	useEffect(() => {
		return () => {
			sessionTokenRef.current += 1;
			cancelCompletionPrompt();
			clearScheduledAudio();
			uiSoundPlayerRef.current?.stopAll();
			voiceAudioRef.current?.pause();
			revokeObjectUrls();
			void audioContextRef.current?.close();
		};
	}, []);

	useEffect(() => {
		if (!open) return;
		if (matched.length === 0) {
			completionPromptArmedRef.current = true;
		}
	}, [open, matched.length]);

	useEffect(() => {
		if (
			!open ||
			!complete ||
			!completionPromptArmedRef.current ||
			completionPromptPlayedRef.current
		) {
			return;
		}
		onComplete?.();
		freezeCurrentGameResult();
		completionPromptPlayedRef.current = true;
		const sessionToken = sessionTokenRef.current;
		schedule(() => {
			void playCompletionPrompt(sessionToken);
		}, 1250);
	}, [open, complete, onComplete]);

	useEffect(() => {
		if (flipped.length !== 2) return;
		const [firstId, secondId] = flipped;
		const first = cards.find((card) => card.id === firstId);
		const second = cards.find((card) => card.id === secondId);

		const timeoutId = window.setTimeout(() => {
			if (first && second && first.pairId === second.pairId) {
				setMatched((current) => {
					if (current.includes(first.pairId)) return current;
					const next = [...current, first.pairId];
					if (next.length === basePairs.length) {
						freezeCurrentGameResult(Date.now());
					}
					return next;
				});
				setPulsatingPairs((prev) => [...prev, first.pairId]);
				window.setTimeout(() => {
					setPulsatingPairs((prev) => prev.filter((p) => p !== first.pairId));
				}, 500);
				playSuccessFeedback();
			} else {
				activeGameRunRef.current.errors += 1;
				setShakingCards([firstId!, secondId!]);
				window.setTimeout(() => setShakingCards([]), 580);
				playMissFeedback();
			}
			setFlipped([]);
		}, 520);

		return () => window.clearTimeout(timeoutId);
	}, [cards, flipped]);

	const flipCard = (card: MemoryCard) => {
		if (flipped.length >= 2) return;
		if (flipped.includes(card.id) || flippingCards.includes(card.id)) return;
		if (matched.includes(card.pairId)) return;

		if (activeGameRunRef.current.startedAt === null) {
			activeGameRunRef.current.startedAt = Date.now();
		}

		const token = animationTokenRef.current;
		setFlippingCards((prev) => [...prev, card.id]);

		// Phase 1 ends at 175ms — card is edge-on, safe to swap content
		window.setTimeout(() => {
			if (token !== animationTokenRef.current) return;
			setFlippingCards((prev) => prev.filter((id) => id !== card.id));
			setRevealingCards((prev) => [...prev, card.id]);
			setFlipped((prev) => {
				if (prev.length >= 2 || prev.includes(card.id)) return prev;
				return [...prev, card.id];
			});
			// Phase 2 ends at 175ms — card faces forward with symbol
			window.setTimeout(() => {
				if (token !== animationTokenRef.current) return;
				setRevealingCards((prev) => prev.filter((id) => id !== card.id));
			}, 175);
		}, 175);
	};

	if (!open) return null;

	return (
		<div style={overlayStyle} role="dialog" aria-modal="true">
			<header
				style={{
					...panelStyle,
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
					gap: 16,
				}}
			>
				<div>
					<p
						style={{
							margin: 0,
							fontSize: "clamp(0.78rem, 1.7vw, 0.95rem)",
							fontWeight: 800,
							letterSpacing: "0.08em",
							textTransform: "uppercase",
							color: "#1a5f5a",
						}}
					>
						Jogo da memória
					</p>
					<p
						style={{
							margin: "3px 0 0",
							fontSize: "clamp(0.92rem, 2vw, 1.1rem)",
							fontWeight: 750,
							color: "rgba(10,74,69,0.7)",
						}}
					>
						{seniorName}, escolha duas cartas.
					</p>
					<h2
						style={{
							margin: "4px 0 0",
							fontSize: "clamp(1.65rem, 4.5vw, 3rem)",
							lineHeight: 1,
							fontWeight: 900,
							letterSpacing: "-0.04em",
						}}
					>
						Encontre os pares iguais
					</h2>
				</div>
				<button
					type="button"
					onClick={onClose}
					style={{
						border: "1px solid rgba(10,74,69,0.12)",
						background: "rgba(255,255,255,0.88)",
						color: "#0a4a45",
						borderRadius: 999,
						padding: "12px 18px",
						fontSize: 16,
						fontWeight: 800,
						boxShadow: "0 10px 26px rgba(31,80,73,0.08)",
					}}
				>
					Fechar
				</button>
			</header>

			<main
				style={{
					...panelStyle,
					minHeight: 0,
					display: "grid",
				}}
			>
				<div
					className="memory-pairs-grid"
					style={{
						display: "grid",
						gap: "clamp(8px, 1.5vw, 16px)",
						height: "100%",
						minHeight: 0,
					}}
				>
					{cards.map((card) => {
						const visible =
							flipped.includes(card.id) || matched.includes(card.pairId);
						const isMatched = matched.includes(card.pairId);
						const isFlipping = flippingCards.includes(card.id);
						const isRevealing = revealingCards.includes(card.id);
						const isShaking = shakingCards.includes(card.id);
						const isPulsating =
							pulsatingPairs.includes(card.pairId) && isMatched;

						let animationValue = "none";
						if (isShaking) animationValue = "card-shake 560ms ease-in-out";
						else if (isFlipping)
							animationValue = "card-flip-away 175ms ease-in forwards";
						else if (isRevealing)
							animationValue = "card-flip-reveal 175ms ease-out";
						else if (isPulsating)
							animationValue = "card-match-pulse 420ms ease-out";

						return (
							<button
								key={card.id}
								type="button"
								aria-label={visible ? card.label : "Carta virada para baixo"}
								onClick={() => flipCard(card)}
								style={{
									border: visible
										? "1px solid rgba(26,95,90,0.18)"
										: "1px solid rgba(255,255,255,0.5)",
									borderRadius: "clamp(18px, 3vw, 30px)",
									background: visible
										? "radial-gradient(circle at 18% 18%, rgba(255,252,226,0.95), transparent 60%), radial-gradient(circle at 82% 82%, rgba(185,235,220,0.9), transparent 55%), linear-gradient(135deg, #f7fffb 0%, #dff8ef 100%)"
										: "linear-gradient(150deg, #0f6a62 0%, #1fb59f 100%)",
									color: visible ? "#0a4a45" : "#ffffff",
									boxShadow: visible
										? "0 14px 32px rgba(31,80,73,0.08)"
										: "0 18px 42px rgba(26,95,90,0.18)",
									display: "grid",
									placeItems: "center",
									cursor: isMatched ? "default" : "pointer",
									transform:
										isMatched && !isPulsating ? "scale(0.985)" : "scale(1)",
									transition:
										isShaking || isFlipping || isRevealing || isPulsating
											? "none"
											: "transform 180ms ease, background 180ms ease, box-shadow 180ms ease",
									animation: animationValue,
									willChange: "transform",
								}}
							>
								<span aria-hidden="true" className="card-emoji">
									{visible ? card.symbol : "?"}
								</span>
							</button>
						);
					})}
				</div>
			</main>

			<footer
				style={{
					...panelStyle,
					display: "grid",
					gridTemplateColumns: complete ? "1fr" : undefined,
					alignItems: "center",
					gap: 12,
					fontSize: "clamp(0.95rem, 2vw, 1.15rem)",
					fontWeight: 800,
				}}
			>
				{complete && (
					<div
						className="memory-pairs-complete-actions"
						style={{
							display: "grid",
							alignItems: "center",
							gap: 12,
							padding: "10px 12px",
							borderRadius: 24,
							background: "rgba(255,255,255,0.86)",
							border: "1px solid rgba(19,138,114,0.16)",
							boxShadow: "0 16px 36px rgba(31,80,73,0.08)",
						}}
					>
						<span style={{ color: "#138a72" }}>{completionPromptText}</span>
						<button
							type="button"
							onClick={() => {
								const currentGame = freezeCurrentGameResult();
								onReturnToConversation({
									games: [currentGame],
								});
							}}
							style={{
								border: "none",
								borderRadius: 999,
								background: "#0a4a45",
								color: "#ffffff",
								padding: "12px 18px",
								fontSize: "clamp(0.95rem, 1.8vw, 1.08rem)",
								fontWeight: 900,
								boxShadow: "0 12px 26px rgba(10,74,69,0.18)",
							}}
						>
							Voltar à conversa
						</button>
						<button
							type="button"
							onClick={repeatGame}
							style={{
								border: "1px solid rgba(10,74,69,0.14)",
								borderRadius: 999,
								background: "rgba(255,255,255,0.92)",
								color: "#0a4a45",
								padding: "12px 18px",
								fontSize: "clamp(0.95rem, 1.8vw, 1.08rem)",
								fontWeight: 900,
							}}
						>
							Repetir jogo
						</button>
					</div>
				)}
			</footer>

			<style>{`
				.memory-pairs-grid {
					grid-template-columns: repeat(4, minmax(0, 1fr));
					grid-template-rows: repeat(3, minmax(0, 1fr));
				}
				.memory-pairs-complete-actions {
					grid-template-columns: minmax(0, 1fr) auto auto;
				}
				.card-emoji {
					font-size: clamp(2rem, 8vh, 4.2rem);
					line-height: 1;
					pointer-events: none;
					user-select: none;
				}
				@media (min-width: 900px) {
					.card-emoji {
						font-size: clamp(3rem, 7vw, 5.5rem);
					}
				}
				@keyframes card-flip-away {
					from { transform: perspective(900px) rotateY(0deg) scale(1); }
					to   { transform: perspective(900px) rotateY(-90deg) scale(0.94); }
				}
				@keyframes card-flip-reveal {
					from { transform: perspective(900px) rotateY(90deg) scale(0.94); }
					to   { transform: perspective(900px) rotateY(0deg) scale(1); }
				}
				@keyframes card-shake {
					0%,  100% { transform: translateX(0)    rotate(0deg); }
					12%        { transform: translateX(-10px) rotate(-2.5deg); }
					25%        { transform: translateX(10px)  rotate(2.5deg); }
					37%        { transform: translateX(-8px)  rotate(-1.8deg); }
					50%        { transform: translateX(8px)   rotate(1.8deg); }
					62%        { transform: translateX(-5px)  rotate(-1deg); }
					75%        { transform: translateX(5px)   rotate(1deg); }
					87%        { transform: translateX(-2px); }
				}
				@keyframes card-match-pulse {
					0%   { transform: scale(0.985); }
					35%  { transform: scale(1.12); }
					65%  { transform: scale(0.975); }
					100% { transform: scale(0.985); }
				}
				@media (max-width: 680px) {
					.memory-pairs-grid {
						grid-template-columns: repeat(3, minmax(0, 1fr));
						grid-template-rows: repeat(4, minmax(0, 1fr));
					}
					.memory-pairs-complete-actions {
						grid-template-columns: 1fr;
					}
				}
				@media (prefers-reduced-motion: reduce) {
					.memory-pairs-grid button {
						transition: none !important;
						animation: none !important;
					}
				}
			`}</style>
		</div>
	);
}
