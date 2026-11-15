import { z } from "zod";
import { withSwagger } from "@/shared/nest/zod-swagger-metadata";

export const PlanResponseSchema = withSwagger(
	z.object({
		id: withSwagger(z.string(), {
			description: "Plan identifier.",
			example: "plan_123",
		}),
		name: withSwagger(z.string(), {
			description: "Plan name.",
			example: "efanor",
		}),
		maxSeniors: withSwagger(z.number().nullable(), {
			description: "Maximum seniors allowed. null = unlimited.",
			example: null,
		}),
		maxTalkingMinutesPerMonth: withSwagger(z.number().nullable(), {
			description: "Maximum talking minutes per month. null = unlimited.",
			example: null,
		}),
		createdAt: withSwagger(z.string(), {
			description: "Plan creation timestamp.",
			example: "2026-03-10T12:00:00.000Z",
		}),
	}),
	{
		description: "Plan visible to administrators.",
	},
);

export const PlansListResponseSchema = withSwagger(
	z.array(PlanResponseSchema),
	{ description: "List of all plans." },
);

export const CreatePlanRequestSchema = withSwagger(
	z.object({
		name: withSwagger(z.string().min(1).max(100), {
			description: "Plan name.",
			example: "efanor",
		}),
		maxSeniors: withSwagger(z.number().int().positive().optional(), {
			description: "Maximum seniors allowed. Omit for unlimited.",
			example: 50,
		}),
		maxTalkingMinutesPerMonth: withSwagger(
			z.number().int().positive().optional(),
			{
				description: "Maximum talking minutes per month. Omit for unlimited.",
				example: 600,
			},
		),
	}),
	{ description: "Payload to create a plan." },
);

export const UpdatePlanRequestSchema = withSwagger(
	z.object({
		name: withSwagger(z.string().min(1).max(100).optional(), {
			description: "Updated plan name.",
			example: "efanor-pro",
		}),
		maxSeniors: withSwagger(z.number().int().positive().nullable().optional(), {
			description: "Updated maximum seniors. null = unlimited.",
			example: null,
		}),
		maxTalkingMinutesPerMonth: withSwagger(
			z.number().int().positive().nullable().optional(),
			{
				description: "Updated maximum talking minutes. null = unlimited.",
				example: null,
			},
		),
	}),
	{ description: "Partial update payload for a plan." },
);

export const PlanIdParamSchema = withSwagger(
	z.object({
		planId: withSwagger(z.string().min(1), {
			description: "Plan identifier.",
			example: "plan_123",
		}),
	}),
	{ description: "Plan route parameter." },
);

export const InstitutionResponseSchema = withSwagger(
	z.object({
		id: withSwagger(z.string(), {
			description: "Institution identifier.",
			example: "inst_123",
		}),
		type: withSwagger(z.enum(["ipss", "family"]), {
			description: "Institution type: ipss or family household.",
			example: "ipss",
		}),
		designation: withSwagger(z.string(), {
			description: "Institution name.",
			example: "Compy Demo Care Center",
		}),
		location: withSwagger(z.string().nullable(), {
			description: "Institution location text, when available.",
			example: "Lisbon, Portugal",
		}),
		planId: withSwagger(z.string().nullable(), {
			description: "Associated plan identifier, when assigned.",
			example: "plan_123",
		}),
		planName: withSwagger(z.string().nullable(), {
			description: "Associated plan name, when assigned.",
			example: "efanor",
		}),
		createdAt: withSwagger(z.string(), {
			description: "Institution creation timestamp.",
			example: "2026-03-10T12:00:00.000Z",
		}),
	}),
	{
		description: "Institution visible to administrators.",
	},
);

export const InstitutionsListResponseSchema = withSwagger(
	z.array(InstitutionResponseSchema),
	{
		description: "List of all institutions.",
	},
);

