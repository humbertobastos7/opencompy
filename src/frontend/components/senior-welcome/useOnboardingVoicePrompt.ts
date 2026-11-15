import { useEffect, useRef, useState } from "react";
import type { ChatVoiceTtsResponse } from "@/shared/contracts";
import { synthesizeAssistantSpeech } from "@/frontend/lib/speech";

type WindowWithWebkitAudioContext = Window & {
	webkitAudioContext?: typeof AudioContext;
};

const speechCache = new Map<string, ChatVoiceTtsResponse>();
const pendingSpeech = new Map<string, Promise<ChatVoiceTtsResponse>>();

const getAudioContextConstructor = () => {
	if (typeof window === "undefined") return undefined;
	return (
		window.AudioContext ??
		(window as WindowWithWebkitAudioContext).webkitAudioContext
	);
};

// Shared context across all hook instances — unlocked via user gesture on iOS
let sharedAudioContext: AudioContext | null = null;

/**
 * Call this synchronously inside any user-gesture handler (button onClick)
 * to unlock iOS audio. iOS requires AudioContext.resume() + a silent buffer
 * to be triggered within the synchronous call stack of a user gesture.
 */
export function unlockAudioForIOS() {
	const Constructor = getAudioContextConstructor();
	if (!Constructor) return;
	if (!sharedAudioContext || sharedAudioContext.state === "closed") {
		sharedAudioContext = new Constructor();
	}
	if (sharedAudioContext.state === "suspended") {
		sharedAudioContext.resume().catch(() => {});
		try {
			const buffer = sharedAudioContext.createBuffer(1, 1, 22050);
			const source = sharedAudioContext.createBufferSource();
			source.buffer = buffer;
			source.connect(sharedAudioContext.destination);
			source.start(0);
		} catch {
			// ignore — context may not be fully started yet
		}
	}
}

const speechForText = async (text: string, signal: AbortSignal) => {
	const cached = speechCache.get(text);
	if (cached) return cached;

	const pending = pendingSpeech.get(text);
	if (pending) return await pending;

	const request = synthesizeAssistantSpeech(text, signal).then((speech) => {
		speechCache.set(text, speech);
		return speech;
	});
	pendingSpeech.set(text, request);

	try {
		return await request;
	} finally {
		pendingSpeech.delete(text);
	}
};

const base64ToBytes = (base64: string) => {
	const binary = window.atob(base64);
	const bytes = new Uint8Array(binary.length);
	for (let index = 0; index < binary.length; index += 1) {
		bytes[index] = binary.charCodeAt(index);
	}
	return bytes;
};

export function useOnboardingVoicePrompt(text: string | null) {
	const [audioDone, setAudioDone] = useState(!text);
	const audioContextRef = useRef<AudioContext | null>(null);
	const sourceRef = useRef<AudioBufferSourceNode | null>(null);
	const audioRef = useRef<HTMLAudioElement | null>(null);
	const objectUrlRef = useRef<string | null>(null);

	useEffect(() => {
		let cancelled = false;
		const abortController = new AbortController();

		const stopCurrentAudio = () => {
			try {
				sourceRef.current?.stop();
			} catch {
				/* already stopped */
			}
			sourceRef.current = null;
			audioRef.current?.pause();
			audioRef.current = null;
			if (objectUrlRef.current) {
				URL.revokeObjectURL(objectUrlRef.current);
				objectUrlRef.current = null;
			}
		};

		const playWithAudioContext = async (bytes: Uint8Array) => {
			const AudioContextConstructor = getAudioContextConstructor();
			if (!AudioContextConstructor) return false;

			// Prefer the shared context — it may already be unlocked via user gesture
			if (!sharedAudioContext || sharedAudioContext.state === "closed") {
				sharedAudioContext = new AudioContextConstructor();
			}
			const ctx = sharedAudioContext;
			audioContextRef.current = ctx;

			if (ctx.state === "suspended") {
				await ctx.resume().catch(() => {});
			}
			if (ctx.state !== "running") return false;

			const audioData = new ArrayBuffer(bytes.byteLength);
			new Uint8Array(audioData).set(bytes);
			const buffer = await ctx.decodeAudioData(audioData);
			if (cancelled) return true;

			await new Promise<void>((resolve) => {
				const source = ctx.createBufferSource();
				source.buffer = buffer;
				source.connect(ctx.destination);
				source.onended = () => {
					if (sourceRef.current === source) {
						sourceRef.current = null;
					}
					resolve();
				};
				sourceRef.current = source;
				source.start(0);
			});

			return true;
		};

		const playWithHtmlAudio = async (
			bytes: Uint8Array,
			mimeType = "audio/mpeg",
		) => {
			const objectUrl = URL.createObjectURL(
				new Blob([bytes], { type: mimeType }),
			);
			objectUrlRef.current = objectUrl;
			const audio = new Audio(objectUrl);
			audioRef.current = audio;

			await new Promise<void>((resolve) => {
				audio.onended = () => resolve();
				audio.onerror = () => resolve();
				void audio.play().catch(() => resolve());
			});
		};

		const run = async () => {
			stopCurrentAudio();

			if (!text) {
				setAudioDone(true);
				return;
			}

			setAudioDone(false);

			try {
				const speech = await speechForText(text, abortController.signal);
				if (cancelled || !speech.audio_base64) return;

				const bytes = base64ToBytes(speech.audio_base64);
				const playedWithContext = await playWithAudioContext(bytes);
				if (!cancelled && !playedWithContext) {
					await playWithHtmlAudio(bytes, speech.audio_mime_type);
				}
			} finally {
				if (!cancelled) {
					setAudioDone(true);
				}
			}
		};

		void run();

		return () => {
			cancelled = true;
			abortController.abort();
			stopCurrentAudio();
		};
	}, [text]);

	useEffect(() => {
		return () => {
			// Don't close the shared context — other instances may still use it
			if (
				audioContextRef.current &&
				audioContextRef.current !== sharedAudioContext
			) {
				void audioContextRef.current.close();
			}
		};
	}, []);

	return audioDone;
}
