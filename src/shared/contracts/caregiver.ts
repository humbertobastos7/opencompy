import { z } from "zod";
import { withSwagger } from "@/shared/nest/zod-swagger-metadata";

export const CaregiverSeniorIdParamSchema = withSwagger(
	z.object({
		seniorId: withSwagger(z.string().min(1), {
			description: "Senior user identifier.",
			example: "usr_senior_123",
		}),
	}),
	{
		description:
			"Route parameter used to target a senior from caregiver endpoints.",
	},
);

export const CaregiverNoteIdParamSchema = withSwagger(
	z.object({
		seniorId: withSwagger(z.string().min(1), {
			description: "Senior user identifier.",
			example: "usr_senior_123",
		}),
		noteId: withSwagger(z.string().min(1), {
			description: "Caregiver note identifier.",
			example: "note_123",
		}),
	}),
	{
		description: "Route parameters used to target a caregiver note.",
	},
);

export const CaregiverNoteCategorySchema = withSwagger(
	z.enum([
		"Humor",
		"Saúde",
		"Alimentação",
		"Sono",
		"Mobilidade",
		"Social",
		"Medicação",
		"Geral",
	]),
	{
		description: "Optional category used to organize caregiver notes.",
		example: "Saúde",
	},
);

export const CreateCaregiverNoteRequestSchema = withSwagger(
	z.object({
		content: withSwagger(z.string().min(1).max(2000), {
			description: "Caregiver note content.",
			example: "Senior was more talkative today and asked about family photos.",
		}),
		category: withSwagger(CaregiverNoteCategorySchema.nullable().optional(), {
			description: "Optional category for the note.",
			example: "Social",
		}),
		pinned: withSwagger(z.boolean().optional(), {
			description: "Whether the note should stay pinned at the top.",
			example: false,
		}),
	}),
	{
		description: "Payload used to store a caregiver note for a senior.",
	},
);

export const UpdateCaregiverNoteRequestSchema = withSwagger(
	z
		.object({
			content: withSwagger(z.string().min(1).max(2000).optional(), {
				description: "Updated caregiver note content.",
				example: "Prefers to be called Mimi in the morning.",
			}),
			category: withSwagger(CaregiverNoteCategorySchema.nullable().optional(), {
				description: "Updated category for the note.",
				example: "Geral",
			}),
			pinned: withSwagger(z.boolean().optional(), {
				description: "Updated pinned state.",
				example: true,
			}),
		})
		.refine((payload) => Object.keys(payload).length > 0, {
			message: "At least one field must be provided.",
		}),
	{
		description: "Payload used to update a caregiver note.",
	},
);

export const DeleteCaregiverNoteResponseSchema = withSwagger(
	z.object({
		success: withSwagger(z.boolean(), {
			description: "Whether the note was deleted.",
			example: true,
		}),
	}),
	{
		description: "Result returned after deleting a caregiver note.",
	},
);

export const CaregiverNoteResponseSchema = withSwagger(
	z.object({
		id: withSwagger(z.string(), {
			description: "Caregiver note identifier.",
			example: "note_123",
		}),
		seniorId: withSwagger(z.string(), {
			description: "Senior owner identifier.",
			example: "usr_senior_123",
		}),
		caregiverId: withSwagger(z.string(), {
			description: "Caregiver author identifier.",
			example: "usr_caregiver_123",
		}),
		content: withSwagger(z.string(), {
			description: "Stored caregiver note text.",
			example: "Senior was more talkative today and asked about family photos.",
		}),
		category: withSwagger(CaregiverNoteCategorySchema.nullable(), {
			description: "Optional note category.",
			example: "Social",
		}),
		pinned: withSwagger(z.boolean(), {
			description: "Whether this note is pinned.",
			example: false,
		}),
		createdAt: withSwagger(z.string(), {
			description: "Creation timestamp.",
			example: "2026-03-10T14:30:00.000Z",
		}),
	}),
	{
		description: "Stored caregiver note entry.",
	},
);

