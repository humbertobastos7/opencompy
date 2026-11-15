process.env.NODE_ENV = "test";
process.env.DATABASE_URL ??= "http://localhost:5432/compy-test";
process.env.AI_SERVICE_URL ??= "http://127.0.0.1:3001";

import { InternalServerErrorException } from "@nestjs/common";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LocalSession } from "@/shared/contracts";
import { AiClientService } from "./ai.client";

const localSession: LocalSession = {
	sessionId: "visit:test",
	user: {
		id: "usr-voice-1",
		email: "senior@example.com",
		name: "Senior Teste",
		role: "senior",
	},
};

/**
 * Builds a JSON response matching the AI-service contract used by the client tests.
 */
const createJsonResponse = (payload: unknown) =>
	new Response(JSON.stringify(payload), {
		status: 200,
		headers: {
			"Content-Type": "application/json",
		},
	});

describe("AiClientService", () => {
	let fetchMock: ReturnType<typeof vi.fn>;
	let service: AiClientService;

	beforeEach(() => {
		fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);
		service = new AiClientService();
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it("wraps streaming requests with localSession and payload", async () => {
		fetchMock
			.mockResolvedValueOnce(
				createJsonResponse({
					success: true,
					stream_id: "123e4567-e89b-12d3-a456-426614174000",
				}),
			)
			.mockResolvedValueOnce(createJsonResponse({ success: true }))
			.mockResolvedValueOnce(
				createJsonResponse({
					final_transcript: "Ola",
				}),
			);

		await service.startVoiceStreaming(localSession, {
			session: {},
			audio_language: "pt-PT",
		});
		await service.sendVoiceStreamingChunk(localSession, {
			stream_id: "123e4567-e89b-12d3-a456-426614174000",
			audio_chunk_base64: "ZmFrZS1jaHVuaw==",
		});
		await service.closeVoiceStreaming(localSession, {
			stream_id: "123e4567-e89b-12d3-a456-426614174000",
		});

		const requestBodies = fetchMock.mock.calls.map((call) =>
			JSON.parse(String((call[1] as RequestInit | undefined)?.body ?? "{}")),
		);

		expect(requestBodies).toEqual([
			expect.objectContaining({
				localSession,
				payload: expect.objectContaining({
					session: expect.any(Object),
					audio_language: "pt-PT",
				}),
			}),
			expect.objectContaining({
				localSession,
				payload: {
					stream_id: "123e4567-e89b-12d3-a456-426614174000",
					audio_chunk_base64: "ZmFrZS1jaHVuaw==",
				},
			}),
			expect.objectContaining({
				localSession,
				payload: {
					stream_id: "123e4567-e89b-12d3-a456-426614174000",
				},
			}),
		]);
	});

	it("fails fast when an internal payload is missing", async () => {
		await expect(
			service.startVoiceStreaming(localSession, undefined as never),
		).rejects.toBeInstanceOf(InternalServerErrorException);

		expect(fetchMock).not.toHaveBeenCalled();
	});
});
