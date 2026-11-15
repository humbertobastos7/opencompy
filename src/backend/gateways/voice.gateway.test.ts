import { describe, expect, it } from "vitest";
import type { ChatConversationMessage } from "@/shared/contracts";
import {
	applyClientConversationHistory,
	isVoiceEndConfirmationClose,
	isVoiceEndDirectRequest,
	isVoiceEndRequest,
	shouldStartMemoryGame,
} from "./voice.gateway";

describe("voice end intent detection", () => {
	it("does not treat wanting to continue as an end request", () => {
		expect(isVoiceEndRequest("quero conversar mais")).toBe(false);
		expect(isVoiceEndRequest("sim, quero continuar a conversar")).toBe(false);
		expect(isVoiceEndRequest("afinal quero conversar")).toBe(false);
	});

	it("detects explicit requests to stop talking", () => {
		expect(isVoiceEndRequest("não quero conversar mais")).toBe(true);
		expect(isVoiceEndRequest("já não quero falar agora")).toBe(true);
		expect(isVoiceEndRequest("estou cansada de conversar")).toBe(true);
		expect(isVoiceEndRequest("não me apetece conversa mais")).toBe(true);
		expect(isVoiceEndRequest("não me apetece conversar mais")).toBe(true);
		expect(isVoiceEndRequest("não quero conversa agora")).toBe(true);
		expect(isVoiceEndRequest("não quero falar de todo")).toBe(true);
	});

	it("ends immediately on direct conversation termination commands", () => {
		expect(isVoiceEndDirectRequest("termina a conversa")).toBe(true);
		expect(isVoiceEndDirectRequest("terminar conversa")).toBe(true);
		expect(isVoiceEndDirectRequest("acaba a conversa")).toBe(true);
		expect(isVoiceEndDirectRequest("fecha a conversa")).toBe(true);
	});

	it("does not end the session when the user only wants to stop a topic", () => {
		expect(isVoiceEndRequest("não quero conversar mais sobre os meus cães")).toBe(
			false,
		);
		expect(isVoiceEndRequest("não quero falar dos meus cães")).toBe(false);
		expect(isVoiceEndRequest("estou cansada de falar de cães")).toBe(false);
		expect(isVoiceEndRequest("chega de falar sobre cães")).toBe(false);
	});

	it("only closes a pending end confirmation on explicit stop language", () => {
		expect(isVoiceEndConfirmationClose("não quero continuar")).toBe(true);
		expect(isVoiceEndConfirmationClose("prefiro parar")).toBe(true);
		expect(isVoiceEndConfirmationClose("não, afinal quero conversar")).toBe(
			false,
		);
		expect(isVoiceEndConfirmationClose("sim, quero conversar mais")).toBe(
			false,
		);
	});
});