export const CreateInstitutionRequestSchema = withSwagger(
	z.object({
		type: withSwagger(z.enum(["ipss", "family"]).default("ipss"), {
			description: "Institution type.",
			example: "ipss",
		}),
		designation: withSwagger(z.string().min(1).max(255), {
			description: "Institution display name.",
			example: "Porto Senior Living",
		}),
		location: withSwagger(z.string().min(1).max(1000).optional(), {
			description: "Institution location description.",
			example: "Porto, Portugal",
		}),
		planId: withSwagger(z.string().min(1).optional(), {
			description: "Optional plan assignment.",
			example: "plan_123",
		}),
	}),
	{
		description: "Payload used to create an institution.",
	},
);

export const AdminDashboardResponseSchema = withSwagger(
	z.object({
		totalInstitutions: withSwagger(z.number(), {
			description: "Total institutions in the system.",
			example: 4,
		}),
		totalCaregivers: withSwagger(z.number(), {
			description: "Total caregiver accounts.",
			example: 12,
		}),
		totalSeniors: withSwagger(z.number(), {
			description: "Total senior accounts.",
			example: 43,
		}),
		totalActiveUsers: withSwagger(z.number(), {
			description: "Number of active non-disabled users.",
			example: 50,
		}),
		totalConversations: withSwagger(z.number(), {
			description: "Total conversations recorded in the platform.",
			example: 841,
		}),
		seniorsWithoutInstitution: withSwagger(z.number(), {
			description: "Number of seniors not assigned to an institution.",
			example: 2,
		}),
		caregiversWithoutInstitution: withSwagger(z.number(), {
			description: "Number of caregivers not assigned to an institution.",
			example: 1,
		}),
	}),
	{
		description: "Administrative dashboard metrics.",
	},
);

export const InstitutionIdParamSchema = withSwagger(
	z.object({
		institutionId: withSwagger(z.string().min(1), {
			description: "Institution identifier.",
			example: "inst_123",
		}),
	}),
	{
		description: "Institution route parameter.",
	},
);

export const CaregiverIdParamSchema = withSwagger(
	z.object({
		caregiverId: withSwagger(z.string().min(1), {
			description: "Caregiver identifier.",
			example: "usr_caregiver_123",
		}),
	}),
	{
		description: "Caregiver route parameter.",
	},
);

export const SeniorAdminIdParamSchema = withSwagger(
	z.object({
		seniorId: withSwagger(z.string().min(1), {
			description: "Senior identifier.",
			example: "usr_senior_123",
		}),
	}),
	{
		description: "Senior route parameter used by admin endpoints.",
	},
);

export const CaregiverAdminResponseSchema = withSwagger(
	z.object({
		id: withSwagger(z.string(), {
			description: "Caregiver user identifier.",
			example: "usr_caregiver_123",
		}),
		email: withSwagger(z.string().email(), {
			description: "Caregiver email.",
			example: "caregiver@example.com",
		}),
		fullName: withSwagger(z.string(), {
			description: "Caregiver full name.",
			example: "Maria Ferreira",
		}),
		organizationId: withSwagger(z.string().nullable(), {
			description: "Institution id currently assigned to the caregiver.",
			example: "inst_123",
		}),
		organizationName: withSwagger(z.string().nullable(), {
			description: "Institution name currently assigned to the caregiver.",
			example: "Compy Demo Care Center",
		}),
		isActive: withSwagger(z.boolean(), {
			description: "Whether the account is active.",
			example: true,
		}),
		createdAt: withSwagger(z.string(), {
			description: "Account creation timestamp.",
			example: "2026-03-10T12:00:00.000Z",
		}),
	}),
	{
		description: "Administrator view of a caregiver account.",
	},
);

export const CaregiversListResponseSchema = withSwagger(
	z.array(CaregiverAdminResponseSchema),
	{
		description: "List of all caregiver accounts.",
	},
);

export const CreateCaregiverRequestSchema = withSwagger(
	z.object({
		email: withSwagger(z.string().email(), {
			description: "Caregiver email address.",
			example: "caregiver@example.com",
		}),
		password: withSwagger(z.string().min(6), {
			description: "Initial caregiver password.",
			example: "caregiver123",
		}),
		fullName: withSwagger(z.string().min(1).max(255), {
			description: "Caregiver full name.",
			example: "Maria Ferreira",
		}),
		institutionId: withSwagger(z.string().min(1).optional(), {
			description: "Optional institution assignment.",
			example: "inst_123",
		}),
	}),
	{
		description:
			"Payload used by administrators to create a caregiver account.",
	},
);