export const CaregiverNotesResponseSchema = withSwagger(
	z.object({
		seniorId: withSwagger(z.string(), {
			description: "Senior owner identifier.",
			example: "usr_senior_123",
		}),
		notes: withSwagger(z.array(CaregiverNoteResponseSchema), {
			description: "Caregiver notes ordered newest first.",
		}),
	}),
	{
		description: "Caregiver notes for one senior.",
	},
);

export const CaregiverSeniorSummaryResponseSchema = withSwagger(
	z.object({
		seniorId: withSwagger(z.string(), {
			description: "Senior identifier.",
			example: "usr_senior_123",
		}),
		fullName: withSwagger(z.string(), {
			description: "Senior full name.",
			example: "Antonio Silva",
		}),
		nickname: withSwagger(z.string(), {
			description: "Display nickname.",
			example: "Toni",
		}),
		conversationCount: withSwagger(z.number(), {
			description: "Total number of recorded conversations.",
			example: 12,
		}),
		lastConversationAt: withSwagger(z.string().nullable(), {
			description: "Most recent conversation timestamp.",
			example: "2026-03-10T10:00:00.000Z",
		}),
		averageConversationDurationMinutes: withSwagger(z.number(), {
			description: "Average recorded conversation duration in minutes.",
			example: 8,
		}),
		notesCount: withSwagger(z.number(), {
			description: "Total caregiver notes stored for the senior.",
			example: 4,
		}),
	}),
	{
		description: "Operational caregiver summary for a single senior.",
	},
);

export const SeniorConversationCountResponseSchema = withSwagger(
	z.object({
		seniorId: withSwagger(z.string(), {
			description: "Senior identifier.",
			example: "usr_senior_123",
		}),
		total: withSwagger(z.number(), {
			description: "Total number of conversations recorded for the senior.",
			example: 12,
		}),
	}),
	{
		description: "Conversation count for a single senior.",
	},
);

export const CaregiverActivityItemSchema = withSwagger(
	z.object({
		type: withSwagger(z.enum(["conversation", "caregiver_note"]), {
			description: "Type of activity entry.",
			example: "conversation",
		}),
		timestamp: withSwagger(z.string(), {
			description: "Activity timestamp.",
			example: "2026-03-10T10:00:00.000Z",
		}),
		title: withSwagger(z.string(), {
			description: "Short activity title.",
			example: "Conversation recorded",
		}),
		description: withSwagger(z.string(), {
			description: "Human-readable activity description.",
			example: "Talked about family and favorite meals.",
		}),
		metadata: withSwagger(z.record(z.string(), z.string()).optional(), {
			description: "Optional activity metadata for the frontend.",
			example: { conversationId: "conv_123" },
		}),
	}),
	{
		description: "Single activity item shown in caregiver timelines.",
	},
);

export const CaregiverSeniorActivityResponseSchema = withSwagger(
	z.object({
		seniorId: withSwagger(z.string(), {
			description: "Senior identifier.",
			example: "usr_senior_123",
		}),
		items: withSwagger(z.array(CaregiverActivityItemSchema), {
			description: "Recent activity ordered from newest to oldest.",
		}),
	}),
	{
		description: "Activity feed for a single senior.",
	},
);

export const CaregiverDashboardSeniorSchema = withSwagger(
	z.object({
		seniorId: withSwagger(z.string(), {
			description: "Senior identifier.",
			example: "usr_senior_123",
		}),
		fullName: withSwagger(z.string(), {
			description: "Senior full name.",
			example: "Antonio Silva",
		}),
		nickname: withSwagger(z.string(), {
			description: "Senior nickname.",
			example: "Toni",
		}),
		photoDataUrl: withSwagger(z.string().nullable(), {
			description: "Senior profile photo stored as a data URL.",
			example: null,
		}),
		institutionName: withSwagger(z.string().nullable(), {
			description: "Institution the senior belongs to.",
			example: "Centro Social de Vale de Cambra",
		}),
		accessCode: withSwagger(z.string().nullable(), {
			description: "Senior access code used to link them to a caregiver.",
			example: "A1B2-C3D4",
		}),
		conversationCount: withSwagger(z.number(), {
			description: "Total number of recorded conversations.",
			example: 12,
		}),
		lastConversationAt: withSwagger(z.string().nullable(), {
			description: "Most recent conversation timestamp.",
			example: "2026-03-10T10:00:00.000Z",
		}),
	}),
	{
		description: "Senior row shown in the caregiver dashboard.",
	},
);

