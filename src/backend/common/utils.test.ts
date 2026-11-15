import { describe, expect, it } from "vitest";
import { generateAccessCode } from "./utils";

describe("generateAccessCode", () => {
	it("generates a code in XXXX-XXXX-XXXX format", () => {
		const code = generateAccessCode();
		expect(code).toMatch(/^[A-Za-z0-9]{4}-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}$/);
	});

	it("contains exactly two hyphens", () => {
		const code = generateAccessCode();
		expect(code.split("-")).toHaveLength(3);
	});

	it("generates unique codes across multiple calls", () => {
		const codes = new Set(
			Array.from({ length: 200 }, () => generateAccessCode()),
		);
		// With 62^12 possible codes the probability of a collision is negligible
		expect(codes.size).toBe(200);
	});
});
