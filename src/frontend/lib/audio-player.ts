type ProgressiveAudioPlayerOptions = {
	audioContext?: AudioContext;
	minDecodeBytes?: number;
	preBufferCount?: number;
};

type EnqueuedAudioChunk = {
	bytes: Uint8Array;
	onPlaybackStart?: () => void;
	onPlaybackEnd?: () => void;
};

const DEFAULT_MIN_DECODE_BYTES = 1024;
const DEFAULT_PRE_BUFFER_COUNT = 1;

/**
 * Concatenates multiple byte chunks into one contiguous Uint8Array so the Web Audio
 * decoder can consume them as a single payload.
 */
const concatenateByteChunks = (chunks: Uint8Array[]) => {
	const totalLength = chunks.reduce(
		(length, chunk) => length + chunk.byteLength,
		0,
	);

	const combined = new Uint8Array(totalLength);
	let offset = 0;

	for (const chunk of chunks) {
		combined.set(chunk, offset);
		offset += chunk.byteLength;
	}

	return combined;
};

/**
 * Schedules provider audio progressively with the Web Audio API so
 * playback can start before the full assistant response has been assembled.
 */
export class ProgressiveAudioPlayer {
	private readonly audioContext: AudioContext;
	private readonly ownsAudioContext: boolean;
	private readonly minDecodeBytes: number;
	private readonly preBufferCount: number;
	private readonly pendingEncodedChunks: EnqueuedAudioChunk[] = [];
	private pendingEncodedBytes = 0;
	private nextStartTime = 0;
	private lastScheduledPlayback: Promise<void> = Promise.resolve();
	private stopped = false;
	private readonly preBufferQueue: Array<{
		buffer: AudioBuffer;
		onPlaybackStart?: () => void;
		onPlaybackEnd?: () => void;
	}> = [];
	private preBufferReady = false;
	private readonly activeSources: AudioBufferSourceNode[] = [];
	playbackStartCallback: (() => void) | null = null;

	constructor(options: ProgressiveAudioPlayerOptions = {}) {
		this.audioContext = options.audioContext ?? new AudioContext();
		this.ownsAudioContext = !options.audioContext;
		this.minDecodeBytes = options.minDecodeBytes ?? DEFAULT_MIN_DECODE_BYTES;
		this.preBufferCount = options.preBufferCount ?? DEFAULT_PRE_BUFFER_COUNT;
	}

	/**
	 * Reports whether the current browser runtime supports the Web Audio API path
	 * required for progressive decoding.
	 */
	static isSupported() {
		return (
			typeof window !== "undefined" &&
			typeof window.AudioContext !== "undefined"
		);
	}

	/**
	 * Buffers one raw audio chunk that already arrived as bytes and tries to decode
	 * it once enough data has been accumulated for progressive playback.
	 */
	async enqueueBinaryChunk(
		binaryChunk: Uint8Array,
		options: { onPlaybackStart?: () => void; onPlaybackEnd?: () => void } = {},
	) {
		if (this.stopped) {
			throw new DOMException("Playback already stopped", "AbortError");
		}

		if (binaryChunk.byteLength === 0) {
			return;
		}

		this.pendingEncodedChunks.push({
			bytes: binaryChunk,
			onPlaybackStart: options.onPlaybackStart,
			onPlaybackEnd: options.onPlaybackEnd,
		});
		this.pendingEncodedBytes += binaryChunk.byteLength;

		if (this.pendingEncodedBytes < this.minDecodeBytes) {
			return;
		}

		await this.flushBufferedChunks(false);
	}

	/**
	 * Flushes any trailing buffered bytes and waits until the last scheduled audio
	 * buffer has finished playing.
	 */
	async complete() {
		try {
			await this.flushBufferedChunks(true);
		} catch {
			// Trailing bytes may not form a complete MP3 frame — safe to ignore
			// since all prior full frames have already been scheduled for playback.
		}
		if (!this.preBufferReady && this.preBufferQueue.length > 0) {
			this.preBufferReady = true;
			this.playbackStartCallback?.();
			this.playbackStartCallback = null;
			for (const item of this.preBufferQueue) {
				await this.scheduleDecodedBuffer(
					item.buffer,
					item.onPlaybackStart,
					item.onPlaybackEnd,
				);
			}
			this.preBufferQueue.length = 0;
		}
		await this.lastScheduledPlayback;
	}