export const CaregiverDashboardResponseSchema = withSwagger(
	z.object({
		totalSeniors: withSwagger(z.number(), {
			description: "Number of seniors accessible to the caregiver.",
			example: 8,
		}),
		totalConversations: withSwagger(z.number(), {
			description: "Total recorded conversations across accessible seniors.",
			example: 124,
		}),
		seniors: withSwagger(z.array(CaregiverDashboardSeniorSchema), {
			description: "Operational summary rows for accessible seniors.",
		}),
	}),
	{
		description: "Caregiver dashboard aggregate.",
	},
);

export type CaregiverSeniorIdParam = z.infer<
	typeof CaregiverSeniorIdParamSchema
>;
export type CaregiverNoteIdParam = z.infer<typeof CaregiverNoteIdParamSchema>;
export type CaregiverNoteCategory = z.infer<typeof CaregiverNoteCategorySchema>;
export type CreateCaregiverNoteRequest = z.infer<
	typeof CreateCaregiverNoteRequestSchema
>;
export type UpdateCaregiverNoteRequest = z.infer<
	typeof UpdateCaregiverNoteRequestSchema
>;
export type DeleteCaregiverNoteResponse = z.infer<
	typeof DeleteCaregiverNoteResponseSchema
>;
export type CaregiverNoteResponse = z.infer<typeof CaregiverNoteResponseSchema>;
export type CaregiverNotesResponse = z.infer<
	typeof CaregiverNotesResponseSchema
>;
export type CaregiverSeniorSummaryResponse = z.infer<
	typeof CaregiverSeniorSummaryResponseSchema
>;
export type SeniorConversationCountResponse = z.infer<
	typeof SeniorConversationCountResponseSchema
>;
export type CaregiverSeniorActivityResponse = z.infer<
	typeof CaregiverSeniorActivityResponseSchema
>;
export type CaregiverDashboardResponse = z.infer<
	typeof CaregiverDashboardResponseSchema
>;

export const CaregiverDailyOverviewEntrySchema = withSwagger(
	z.object({
		date: withSwagger(z.string(), {
			description: "Date in YYYY-MM-DD format.",
			example: "2026-03-30",
		}),
		totalConversations: withSwagger(z.number(), {
			description:
				"Total conversations recorded on this day across all seniors.",
			example: 8,
		}),
		totalMinutes: withSwagger(z.number(), {
			description: "Total conversation duration in minutes on this day.",
			example: 45,
		}),
		averageMinutes: withSwagger(z.number(), {
			description: "Average conversation duration in minutes on this day.",
			example: 6,
		}),
		seniorsCount: withSwagger(z.number(), {
			description:
				"Number of distinct seniors who had at least one conversation on this day.",
			example: 3,
		}),
		sessions: withSwagger(
			z.object({
				successful: z.number(),
				cancelled: z.number(),
				failed: z.number(),
				abandoned: z.number(),
			}),
			{
				description:
					"Session outcome breakdown. Successful = user reported Sucesso. Cancelled = user reported Cancelada. Failed = user reported Falha. Abandoned = never closed.",
			},
		),
		emotions: withSwagger(
			z.object({
				positive: z.number(),
				neutral: z.number(),
				negative: z.number(),
				unknown: z.number(),
			}),
			{
				description:
					"Emotional tone distribution across all conversations on this day.",
			},
		),
		seniorBreakdown: withSwagger(
			z.array(
				z.object({
					seniorId: z.string(),
					fullName: z.string(),
					nickname: z.string(),
					sessions: z.object({
						successful: z.number(),
						cancelled: z.number(),
						failed: z.number(),
						abandoned: z.number(),
					}),
					dominantEmotion: z.enum([
						"positive",
						"neutral",
						"negative",
						"unknown",
					]),
					sessionLogs: z.array(
						z.object({
							outcome: z.enum(["Sucesso", "Cancelada", "Falha", "Abandonada"]),
							note: z.string().nullable(),
							createdAt: z.string(),
						}),
					),
				}),
			),
			{
				description: "Per-senior session and emotion breakdown for this day.",
			},
		),
	}),
	{
		description:
			"Aggregated daily overview entry for all seniors of a caregiver.",
	},
);