describe("memory game intent detection", () => {
	const gameOfferHistory = [
		{
			role: "assistant" as const,
			content: "Quer jogar ao jogo da memória comigo?",
		},
	];
	const repeatGameOfferHistory = [
		{
			role: "assistant" as const,
			content: "Queres jogar outra vez?",
		},
	];

	it("does not start the game from vague positive replies", () => {
		expect(shouldStartMemoryGame("sim", gameOfferHistory)).toBe(false);
		expect(shouldStartMemoryGame("ok", gameOfferHistory)).toBe(false);
		expect(shouldStartMemoryGame("pode ser", gameOfferHistory)).toBe(false);
	});

	it("starts the game from explicit game requests or acceptances", () => {
		expect(shouldStartMemoryGame("quero jogar", [])).toBe(true);
		expect(shouldStartMemoryGame("queria jogar um jogo", [])).toBe(true);
		expect(shouldStartMemoryGame("quero um jogo", [])).toBe(true);
		expect(shouldStartMemoryGame("apetece-me jogar", [])).toBe(true);
		expect(shouldStartMemoryGame("podemos jogar o jogo", [])).toBe(true);
		expect(shouldStartMemoryGame("iniciar o jogo", [])).toBe(true);
		expect(shouldStartMemoryGame("começar o jogo", [])).toBe(true);
		expect(shouldStartMemoryGame("começa o jogo da memória", [])).toBe(true);
		expect(shouldStartMemoryGame("abre o jogo", [])).toBe(true);
		expect(shouldStartMemoryGame("jogo da memória", [])).toBe(false);
		expect(shouldStartMemoryGame("sim, quero jogar", gameOfferHistory)).toBe(
			true,
		);
		expect(
			shouldStartMemoryGame("vamos ao jogo da memória", gameOfferHistory),
		).toBe(true);
	});

	it("does not start the game from explicit negative requests", () => {
		expect(shouldStartMemoryGame("não quero jogar", [])).toBe(false);
		expect(shouldStartMemoryGame("não quero um jogo", [])).toBe(false);
	});

	it("starts the game from simple acceptance after a repeat-game question", () => {
		expect(shouldStartMemoryGame("sim", repeatGameOfferHistory)).toBe(true);
		expect(shouldStartMemoryGame("ok", repeatGameOfferHistory)).toBe(true);
		expect(shouldStartMemoryGame("pode ser", repeatGameOfferHistory)).toBe(
			true,
		);
	});

	it("recognises varied repeat-game phrasings from the assistant", () => {
		const repeatPhrasings = [
			"Apetece-lhe jogar novamente?",
			"Quer voltar a jogar?",
			"Mais um jogo?",
			"Joga mais uma vez?",
			"Quer jogar mais um bocadinho?",
			"Quer repetir o jogo?",
			"Quer jogar de novo?",
			"Vamos a outra partida?",
			"Quer jogar outra vez?",
		];
		for (const content of repeatPhrasings) {
			const history = [{ role: "assistant" as const, content }];
			expect(
				shouldStartMemoryGame("sim", history),
				`bare "sim" should start the game after: ${content}`,
			).toBe(true);
		}
	});

	it("starts the game when the senior asks to play again in their own words", () => {
		// Real transcripts captured from production logs where the assistant's
		// reply was only an implicit invitation ("beat your record"), so the
		// request must be recognised from the senior's utterance alone.
		const selfDrivenReplays = [
			"Meu, só jogo outra vez.",
			"Eu jogo outra vez.",
			"Quero jogar de novo.",
			"Vamos jogar outra vez.",
			"Mais um jogo.",
			"Bora outra partida.",
			"Jogamos novamente.",
		];
		for (const transcript of selfDrivenReplays) {
			expect(
				shouldStartMemoryGame(transcript, []),
				`should start from: ${transcript}`,
			).toBe(true);
		}
	});

	it("does not start when the senior declines to play again", () => {
		expect(shouldStartMemoryGame("não jogo outra vez", [])).toBe(false);
		expect(shouldStartMemoryGame("não, não quero jogar de novo", [])).toBe(
			false,
		);
	});

	it("accepts a replay offer that only exists in the client-synced history", () => {
		// Simulates a reconnect/HTTP-fallback: this socket's backend history is
		// empty, but the client carries the authoritative offer with the turn.
		const backendHistory: ChatConversationMessage[] = [];
		expect(shouldStartMemoryGame("sim", backendHistory)).toBe(false);

		applyClientConversationHistory(backendHistory, [
			{ role: "user", content: "gostei muito do jogo" },
			{ role: "assistant", content: "Queres jogar outra vez?" },
		]);

		expect(shouldStartMemoryGame("sim", backendHistory)).toBe(true);
	});

	it("does not arm a bare 'sim' from unrelated repeat/play mentions", () => {
		const benign = [
			// Generic first-time offer still requires explicit acceptance.
			"Quer jogar ao jogo da memória comigo?",
			// Play verb and repeat cue live in different clauses/topics.
			"Foi bom jogar consigo. Quer que lhe conte mais uma história?",
			// Assistant asking the senior to repeat what they said.
			"Desculpe, não apanhei bem. Pode repetir, por favor?",
		];
		for (const content of benign) {
			const history = [{ role: "assistant" as const, content }];
			expect(
				shouldStartMemoryGame("sim", history),
				`bare "sim" should NOT start the game after: ${content}`,
			).toBe(false);
		}
	});
});