	/**
	 * Stops any future playback work and releases the underlying AudioContext.
	 */
	stop() {
		this.stopped = true;
		this.pendingEncodedChunks.splice(0, this.pendingEncodedChunks.length);
		this.pendingEncodedBytes = 0;
		this.preBufferQueue.length = 0;
		this.preBufferReady = false;
		this.playbackStartCallback = null;
		for (const source of this.activeSources) {
			try {
				source.stop();
			} catch {
				/* already stopped or never started */
			}
		}
		this.activeSources.length = 0;
		if (this.ownsAudioContext) {
			void this.audioContext.close();
		}
	}

	/**
	 * Attempts to decode the currently buffered bytes. Non-forced flushes keep
	 * the bytes in memory if the decoder still needs more MP3 data.
	 */
	private async flushBufferedChunks(force: boolean) {
		if (this.pendingEncodedChunks.length === 0) {
			return;
		}
		if (!force && this.pendingEncodedBytes < this.minDecodeBytes) {
			return;
		}

		const pendingOnPlaybackStart = this.pendingEncodedChunks.find(
			(chunk) => chunk.onPlaybackStart,
		)?.onPlaybackStart;
		const pendingOnPlaybackEnd = this.pendingEncodedChunks.find(
			(chunk) => chunk.onPlaybackEnd,
		)?.onPlaybackEnd;
		const mergedBytes = concatenateByteChunks(
			this.pendingEncodedChunks.map((chunk) => chunk.bytes),
		);
		const audioData = mergedBytes.buffer.slice(
			mergedBytes.byteOffset,
			mergedBytes.byteOffset + mergedBytes.byteLength,
		);

		try {
			const audioBuffer = await this.audioContext.decodeAudioData(audioData);

			this.pendingEncodedChunks.splice(0, this.pendingEncodedChunks.length);
			this.pendingEncodedBytes = 0;

			if (!this.preBufferReady) {
				this.preBufferQueue.push({
					buffer: audioBuffer,
					onPlaybackStart: pendingOnPlaybackStart,
					onPlaybackEnd: pendingOnPlaybackEnd,
				});

				if (this.preBufferQueue.length >= this.preBufferCount) {
					this.preBufferReady = true;
					this.playbackStartCallback?.();
					this.playbackStartCallback = null;
					for (const item of this.preBufferQueue) {
						await this.scheduleDecodedBuffer(
							item.buffer,
							item.onPlaybackStart,
							item.onPlaybackEnd,
						);
					}
					this.preBufferQueue.length = 0;
				}
				return;
			}
			await this.scheduleDecodedBuffer(
				audioBuffer,
				pendingOnPlaybackStart,
				pendingOnPlaybackEnd,
			);
		} catch (error) {
			if (!force) {
				return;
			}

			throw error instanceof Error
				? error
				: new Error("PROGRESSIVE_AUDIO_DECODE_FAILED");
		}
	}

	/**
	 * Queues one decoded audio buffer to start immediately after the previously
	 * scheduled buffer finishes, preserving playback order across chunks.
	 */
	private async scheduleDecodedBuffer(
		audioBuffer: AudioBuffer,
		onPlaybackStart?: () => void,
		onPlaybackEnd?: () => void,
	) {
		if (this.audioContext.state === "suspended") {
			await this.audioContext.resume();
		}

		const source = this.audioContext.createBufferSource();
		source.buffer = audioBuffer;
		source.connect(this.audioContext.destination);

		const startTime = Math.max(
			this.audioContext.currentTime,
			this.nextStartTime,
		);

		this.activeSources.push(source);
		source.start(startTime);
		window.setTimeout(
			() => {
				if (!this.stopped) onPlaybackStart?.();
			},
			Math.max(0, (startTime - this.audioContext.currentTime) * 1000),
		);
		this.nextStartTime = startTime + audioBuffer.duration;

		this.lastScheduledPlayback = new Promise<void>((resolve) => {
			source.onended = () => {
				const idx = this.activeSources.indexOf(source);
				if (idx !== -1) this.activeSources.splice(idx, 1);
				if (!this.stopped) onPlaybackEnd?.();
				resolve();
			};
		});
	}
}
