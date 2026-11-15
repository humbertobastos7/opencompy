const readInt16 = (buffer: Uint8Array, index: number) =>
	new DataView(buffer.buffer, buffer.byteOffset + index * 2, 2).getInt16(
		0,
		true,
	);

const writeInt16 = (view: DataView, index: number, value: number) => {
	const clamped = Math.max(-32768, Math.min(32767, Math.round(value)));
	view.setInt16(index * 2, clamped, true);
};

/**
 * Converts mono 16-bit little-endian PCM between sample rates. This keeps the
 * browser capture path provider-agnostic while OpenAI receives its required
 * 24 kHz PCM input.
 */
export const resamplePcm16 = (
	input: Uint8Array,
	fromRate: number,
	toRate: number,
): Uint8Array => {
	if (fromRate === toRate || input.byteLength < 4) {
		return input;
	}

	const inputSamples = Math.floor(input.byteLength / 2);
	const outputSamples = Math.max(
		1,
		Math.round((inputSamples * toRate) / fromRate),
	);
	const output = new ArrayBuffer(outputSamples * 2);
	const view = new DataView(output);
	const ratio = fromRate / toRate;

	for (let i = 0; i < outputSamples; i += 1) {
		const sourceIndex = i * ratio;
		const leftIndex = Math.min(inputSamples - 1, Math.floor(sourceIndex));
		const rightIndex = Math.min(inputSamples - 1, leftIndex + 1);
		const fraction = sourceIndex - leftIndex;
		const left = readInt16(input, leftIndex);
		const right = readInt16(input, rightIndex);
		writeInt16(view, i, left + (right - left) * fraction);
	}

	return new Uint8Array(output);
};

export const pcm16ToWav = (
	input: Uint8Array,
	sampleRate: number,
): Uint8Array => {
	const headerBytes = 44;
	const output = new ArrayBuffer(headerBytes + input.byteLength);
	const view = new DataView(output);
	const bytes = new Uint8Array(output);
	const writeString = (offset: number, value: string) => {
		for (let i = 0; i < value.length; i += 1) {
			view.setUint8(offset + i, value.charCodeAt(i));
		}
	};

	writeString(0, "RIFF");
	view.setUint32(4, 36 + input.byteLength, true);
	writeString(8, "WAVE");
	writeString(12, "fmt ");
	view.setUint32(16, 16, true);
	view.setUint16(20, 1, true);
	view.setUint16(22, 1, true);
	view.setUint32(24, sampleRate, true);
	view.setUint32(28, sampleRate * 2, true);
	view.setUint16(32, 2, true);
	view.setUint16(34, 16, true);
	writeString(36, "data");
	view.setUint32(40, input.byteLength, true);
	bytes.set(input, headerBytes);

	return bytes;
};
