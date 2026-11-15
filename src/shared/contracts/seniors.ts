import { z } from "zod";
import { withSwagger } from "@/shared/nest/zod-swagger-metadata";
import { likesSchema } from "./onboarding";

export const SeniorIdParam = z.object({
	seniorId: z.string().min(1),
});

export const ConversationReportParam = z.object({
	seniorId: z.string().min(1),
	date: z.string().min(1),
});

const seniorMemorySchema = withSwagger(
	z.object({
		id: withSwagger(z.string(), {
			description: "Persisted memory identifier.",
			example: "memory_123",
		}),
		content: withSwagger(z.string(), {
			description: "Short fact learned from previous conversations.",
			example: "Gosta de falar sobre o jardim e os netos.",
		}),
		createdAt: withSwagger(z.string(), {
			description: "Timestamp when the memory was stored.",
			example: "2026-04-22T14:20:00.000Z",
		}),
	}),
	{
		description: "Single memory extracted from the senior's conversations.",
	},
);

export const SeniorResponseSchema = withSwagger(
	z.object({
		id: withSwagger(z.string(), {
			description: "Senior user identifier.",
			example: "usr_senior_123",
		}),
		fullName: withSwagger(z.string(), {
			description: "Senior full name.",
			example: "Antonio Silva",
		}),
		email: withSwagger(z.string(), {
			description: "Senior email address.",
			example: "senior@example.com",
		}),
		nickname: withSwagger(z.string(), {
			description: "Preferred display name.",
			example: "Toni",
		}),
		birthDate: withSwagger(z.string(), {
			description: "Birth date as an ISO date string.",
			example: "1948-05-20",
		}),
		photoDataUrl: withSwagger(z.string().nullable(), {
			description: "Optional stored profile photo as a data URL.",
			example: "data:image/jpeg;base64,...",
		}),
		family: withSwagger(z.string().nullable(), {
			description: "Living arrangement or family context.",
			example: "Vive com a filha.",
		}),
		gender: withSwagger(z.enum(["m", "f"]).nullable(), {
			description: "Senior gender used to adapt copy and context.",
			example: "m",
		}),
		diagnoses: withSwagger(z.array(z.string()), {
			description: "Relevant diagnoses registered for the senior.",
			example: ["demência ligeira"],
		}),
		avoidTopics: withSwagger(z.array(z.string()), {
			description: "Topics the assistant should avoid or handle carefully.",
			example: ["falecimento recente"],
		}),
		likes: withSwagger(likesSchema, {
			description: "Structured preference categories.",
		}),
		memories: withSwagger(z.array(seniorMemorySchema), {
			description:
				"Relevant facts learned from the senior's past conversations.",
		}),
		accessCode: withSwagger(z.string().nullable(), {
			description: "Senior access code when available.",
			example: "ABCD-EFGH-IJKL",
		}),
	}),
	{
		description: "Senior profile visible to the authenticated user.",
	},
);

