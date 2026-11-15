import { describe, expect, it } from "vitest";
import { InMemoryRateLimitService } from "./in-memory-rate-limit.service";

describe("InMemoryRateLimitService", () => {
	it("allows requests below the limit", () => {
		const service = new InMemoryRateLimitService();

		service.enforce("signin:127.0.0.1", 2, 1000);
		service.enforce("signin:127.0.0.1", 2, 1000);

		expect(true).toBe(true);
	});

	it("throws when the limit is exceeded", () => {
		const service = new InMemoryRateLimitService();

		service.enforce("signin:127.0.0.1", 1, 1000);

		expect(() => service.enforce("signin:127.0.0.1", 1, 1000)).toThrow(
			"RATE_LIMIT_EXCEEDED",
		);
	});
});
