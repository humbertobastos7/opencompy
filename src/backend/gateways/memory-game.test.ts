import { describe, expect, it } from "vitest";
import {
	buildPostGameSpeechText,
	buildPostGameContextText,
} from "@/frontend/lib/memory-game";
import type { MemoryGameSessionResult } from "@/shared/contracts/chat";

const single = (
	timeTakenSeconds: number,
	errors: number,
): MemoryGameSessionResult => ({
	games: [{ timeTakenSeconds, errors, totalPairs: 6 }],
});

describe("buildPostGameSpeechText — single game", () => {
	describe("time formatting", () => {
		it("uses seconds only when under 1 minute", () => {
			const text = buildPostGameSpeechText(single(45, 0));
			expect(text).toContain("45 segundos");
			expect(text).not.toContain("minuto");
		});

		it("uses singular 'segundo' for exactly 1 second", () => {
			const text = buildPostGameSpeechText(single(1, 0));
			expect(text).toContain("1 segundo");
			expect(text).not.toContain("1 segundos");
		});

		it("uses minutes and seconds when >= 60 seconds", () => {
			const text = buildPostGameSpeechText(single(90, 0));
			expect(text).toContain("1 minuto");
			expect(text).toContain("30 segundos");
		});

		it("uses plural 'minutos' for 2+ minutes", () => {
			const text = buildPostGameSpeechText(single(125, 0));
			expect(text).toContain("2 minutos");
			expect(text).toContain("5 segundos");
		});

		it("handles exact minutes with zero seconds", () => {
			const text = buildPostGameSpeechText(single(120, 0));
			expect(text).toContain("2 minutos");
			expect(text).toContain("0 segundos");
		});
	});

	describe("error formatting", () => {
		it("says 'sem nenhum erro' for 0 errors", () => {
			expect(buildPostGameSpeechText(single(30, 0))).toContain(
				"sem nenhum erro",
			);
		});

		it("says 'com apenas 1 erro' for exactly 1 error", () => {
			expect(buildPostGameSpeechText(single(30, 1))).toContain(
				"com apenas 1 erro",
			);
		});

		it("uses plural 'erros' for 2+ errors", () => {
			expect(buildPostGameSpeechText(single(30, 5))).toContain("com 5 erros");
		});
	});

	it("always opens with the game follow-up prompt", () => {
		expect(buildPostGameSpeechText(single(60, 0))).toMatch(
			/^Então, gostaste do jogo\?/,
		);
	});
});

describe("buildPostGameSpeechText — multiple games", () => {
	it("says 'Jogaste X vezes' for multiple games", () => {
		const session: MemoryGameSessionResult = {
			games: [
				{ timeTakenSeconds: 30, errors: 3, totalPairs: 6 },
				{ timeTakenSeconds: 45, errors: 6, totalPairs: 6 },
				{ timeTakenSeconds: 20, errors: 0, totalPairs: 6 },
			],
		};
		const text = buildPostGameSpeechText(session);
		expect(text).toContain("3 vezes");
		expect(text).toContain("No último jogo");
		expect(text).toContain("20 segundos");
		expect(text).toContain("sem nenhum erro");
		expect(text).toMatch(/^Então, gostaste dos jogos\?/);
	});
});

describe("buildPostGameContextText", () => {
	it("produces correct table for a single game", () => {
		const text = buildPostGameContextText(single(30, 3));
		expect(text).toContain("Número de jogos: 1");
		expect(text).toContain("Jogo 1: erros: 3 | tempo: 30s");
	});

	it("produces correct table for multiple games", () => {
		const session: MemoryGameSessionResult = {
			games: [
				{ timeTakenSeconds: 30, errors: 3, totalPairs: 6 },
				{ timeTakenSeconds: 45, errors: 6, totalPairs: 6 },
				{ timeTakenSeconds: 20, errors: 0, totalPairs: 6 },
			],
		};
		const text = buildPostGameContextText(session);
		expect(text).toContain("Número de jogos: 3");
		expect(text).toContain("Jogo 1: erros: 3 | tempo: 30s");
		expect(text).toContain("Jogo 2: erros: 6 | tempo: 45s");
		expect(text).toContain("Jogo 3: erros: 0 | tempo: 20s");
	});

	it("formats times over 60s with minutes", () => {
		const text = buildPostGameContextText(single(90, 0));
		expect(text).toContain("tempo: 1m30s");
	});
});
