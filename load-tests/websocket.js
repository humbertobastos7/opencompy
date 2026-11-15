/**
 * WebSocket voice gateway load test — concurrent voice sessions.
 *
 * Simulates concurrent connections of the local user, sending text turns, and closing conversations.
 * Does NOT test actual audio (that requires real microphone data).
 *
 * Run:
 *   k6 run load-tests/websocket.js
 *   k6 run --vus 10 --duration 60s load-tests/websocket.js
 */
import ws from "k6/ws";
import { check, sleep } from "k6";
import { Rate, Counter } from "k6/metrics";

const WS_URL = __ENV.WS_URL || "ws://localhost:3000";
const errorRate = new Rate("ws_errors");
const turnsCompleted = new Counter("turns_completed");

export const options = {
	stages: [
		{ duration: "10s", target: 5 },
		{ duration: "40s", target: 15 },
		{ duration: "10s", target: 0 },
	],
	thresholds: {
		ws_errors: ["rate<0.05"], // less than 5% WS errors
		turns_completed: ["count>50"], // at least 50 turns completed
	},
};

export default function () {
	let sessionReady = false;
	let conversationId = null;
	let turnsDone = 0;
	const TARGET_TURNS = 3;

	const wsRes = ws.connect(
		`${WS_URL}/api/chat/voice/ws`,
		{},
		function (socket) {
			socket.on("open", () => {
				// Create voice session
				socket.send(
					JSON.stringify({
						type: "session.create",
						session: {
							voice: "default",
							input_audio_transcription: { language: "pt" },
						},
					}),
				);
			});

			socket.on("message", (data) => {
				const msg = JSON.parse(data);

				if (msg.type === "session.ready") {
					sessionReady = true;
					// Send first text turn
					socket.send(
						JSON.stringify({
							type: "text.turn",
							text: `Olá, como está o dia hoje? Turno ${turnsDone + 1}`,
						}),
					);
				}

				if (msg.type === "turn.done") {
					conversationId = msg.conversation_id;
					turnsCompleted.add(1);
					turnsDone++;

					if (turnsDone < TARGET_TURNS) {
						sleep(0.5);
						socket.send(
							JSON.stringify({
								type: "text.turn",
								text: `Fala-me mais sobre a tua família. Turno ${turnsDone + 1}`,
							}),
						);
					} else {
						// Close conversation
						if (conversationId) {
							socket.send(
								JSON.stringify({
									type: "conversation.close",
									conversation_id: conversationId,
									user_outcome: "Sucesso",
								}),
							);
						} else {
							socket.close();
						}
					}
				}

				if (msg.type === "conversation.closed") {
					socket.close();
				}

				if (msg.type === "error" && msg.code !== "RATE_LIMITED") {
					errorRate.add(1);
					console.error(`[ws] error: ${msg.code} — ${msg.message}`);
					socket.close();
				}
			});

			socket.on("error", (e) => {
				errorRate.add(1);
				console.error("[ws] socket error:", e);
			});

			// Safety timeout — close after 90s regardless
			socket.setTimeout(() => {
				socket.close();
			}, 90_000);
		},
	);

	check(wsRes, { "ws connected": (r) => r && r.status === 101 });
}