export const UpdateInstitutionRequestSchema = withSwagger(
	z.object({
		type: withSwagger(z.enum(["ipss", "family"]).optional(), {
			description: "Updated institution type.",
			example: "ipss",
		}),
		designation: withSwagger(z.string().min(1).max(255).optional(), {
			description: "Updated institution designation.",
			example: "Porto Senior Living",
		}),
		location: withSwagger(z.string().min(1).max(1000).nullable().optional(), {
			description: "Updated institution location description.",
			example: "Porto, Portugal",
		}),
		planId: withSwagger(z.string().min(1).nullable().optional(), {
			description: "Updated plan assignment. null removes the current plan.",
			example: "plan_123",
		}),
	}),
	{
		description: "Partial update payload for an institution.",
	},
);

export const UpdateCaregiverRequestSchema = withSwagger(
	z.object({
		email: withSwagger(z.string().email().optional(), {
			description: "Updated caregiver email.",
			example: "caregiver@example.com",
		}),
		fullName: withSwagger(z.string().min(1).max(255).optional(), {
			description: "Updated caregiver full name.",
			example: "Maria Ferreira",
		}),
		institutionId: withSwagger(z.string().min(1).nullable().optional(), {
			description: "Updated caregiver institution assignment.",
			example: "inst_123",
		}),
		isActive: withSwagger(z.boolean().optional(), {
			description: "Whether the caregiver account remains active.",
			example: true,
		}),
	}),
	{
		description: "Partial update payload for caregiver accounts.",
	},
);

export const ReassignInstitutionRequestSchema = withSwagger(
	z.object({
		institutionId: withSwagger(z.string().min(1).nullable(), {
			description:
				"New institution assignment. Use null to remove the current assignment.",
			example: "inst_123",
		}),
	}),
	{
		description: "Payload used to explicitly reassign a caregiver or senior.",
	},
);

export const SeniorAdminResponseSchema = withSwagger(
	z.object({
		id: withSwagger(z.string(), {
			description: "Senior user identifier.",
			example: "usr_senior_123",
		}),
		email: withSwagger(z.string().email(), {
			description: "Senior email address.",
			example: "senior@example.com",
		}),
		fullName: withSwagger(z.string(), {
			description: "Senior full name.",
			example: "Antonio Silva",
		}),
		nickname: withSwagger(z.string().nullable(), {
			description: "Senior nickname.",
			example: "Toni",
		}),
		birthDate: withSwagger(z.string().nullable(), {
			description: "Senior birth date as ISO date string.",
			example: "1948-05-20",
		}),
		accessCode: withSwagger(z.string(), {
			description: "Senior access code used for sign-in.",
			example: "ABCD-EFGH-IJKL",
		}),
		organizationId: withSwagger(z.string().nullable(), {
			description: "Institution id currently assigned to the senior.",
			example: "inst_123",
		}),
		organizationName: withSwagger(z.string().nullable(), {
			description: "Institution name currently assigned to the senior.",
			example: "Compy Demo Care Center",
		}),
		gender: withSwagger(z.enum(["m", "f"]).nullable(), {
			description: "Senior gender (m = masculine, f = feminine).",
			example: "f",
		}),
		isActive: withSwagger(z.boolean(), {
			description: "Whether the account is active.",
			example: true,
		}),
		createdAt: withSwagger(z.string(), {
			description: "Account creation timestamp.",
			example: "2026-03-10T12:00:00.000Z",
		}),
	}),
	{
		description: "Administrator view of a senior account.",
	},
);

export const SeniorsAdminListResponseSchema = withSwagger(
	z.array(SeniorAdminResponseSchema),
	{
		description: "List of all senior accounts.",
	},
);

