import { z } from "zod";
import { withSwagger } from "@/shared/nest/zod-swagger-metadata";
import { likesSchema } from "./onboarding";

export const userRoleSchema = withSwagger(
	z.enum(["admin", "caregiver", "senior"]),
	{
		description: "Application role assigned to the user.",
		example: "senior",
	},
);
export type UserRole = z.infer<typeof userRoleSchema>;

const sessionUserSchema = withSwagger(
	z.object({
		id: withSwagger(z.string(), {
			description: "User identifier.",
			example: "usr_123",
		}),
		email: withSwagger(z.string().email(), {
			description: "Contact email stored for the user.",
			example: "local@compy.local",
		}),
		name: withSwagger(z.string(), {
			description: "Display name for the user. Empty until onboarding.",
			example: "Ana Costa",
		}),
		role: userRoleSchema,
		likes: withSwagger(likesSchema.optional(), {
			description: "Senior preference categories, when applicable.",
		}),
		birthDate: withSwagger(z.string().optional(), {
			description: "Senior birth date as an ISO date string.",
			example: "1942-08-18",
		}),
		nickname: withSwagger(z.string().optional(), {
			description: "Friendly name Compy uses to address the person.",
			example: "Vovo Ana",
		}),
		accessCode: withSwagger(z.string().optional(), {
			description: "Short code that identifies the senior profile.",
			example: "ABCD-EFGH-IJKL",
		}),
		conversationCount: withSwagger(z.number().int().nonnegative().optional(), {
			description: "Number of recorded conversations for the senior.",
			example: 3,
		}),
		termsAcceptedAt: withSwagger(z.string().optional(), {
			description:
				"Timestamp when onboarding was completed and the terms accepted.",
			example: "2026-03-11T10:00:00.000Z",
		}),
		gender: withSwagger(z.enum(["m", "f"]).optional(), {
			description: "Senior gender used to adapt UI language.",
			example: "f",
		}),
	}),
	{
		description: "The single local user of this installation.",
	},
);

export const sessionResponseSchema = withSwagger(
	z.object({
		sessionId: withSwagger(z.string(), {
			description:
				"Opaque key for the current app visit, used to group turns into one conversation.",
			example: "visit:6d3c0f0e-7f1c-4d43-9a57-0e3c1f6f2b11",
		}),
		user: sessionUserSchema,
	}),
	{
		description: "Local user and current visit key.",
	},
);

export type LocalSession = z.infer<typeof sessionResponseSchema>;