export const ConversationReportResponseSchema = withSwagger(
	z.object({
		date: withSwagger(z.string(), {
			description: "Requested report date.",
			example: "2026-03-10",
		}),
		totalConversations: withSwagger(z.number(), {
			description: "Number of conversations recorded on the requested date.",
			example: 3,
		}),
		averageDuration: withSwagger(z.number(), {
			description: "Average conversation duration in minutes.",
			example: 8.5,
		}),
		conversations: withSwagger(
			z.array(
				withSwagger(
					z.object({
						startTime: withSwagger(z.string(), {
							description: "Conversation start timestamp.",
							example: "2026-03-10T09:12:00.000Z",
						}),
						duration: withSwagger(z.number(), {
							description: "Conversation duration in minutes.",
							example: 7,
						}),
						status: withSwagger(
							z.enum(["successful", "cancelled", "abandoned"]),
							{
								description:
									"Session outcome. Successful = closed with AI summary. Cancelled = closed without summary. Abandoned = never closed.",
								example: "successful",
							},
						),
						userOutcome: withSwagger(
							z.enum(["Sucesso", "Cancelada", "Falha"]).nullable(),
							{
								description:
									"Session outcome reported by the senior user via the end-session modal.",
								example: "Sucesso",
							},
						),
						userNote: withSwagger(z.string().nullable(), {
							description: "Optional note left by the senior user.",
							example: "Estava um pouco cansado.",
						}),
						emotionalTone: withSwagger(z.string(), {
							description:
								"High-level emotional classification, or sem_registo when no tone could be derived.",
							example: "positive",
						}),
						summary: withSwagger(z.string(), {
							description:
								"Short natural-language summary. May be empty when the session ended without enough content.",
							example: "Talked about family and favorite meals.",
						}),
						mainTopics: withSwagger(z.array(z.string()), {
							description: "Main topics detected in the conversation.",
							example: ["family", "food"],
						}),
						keyPoints: withSwagger(z.array(z.string()), {
							description: "Important points extracted from the conversation.",
							example: ["Mentioned daughter visiting", "Asked for soup recipe"],
						}),
					}),
					{
						description:
							"Single session entry for the requested date, including sessions without AI summary content.",
					},
				),
			),
			{
				description:
					"Conversation/session entries for the requested date, including failed or aborted sessions when no summary was generated.",
			},
		),
		sessionLog: withSwagger(
			z.array(
				z.object({
					startTime: z.string(),
					status: z.enum(["successful", "cancelled", "abandoned"]),
					userOutcome: z.enum(["Sucesso", "Cancelada", "Falha"]).nullable(),
					userNote: z.string().nullable(),
				}),
			),
			{
				description:
					"Session log for the requested date. Includes all sessions regardless of content.",
			},
		),
	}),
	{
		description: "Aggregated conversation report for a single senior and date.",
	},
);

export const SeniorNicknameSchema = withSwagger(
	z.object({
		nickname: withSwagger(z.string(), {
			description: "New nickname for the senior.",
			example: "Toni",
		}),
	}),
	{
		description: "Nickname update payload.",
	},
);

export const SeniorsListResponseSchema = z.array(SeniorResponseSchema);

export const SuccessResponseSchema = withSwagger(
	z.object({
		success: withSwagger(z.boolean(), {
			description: "Whether the operation completed successfully.",
			example: true,
		}),
	}),
	{
		description: "Generic success response.",
	},
);

export const AvailableReportDatesResponseSchema = z.array(
	z.object({
		seniorId: z.string(),
		dates: z.array(z.string()),
	}),
);

export const EmotionalTrendEntrySchema = z.object({
	date: withSwagger(z.string(), {
		description: "Date in YYYY-MM-DD format.",
		example: "2026-03-10",
	}),
	emotionalTone: withSwagger(z.string(), {
		description: "Dominant emotional tone for that day.",
		example: "positivo",
	}),
	conversationCount: withSwagger(z.number(), {
		description: "Number of conversations on that day.",
		example: 2,
	}),
});

export const EmotionalTrendResponseSchema = withSwagger(
	z.object({
		seniorId: withSwagger(z.string(), {
			description: "Senior identifier.",
			example: "usr_senior_123",
		}),
		entries: withSwagger(z.array(EmotionalTrendEntrySchema), {
			description: "Daily emotional tone entries ordered oldest to newest.",
		}),
		hasNegativeAlert: withSwagger(z.boolean(), {
			description:
				"True when the last three or more consecutive conversations all have a negative tone.",
			example: false,
		}),
	}),
	{
		description:
			"Emotional tone trend for a senior over their recent conversations.",
	},
);

export type EmotionalTrendResponse = z.infer<
	typeof EmotionalTrendResponseSchema
>;

