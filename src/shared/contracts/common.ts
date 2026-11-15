import { z } from "zod";
import { withSwagger } from "@/shared/nest/zod-swagger-metadata";

export const ErrorResponseSchema = withSwagger(
	z.object({
		statusCode: withSwagger(z.number().int(), {
			description: "HTTP status code returned by the API.",
			example: 400,
		}),
		code: withSwagger(z.string(), {
			description: "Machine-readable error code.",
			example: "SENIOR_NOT_FOUND",
		}),
		message: withSwagger(z.string(), {
			description: "Human-readable error message.",
			example: "SENIOR_NOT_FOUND",
		}),
		details: withSwagger(z.unknown().optional(), {
			description: "Optional structured error details.",
			example: { field: "nickname" },
		}),
		requestId: withSwagger(z.string().optional(), {
			description: "Request identifier added by the backend.",
			example: "req-123",
		}),
		timestamp: withSwagger(z.string(), {
			description: "Error timestamp in ISO format.",
			example: "2026-03-10T12:00:00.000Z",
		}),
		path: withSwagger(z.string(), {
			description: "Request path that failed.",
			example: "/api/seniors/usr_123",
		}),
	}),
	{
		description: "Standard API error envelope.",
	},
);

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
