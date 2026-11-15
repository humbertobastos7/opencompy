import type {
	MemoryGameResult,
	MemoryGameSessionResult,
} from "@/shared/contracts/chat";

function formatTime(timeTakenSeconds: number): string {
	const mins = Math.floor(timeTakenSeconds / 60);
	const secs = timeTakenSeconds % 60;
	return mins > 0
		? `${mins} minuto${mins > 1 ? "s" : ""} e ${secs} segundo${secs !== 1 ? "s" : ""}`
		: `${secs} segundo${secs !== 1 ? "s" : ""}`;
}

function formatErrors(errors: number): string {
	if (errors === 0) return "sem nenhum erro";
	if (errors === 1) return "com apenas 1 erro";
	return `com ${errors} erros`;
}

export function buildPostGameSpeechText(
	session: MemoryGameSessionResult,
): string {
	const count = session.games.length;
	if (count === 1) {
		const result = session.games[0] as MemoryGameResult;
		return `Então, gostaste do jogo? Encontraste todos os pares em ${formatTime(result.timeTakenSeconds)}, ${formatErrors(result.errors)}!`;
	}
	const lastResult = session.games[count - 1] as MemoryGameResult;
	return `Então, gostaste dos jogos? Jogaste ${count} vezes. No último jogo, encontraste todos os pares em ${formatTime(lastResult.timeTakenSeconds)}, ${formatErrors(lastResult.errors)}!`;
}

export function buildPostGameContextText(
	session: MemoryGameSessionResult,
): string {
	const lines = [
		`O utilizador acabou de jogar o jogo da memória.`,
		`Número de jogos: ${session.games.length}`,
		...session.games.map((g, i) => {
			const mins = Math.floor(g.timeTakenSeconds / 60);
			const secs = g.timeTakenSeconds % 60;
			const timeStr = mins > 0 ? `${mins}m${secs}s` : `${secs}s`;
			return `Jogo ${i + 1}: erros: ${g.errors} | tempo: ${timeStr}`;
		}),
	];
	return lines.join("\n");
}