export const SeniorSettingsResponseSchema = withSwagger(
	z.object({
		id: withSwagger(z.string(), {
			description: "Settings record identifier.",
			example: "settings_123",
		}),
		seniorId: withSwagger(z.string(), {
			description: "Owner senior identifier.",
			example: "usr_senior_123",
		}),
		silenceTimeoutMs: withSwagger(z.number(), {
			description: "Silence threshold before the assistant responds.",
			example: 1200,
		}),
		chatPersonality: withSwagger(z.enum(["formal", "informal"]), {
			description: "Conversation tone used by the assistant.",
			example: "informal",
		}),
	}),
	{
		description: "Runtime conversation settings for a senior.",
	},
);

export const SeniorSettingsUpdateSchema = withSwagger(
	z.object({
		silenceTimeoutMs: withSwagger(z.number().optional(), {
			description: "Optional silence timeout override in milliseconds.",
			example: 1500,
		}),
		chatPersonality: withSwagger(z.enum(["formal", "informal"]).optional(), {
			description: "Optional conversation tone override.",
			example: "formal",
		}),
	}),
	{
		description: "Partial update payload for senior conversation settings.",
	},
);

export type SeniorResponse = z.infer<typeof SeniorResponseSchema>;
export type ConversationReportResponse = z.infer<
	typeof ConversationReportResponseSchema
>;
export type SeniorNicknameRequest = z.infer<typeof SeniorNicknameSchema>;
export type SeniorsListResponse = z.infer<typeof SeniorsListResponseSchema>;
export type AvailableReportDatesResponse = z.infer<
	typeof AvailableReportDatesResponseSchema
>;
export type SeniorSettingsResponse = z.infer<
	typeof SeniorSettingsResponseSchema
>;
export type SeniorSettingsUpdateRequest = z.infer<
	typeof SeniorSettingsUpdateSchema
>;

export const SeniorProfileUpdateSchema = withSwagger(
	z
		.object({
			fullName: withSwagger(z.string().min(1).max(255).optional(), {
				description:
					"Editable full name shown to caregivers and in the senior profile.",
				example: "António Silva",
			}),
			birthDate: withSwagger(z.string().optional(), {
				description: "Birth date in YYYY-MM-DD or ISO format.",
				example: "1948-05-20",
			}),
			family: withSwagger(z.string().nullable().optional(), {
				description: "Living arrangement (sozinho, família, lar).",
				example: "sozinho",
			}),
			gender: withSwagger(z.enum(["m", "f"]).nullable().optional(), {
				description: "Gender used to personalize the senior experience.",
				example: "f",
			}),
			diagnoses: withSwagger(z.array(z.string()).optional(), {
				description: "Relevant diagnoses or clinical notes.",
				example: ["hipertensão", "demência ligeira"],
			}),
			avoidTopics: withSwagger(z.array(z.string()).optional(), {
				description: "Sensitive topics the assistant should avoid.",
				example: ["hospitalização recente"],
			}),
			initialContext: withSwagger(z.string().min(1).max(2000).optional(), {
				description:
					"Free-form onboarding context to store as a Compy context note.",
				example:
					"Gosta de falar do Benfica mas prefere evitar falar dos filhos.",
			}),
			photoDataUrl: withSwagger(
				z
					.string()
					.max(2_000_000)
					.regex(
						/^data:image\/(jpeg|png|webp|gif);base64,[A-Za-z0-9+/]+=*$/,
						"photoDataUrl must be a base64-encoded image data URL (jpeg, png, webp, or gif).",
					)
					.nullable()
					.optional(),
				{
					description: "Profile photo stored as a base64 image data URL.",
					example: "data:image/jpeg;base64,...",
				},
			),
		})
		.refine((payload) => Object.keys(payload).length > 0, {
			message: "At least one field must be provided.",
		}),
	{ description: "Partial profile update payload for a senior." },
);

export type SeniorProfileUpdateRequest = z.infer<
	typeof SeniorProfileUpdateSchema
>;
export type SeniorMemory = z.infer<typeof seniorMemorySchema>;
