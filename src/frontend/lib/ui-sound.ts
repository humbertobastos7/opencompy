type UiSoundPlayOptions = {
	playbackRate?: number;
};

type WindowWithWebkitAudioContext = Window & {
	webkitAudioContext?: typeof AudioContext;
};

const getAudioContextConstructor = () => {
	if (typeof window === "undefined") return undefined;
	return (
		window.AudioContext ??
		(window as WindowWithWebkitAudioContext).webkitAudioContext
	);
};

export class UiSoundPlayer {
	private audioContext: AudioContext | null = null;
	private readonly buffers = new Map<string, AudioBuffer>();
	private readonly pendingBuffers = new Map<
		string,
		Promise<AudioBuffer | null>
	>();
	private readonly activeOneShots = new Set<AudioBufferSourceNode>();
	private readonly loopSources = new Map<string, AudioBufferSourceNode>();
	private readonly loopVersions = new Map<string, number>();

	setAudioContext(audioContext: AudioContext) {
		if (audioContext.state !== "closed") {
			this.audioContext = audioContext;
		}
	}

	async unlock(audioContext?: AudioContext) {
		if (audioContext) {
			this.setAudioContext(audioContext);
		}

		const ctx = await this.ensureRunningContext({ createIfMissing: true });
		if (!ctx) return;

		const silentBuffer = ctx.createBuffer(1, 1, ctx.sampleRate);
		const source = ctx.createBufferSource();
		source.buffer = silentBuffer;
		source.connect(ctx.destination);
		source.start(0);
	}

	preload(sources: string[]) {
		void (async () => {
			const ctx = await this.ensureRunningContext({ createIfMissing: false });
			if (!ctx) return;
			await Promise.allSettled(sources.map((src) => this.loadBuffer(src, ctx)));
		})();
	}

	play(src: string, options: UiSoundPlayOptions = {}) {
		void this.playOnce(src, options);
	}

	startLoop(src: string, options: UiSoundPlayOptions = {}) {
		const version = (this.loopVersions.get(src) ?? 0) + 1;
		this.loopVersions.set(src, version);
		this.stopLoopSource(src);

		void (async () => {
			const ctx = await this.ensureRunningContext({ createIfMissing: false });
			if (!ctx || this.loopVersions.get(src) !== version) return;

			const buffer = await this.loadBuffer(src, ctx);
			if (!buffer || this.loopVersions.get(src) !== version) return;

			const source = this.createSource(ctx, buffer, options);
			source.loop = true;
			this.loopSources.set(src, source);
			source.start(0);
		})();
	}

	stopLoop(src: string) {
		this.loopVersions.set(src, (this.loopVersions.get(src) ?? 0) + 1);
		this.stopLoopSource(src);
	}

	stopAll() {
		this.stopOneShots();
		for (const src of this.loopSources.keys()) {
			this.stopLoop(src);
		}
	}

	stopOneShots() {
		for (const source of this.activeOneShots) {
			try {
				source.stop();
			} catch {
				/* already stopped */
			}
		}
		this.activeOneShots.clear();
	}

	private async playOnce(src: string, options: UiSoundPlayOptions) {
		const ctx = await this.ensureRunningContext({ createIfMissing: false });
		if (!ctx) return;

		const buffer = await this.loadBuffer(src, ctx);
		if (!buffer) return;

		this.stopOneShots();
		const source = this.createSource(ctx, buffer, options);
		this.activeOneShots.add(source);
		source.onended = () => {
			this.activeOneShots.delete(source);
		};
		source.start(0);
	}

	private createSource(
		ctx: AudioContext,
		buffer: AudioBuffer,
		options: UiSoundPlayOptions,
	) {
		const source = ctx.createBufferSource();
		source.buffer = buffer;
		source.playbackRate.value = options.playbackRate ?? 1;
		source.connect(ctx.destination);
		return source;
	}

	private stopLoopSource(src: string) {
		const source = this.loopSources.get(src);
		if (!source) return;
		this.loopSources.delete(src);
		try {
			source.stop();
		} catch {
			/* already stopped */
		}
	}

	private async ensureRunningContext(input: { createIfMissing: boolean }) {
		const ctx = input.createIfMissing
			? this.getOrCreateContext()
			: this.audioContext?.state !== "closed"
				? this.audioContext
				: null;
		if (!ctx) return null;

		if (ctx.state === "suspended") {
			await ctx.resume().catch(() => {});
		}

		return ctx.state === "running" ? ctx : null;
	}

	private getOrCreateContext() {
		if (this.audioContext?.state !== "closed") {
			return this.audioContext;
		}

		const AudioContextConstructor = getAudioContextConstructor();
		if (!AudioContextConstructor) return null;

		this.audioContext = new AudioContextConstructor();
		return this.audioContext;
	}

	private loadBuffer(src: string, ctx: AudioContext) {
		const cached = this.buffers.get(src);
		if (cached) return Promise.resolve(cached);

		const pending = this.pendingBuffers.get(src);
		if (pending) return pending;

		const nextPending = fetch(src, { cache: "force-cache" })
			.then((response) => {
				if (!response.ok) return null;
				return response.arrayBuffer();
			})
			.then((arrayBuffer) =>
				arrayBuffer ? ctx.decodeAudioData(arrayBuffer.slice(0)) : null,
			)
			.then((buffer) => {
				if (buffer) {
					this.buffers.set(src, buffer);
				}
				return buffer;
			})
			.catch(() => null)
			.finally(() => {
				this.pendingBuffers.delete(src);
			});

		this.pendingBuffers.set(src, nextPending);
		return nextPending;
	}
}
