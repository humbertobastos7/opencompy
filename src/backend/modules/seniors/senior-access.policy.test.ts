import { describe, expect, it } from "vitest";
import { SeniorAccessPolicy } from "./senior-access.policy";

describe("SeniorAccessPolicy", () => {
	it("allows a senior to access their own record", async () => {
		const policy = new SeniorAccessPolicy(
			{
				findSeniorProfile: async (userId: string) => ({ userId }),
				findUserOrganization: async () => ({ organizationId: "loc-1" }),
			} as never,
			{
				hasAccessToLocation: async () => true,
			} as never,
		);

		await expect(
			policy.assertSeniorAccess(
				{
					user: {
						id: "senior-1",
					},
				} as never,
				"senior-1",
			),
		).resolves.toEqual({ userId: "senior-1" });
	});

	it("rejects users without location access", async () => {
		const policy = new SeniorAccessPolicy(
			{
				findSeniorProfile: async (userId: string) => ({ userId }),
				findUserOrganization: async () => ({ organizationId: "loc-1" }),
			} as never,
			{
				hasAccessToLocation: async () => false,
			} as never,
		);

		await expect(
			policy.assertSeniorAccess(
				{
					user: {
						id: "caregiver-1",
					},
				} as never,
				"senior-1",
			),
		).rejects.toThrow("YOU_DO_NOT_HAVE_ACCESS_TO_THIS_LOCATION");
	});
});