export const CreateSeniorRequestSchema = withSwagger(
	z.object({
		fullName: withSwagger(z.string().min(1).max(255), {
			description: "Senior full name.",
			example: "Antonio Silva",
		}),
		gender: withSwagger(z.enum(["m", "f"]), {
			description: "Senior gender (m = masculine, f = feminine).",
			example: "m",
		}),
		birthDate: withSwagger(z.coerce.date(), {
			description: "Senior birth date.",
			example: "1948-05-20T00:00:00.000Z",
		}),
		institutionId: withSwagger(z.string().min(1).optional(), {
			description: "Optional institution assignment.",
			example: "inst_123",
		}),
	}),
	{
		description: "Payload used by administrators to create a senior account.",
	},
);

export const UpdateSeniorRequestSchema = withSwagger(
	z.object({
		email: withSwagger(z.string().email().optional(), {
			description: "Updated senior email address.",
			example: "senior@example.com",
		}),
		fullName: withSwagger(z.string().min(1).max(255).optional(), {
			description: "Updated full name.",
			example: "Antonio Silva",
		}),
		nickname: withSwagger(z.string().min(1).max(255).optional(), {
			description: "Updated nickname.",
			example: "Toni",
		}),
		birthDate: withSwagger(z.coerce.date().optional(), {
			description: "Updated birth date.",
			example: "1948-05-20T00:00:00.000Z",
		}),
		institutionId: withSwagger(z.string().min(1).nullable().optional(), {
			description: "Updated institution assignment.",
			example: "inst_123",
		}),
		gender: withSwagger(z.enum(["m", "f"]).optional(), {
			description: "Senior gender (m = masculine, f = feminine).",
			example: "f",
		}),
		isActive: withSwagger(z.boolean().optional(), {
			description: "Whether the senior account remains active.",
			example: true,
		}),
	}),
	{
		description: "Partial update payload for senior accounts.",
	},
);

export const RegenerateSeniorAccessCodeResponseSchema = withSwagger(
	z.object({
		seniorId: withSwagger(z.string(), {
			description: "Senior identifier.",
			example: "usr_senior_123",
		}),
		accessCode: withSwagger(z.string(), {
			description: "Newly generated access code.",
			example: "WXYZ-1234-ABCD",
		}),
	}),
	{
		description: "Result returned after regenerating a senior access code.",
	},
);

export const InstitutionDetailResponseSchema = withSwagger(
	z.object({
		institution: InstitutionResponseSchema,
		caregivers: withSwagger(z.array(CaregiverAdminResponseSchema), {
			description: "Caregivers currently assigned to the institution.",
		}),
		seniors: withSwagger(z.array(SeniorAdminResponseSchema), {
			description: "Seniors currently assigned to the institution.",
		}),
	}),
	{
		description:
			"Institution detail including assigned caregivers and seniors.",
	},
);

export type InstitutionResponse = z.infer<typeof InstitutionResponseSchema>;
export type InstitutionDetailResponse = z.infer<
	typeof InstitutionDetailResponseSchema
>;
export type AdminDashboardResponse = z.infer<
	typeof AdminDashboardResponseSchema
>;
export type CreateInstitutionRequest = z.infer<
	typeof CreateInstitutionRequestSchema
>;
export type CaregiverAdminResponse = z.infer<
	typeof CaregiverAdminResponseSchema
>;
export type CreateCaregiverRequest = z.infer<
	typeof CreateCaregiverRequestSchema
>;
export type UpdateInstitutionRequest = z.infer<
	typeof UpdateInstitutionRequestSchema
>;
export type UpdateCaregiverRequest = z.infer<
	typeof UpdateCaregiverRequestSchema
>;
export type ReassignInstitutionRequest = z.infer<
	typeof ReassignInstitutionRequestSchema
>;
export type SeniorAdminResponse = z.infer<typeof SeniorAdminResponseSchema>;
export type CreateSeniorRequest = z.infer<typeof CreateSeniorRequestSchema>;
export type UpdateSeniorRequest = z.infer<typeof UpdateSeniorRequestSchema>;
export type RegenerateSeniorAccessCodeResponse = z.infer<
	typeof RegenerateSeniorAccessCodeResponseSchema
>;
export type PlanResponse = z.infer<typeof PlanResponseSchema>;
export type CreatePlanRequest = z.infer<typeof CreatePlanRequestSchema>;
export type UpdatePlanRequest = z.infer<typeof UpdatePlanRequestSchema>;