export const CaregiverDailyOverviewResponseSchema = withSwagger(
	z.object({
		entries: withSwagger(z.array(CaregiverDailyOverviewEntrySchema), {
			description:
				"Daily entries ordered from most recent to oldest. Only days with data are included.",
		}),
	}),
	{
		description:
			"Daily activity overview for all seniors accessible to the caregiver.",
	},
);

export type CaregiverDailyOverviewEntry = z.infer<
	typeof CaregiverDailyOverviewEntrySchema
>;
export type CaregiverDailyOverviewResponse = z.infer<
	typeof CaregiverDailyOverviewResponseSchema
>;

export const ElevenLabsQuotaResponseSchema = withSwagger(
	z.object({
		characterCount: withSwagger(z.number(), {
			description: "Characters used so far this billing period.",
			example: 53004,
		}),
		characterLimit: withSwagger(z.number(), {
			description: "Monthly character limit for the current plan.",
			example: 112208,
		}),
		remaining: withSwagger(z.number(), {
			description: "Characters remaining until the monthly limit is reached.",
			example: 59204,
		}),
	}),
	{
		description: "ElevenLabs subscription quota.",
	},
);

export type ElevenLabsQuotaResponse = z.infer<
	typeof ElevenLabsQuotaResponseSchema
>;

export const CaregiverInstitutionResponseSchema = withSwagger(
	z.object({
		type: withSwagger(z.enum(["ipss", "family"]), {
			description: "Institution type.",
			example: "family",
		}),
		designation: withSwagger(z.string().nullable(), {
			description: "Institution name.",
			example: "Família Silva",
		}),
	}),
	{
		description: "Institution info for the authenticated caregiver.",
	},
);

export const UpdateCaregiverProfileRequestSchema = withSwagger(
	z.object({
		fullName: withSwagger(z.string().min(1), {
			description: "Caregiver full name.",
			example: "Ana Silva",
		}),
		email: withSwagger(z.string().email(), {
			description: "Caregiver email address.",
			example: "ana.silva@example.com",
		}),
	}),
	{
		description: "Payload to update the caregiver's name and email.",
	},
);

export const UpdateCaregiverProfileResponseSchema = withSwagger(
	z.object({
		success: z.literal(true),
	}),
	{
		description: "Result returned after updating the caregiver profile.",
	},
);

export const CreateFamilySeniorRequestSchema = withSwagger(
	z.object({
		fullName: withSwagger(z.string().min(1), {
			description: "Senior full name.",
			example: "António Silva",
		}),
		gender: withSwagger(z.enum(["m", "f"]).nullable().optional(), {
			description: "Senior gender.",
			example: "m",
		}),
		birthDate: withSwagger(z.coerce.date(), {
			description: "Senior birth date.",
			example: "1948-05-20T00:00:00.000Z",
		}),
	}),
	{
		description: "Payload to create a senior in the caregiver's family.",
	},
);

export const CreateFamilySeniorResponseSchema = withSwagger(
	z.object({
		seniorId: withSwagger(z.string(), {
			description: "Created senior user identifier.",
			example: "usr_senior_123",
		}),
		accessCode: withSwagger(z.string(), {
			description: "Access code for the senior to log in.",
			example: "ABCD-EFGH-IJKL",
		}),
	}),
	{
		description: "Result of creating a senior in a family institution.",
	},
);

export type CaregiverInstitutionResponse = z.infer<
	typeof CaregiverInstitutionResponseSchema
>;
export type UpdateCaregiverProfileRequest = z.infer<
	typeof UpdateCaregiverProfileRequestSchema
>;
export type UpdateCaregiverProfileResponse = z.infer<
	typeof UpdateCaregiverProfileResponseSchema
>;
export type CreateFamilySeniorRequest = z.infer<
	typeof CreateFamilySeniorRequestSchema
>;
export type CreateFamilySeniorResponse = z.infer<
	typeof CreateFamilySeniorResponseSchema
>;
