import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, UseGuards } from "@nestjs/common";
import {
	ApiBadRequestResponse,
	ApiBody,
	ApiCreatedResponse,
	ApiOkResponse,
	ApiOperation,
	ApiTags,
	ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import {
	AdminDashboardResponseSchema,
	CaregiverAdminResponseSchema,
	CaregiverIdParamSchema,
	CaregiversListResponseSchema,
	CreateCaregiverRequestSchema,
	CreateInstitutionRequestSchema,
	CreatePlanRequestSchema,
	CreateSeniorRequestSchema,
	ErrorResponseSchema,
	InstitutionDetailResponseSchema,
	InstitutionResponseSchema,
	InstitutionIdParamSchema,
	InstitutionsListResponseSchema,
	PlanIdParamSchema,
	PlanResponseSchema,
	PlansListResponseSchema,
	ReassignInstitutionRequestSchema,
	RegenerateSeniorAccessCodeResponseSchema,
	SeniorAdminIdParamSchema,
	SeniorAdminResponseSchema,
	SeniorsAdminListResponseSchema,
	SuccessResponseSchema,
	UpdateCaregiverRequestSchema,
	UpdateInstitutionRequestSchema,
	UpdatePlanRequestSchema,
	UpdateSeniorRequestSchema,
	type LocalSession,
} from "@/shared/contracts";
import { CurrentSession } from "@/backend/common/current-session.decorator";
import { AdminGuard } from "@/backend/common/admin.guard";
import {
	swaggerRequestBody,
	swaggerResponse,
} from "@/shared/nest/zod-openapi";
import { ZodValidationPipe } from "@/shared/nest/zod-validation.pipe";
import { AdminService } from "./admin.service";

@ApiTags("admin")
@UseGuards(AdminGuard)
@Controller("admin")
export class AdminController {
	constructor(
		@Inject(AdminService)
		private readonly adminService: AdminService,
	) {}

	// ── GET ──────────────────────────────────────────────────────────────────

	@Get("dashboard")
	@ApiOperation({
		summary: "Get admin dashboard metrics",
		description: "Returns high-level administrative metrics for the full platform.",
	})
	@ApiOkResponse(
		swaggerResponse(AdminDashboardResponseSchema, {
			description: "Administrative dashboard metrics.",
		}),
	)
	@ApiUnauthorizedResponse(
		swaggerResponse(ErrorResponseSchema, {
			description: "Authentication is required or the user is not an admin.",
		}),
	)
	async getDashboard(@CurrentSession() session: LocalSession) {
		return AdminDashboardResponseSchema.parse(
			await this.adminService.getDashboard(session),
		);
	}

	@Get("institutions")
	@ApiOperation({
		summary: "List all institutions",
		description: "Returns all institutions visible to administrators.",
	})
	@ApiOkResponse(
		swaggerResponse(InstitutionsListResponseSchema, {
			description: "All institutions in the system.",
		}),
	)
	@ApiUnauthorizedResponse(
		swaggerResponse(ErrorResponseSchema, {
			description: "Authentication is required or the user is not an admin.",
		}),
	)
	async getInstitutions(@CurrentSession() session: LocalSession) {
		return InstitutionsListResponseSchema.parse(
			await this.adminService.getInstitutions(session),
		);
	}

	@Get("institutions/:institutionId")
	@ApiOperation({
		summary: "Get institution detail",
		description:
			"Returns one institution together with the caregivers and seniors assigned to it.",
	})
	@ApiOkResponse(
		swaggerResponse(InstitutionDetailResponseSchema, {
			description: "Institution detail and assigned users.",
		}),
	)
	@ApiUnauthorizedResponse(
		swaggerResponse(ErrorResponseSchema, {
			description: "Authentication is required or the user is not an admin.",
		}),
	)
	async getInstitution(
		@CurrentSession() session: LocalSession,
		@Param(new ZodValidationPipe(InstitutionIdParamSchema)) params: unknown,
	) {
		const { institutionId } = params as { institutionId: string };
		return InstitutionDetailResponseSchema.parse(
			await this.adminService.getInstitution(session, institutionId),
		);
	}

	@Get("caregivers")
	@ApiOperation({
		summary: "List all caregivers",
		description: "Returns all caregiver accounts with their institution assignment.",
	})
	@ApiOkResponse(
		swaggerResponse(CaregiversListResponseSchema, {
			description: "All caregiver accounts.",
		}),
	)
	@ApiUnauthorizedResponse(
		swaggerResponse(ErrorResponseSchema, {
			description: "Authentication is required or the user is not an admin.",
		}),
	)
	async getCaregivers(@CurrentSession() session: LocalSession) {
		return CaregiversListResponseSchema.parse(
			await this.adminService.getCaregivers(session),
		);
	}

	@Get("caregivers/:caregiverId")
	@ApiOperation({
		summary: "Get caregiver detail",
		description: "Returns one caregiver account by id.",
	})
	@ApiOkResponse(
		swaggerResponse(CaregiverAdminResponseSchema, {
			description: "Requested caregiver account.",
		}),
	)
	@ApiUnauthorizedResponse(
		swaggerResponse(ErrorResponseSchema, {
			description: "Authentication is required or the user is not an admin.",
		}),
	)
	async getCaregiver(
		@CurrentSession() session: LocalSession,
		@Param(new ZodValidationPipe(CaregiverIdParamSchema)) params: unknown,
	) {
		const { caregiverId } = params as { caregiverId: string };
		return CaregiverAdminResponseSchema.parse(
			await this.adminService.getCaregiver(session, caregiverId),
		);
	}

	@Get("seniors")
	@ApiOperation({
		summary: "List all seniors",
		description: "Returns all senior accounts with access code and institution assignment.",
	})
	@ApiOkResponse(
		swaggerResponse(SeniorsAdminListResponseSchema, {
			description: "All senior accounts.",
		}),
	)
	@ApiUnauthorizedResponse(
		swaggerResponse(ErrorResponseSchema, {
			description: "Authentication is required or the user is not an admin.",
		}),
	)
	async getSeniors(@CurrentSession() session: LocalSession) {
		return SeniorsAdminListResponseSchema.parse(
			await this.adminService.getSeniors(session),
		);
	}

	@Get("seniors/:seniorId")
	@ApiOperation({
		summary: "Get senior detail",
		description: "Returns one senior account by id.",
	})
	@ApiOkResponse(
		swaggerResponse(SeniorAdminResponseSchema, {
			description: "Requested senior account.",
		}),
	)
	@ApiUnauthorizedResponse(
		swaggerResponse(ErrorResponseSchema, {
			description: "Authentication is required or the user is not an admin.",
		}),
	)
	async getSenior(
		@CurrentSession() session: LocalSession,
		@Param(new ZodValidationPipe(SeniorAdminIdParamSchema)) params: unknown,
	) {
		const { seniorId } = params as { seniorId: string };
		return SeniorAdminResponseSchema.parse(
			await this.adminService.getSenior(session, seniorId),
		);
	}

	// ── POST ─────────────────────────────────────────────────────────────────

	@Post("institutions")
	@ApiOperation({
		summary: "Create an institution",
		description: "Creates a new institution that can later be assigned to caregivers and seniors.",
	})
	@ApiBody(swaggerRequestBody(CreateInstitutionRequestSchema))
	@ApiCreatedResponse(
		swaggerResponse(InstitutionResponseSchema, {
			description: "Created institution.",
		}),
	)
	@ApiBadRequestResponse(
		swaggerResponse(ErrorResponseSchema, {
			description: "Validation error.",
		}),
	)
	@ApiUnauthorizedResponse(
		swaggerResponse(ErrorResponseSchema, {
			description: "Authentication is required or the user is not an admin.",
		}),
	)
	async createInstitution(
		@CurrentSession() session: LocalSession,
		@Body(new ZodValidationPipe(CreateInstitutionRequestSchema))
		body: unknown,
	) {
		return InstitutionResponseSchema.parse(
			await this.adminService.createInstitution(session, body as never),
		);
	}

	@Post("caregivers")
	@ApiOperation({
		summary: "Create a caregiver account",
		description: "Creates a caregiver account and optional institution assignment.",
	})
	@ApiBody(swaggerRequestBody(CreateCaregiverRequestSchema))
	@ApiCreatedResponse(
		swaggerResponse(CaregiverAdminResponseSchema, {
			description: "Created caregiver account.",
		}),
	)
	@ApiBadRequestResponse(
		swaggerResponse(ErrorResponseSchema, {
			description: "Validation error, duplicate email, or invalid institution.",
		}),
	)
	@ApiUnauthorizedResponse(
		swaggerResponse(ErrorResponseSchema, {
			description: "Authentication is required or the user is not an admin.",
		}),
	)
	async createCaregiver(
		@CurrentSession() session: LocalSession,
		@Body(new ZodValidationPipe(CreateCaregiverRequestSchema))
		body: unknown,
	) {
		return CaregiverAdminResponseSchema.parse(
			await this.adminService.createCaregiver(session, body as never),
		);
	}

	@Post("seniors")
	@ApiOperation({
		summary: "Create a senior account",
		description: "Creates a senior account, generates an access code, and initializes the senior profile and settings.",
	})
	@ApiBody(swaggerRequestBody(CreateSeniorRequestSchema))
	@ApiCreatedResponse(
		swaggerResponse(SeniorAdminResponseSchema, {
			description: "Created senior account.",
		}),
	)
	@ApiBadRequestResponse(
		swaggerResponse(ErrorResponseSchema, {
			description: "Validation error, duplicate email, or invalid institution.",
		}),
	)
	@ApiUnauthorizedResponse(
		swaggerResponse(ErrorResponseSchema, {
			description: "Authentication is required or the user is not an admin.",
		}),
	)
	async createSenior(
		@CurrentSession() session: LocalSession,
		@Body(new ZodValidationPipe(CreateSeniorRequestSchema))
		body: unknown,
	) {
		return SeniorAdminResponseSchema.parse(
			await this.adminService.createSenior(session, body as never),
		);
	}

	@Post("seniors/:seniorId/regenerate-access-code")
	@ApiOperation({
		summary: "Regenerate a senior access code",
		description:
			"Generates and persists a new access code for a senior account.",
	})
	@ApiCreatedResponse(
		swaggerResponse(RegenerateSeniorAccessCodeResponseSchema, {
			description: "Newly generated senior access code.",
		}),
	)
	@ApiUnauthorizedResponse(
		swaggerResponse(ErrorResponseSchema, {
			description: "Authentication is required or the user is not an admin.",
		}),
	)
	async regenerateSeniorAccessCode(
		@CurrentSession() session: LocalSession,
		@Param(new ZodValidationPipe(SeniorAdminIdParamSchema)) params: unknown,
	) {
		const { seniorId } = params as { seniorId: string };
		return RegenerateSeniorAccessCodeResponseSchema.parse(
			await this.adminService.regenerateSeniorAccessCode(session, seniorId),
		);
	}

	// ── PATCH ────────────────────────────────────────────────────────────────

	@Patch("institutions/:institutionId")
	@ApiOperation({
		summary: "Update an institution",
		description: "Updates institution display data.",
	})
	@ApiBody(swaggerRequestBody(UpdateInstitutionRequestSchema))
	@ApiOkResponse(
		swaggerResponse(InstitutionResponseSchema, {
			description: "Updated institution.",
		}),
	)
	@ApiBadRequestResponse(
		swaggerResponse(ErrorResponseSchema, {
			description: "Validation error.",
		}),
	)
	@ApiUnauthorizedResponse(
		swaggerResponse(ErrorResponseSchema, {
			description: "Authentication is required or the user is not an admin.",
		}),
	)
	async updateInstitution(
		@CurrentSession() session: LocalSession,
		@Param(new ZodValidationPipe(InstitutionIdParamSchema)) params: unknown,
		@Body(new ZodValidationPipe(UpdateInstitutionRequestSchema)) body: unknown,
	) {
		const { institutionId } = params as { institutionId: string };
		return InstitutionResponseSchema.parse(
			await this.adminService.updateInstitution(
				session,
				institutionId,
				body as never,
			),
		);
	}

	@Patch("caregivers/:caregiverId")
	@ApiOperation({
		summary: "Update a caregiver account",
		description:
			"Updates caregiver profile fields, institution assignment, or account activation state.",
	})
	@ApiBody(swaggerRequestBody(UpdateCaregiverRequestSchema))
	@ApiOkResponse(
		swaggerResponse(CaregiverAdminResponseSchema, {
			description: "Updated caregiver account.",
		}),
	)
	@ApiBadRequestResponse(
		swaggerResponse(ErrorResponseSchema, {
			description: "Validation error, duplicate email, or invalid institution.",
		}),
	)
	@ApiUnauthorizedResponse(
		swaggerResponse(ErrorResponseSchema, {
			description: "Authentication is required or the user is not an admin.",
		}),
	)
	async updateCaregiver(
		@CurrentSession() session: LocalSession,
		@Param(new ZodValidationPipe(CaregiverIdParamSchema)) params: unknown,
		@Body(new ZodValidationPipe(UpdateCaregiverRequestSchema)) body: unknown,
	) {
		const { caregiverId } = params as { caregiverId: string };
		return CaregiverAdminResponseSchema.parse(
			await this.adminService.updateCaregiver(
				session,
				caregiverId,
				body as never,
			),
		);
	}

	@Patch("caregivers/:caregiverId/institution")
	@ApiOperation({
		summary: "Reassign caregiver institution",
		description:
			"Explicitly updates the institution associated with a caregiver account.",
	})
	@ApiBody(swaggerRequestBody(ReassignInstitutionRequestSchema))
	@ApiOkResponse(
		swaggerResponse(CaregiverAdminResponseSchema, {
			description: "Caregiver account after institution reassignment.",
		}),
	)
	@ApiBadRequestResponse(
		swaggerResponse(ErrorResponseSchema, {
			description: "Validation error or invalid institution.",
		}),
	)
	@ApiUnauthorizedResponse(
		swaggerResponse(ErrorResponseSchema, {
			description: "Authentication is required or the user is not an admin.",
		}),
	)
	async reassignCaregiverInstitution(
		@CurrentSession() session: LocalSession,
		@Param(new ZodValidationPipe(CaregiverIdParamSchema)) params: unknown,
		@Body(new ZodValidationPipe(ReassignInstitutionRequestSchema))
		body: unknown,
	) {
		const { caregiverId } = params as { caregiverId: string };
		return CaregiverAdminResponseSchema.parse(
			await this.adminService.reassignCaregiverInstitution(
				session,
				caregiverId,
				body as never,
			),
		);
	}

	@Patch("seniors/:seniorId")
	@ApiOperation({
		summary: "Update a senior account",
		description:
			"Updates senior profile fields, institution assignment, or account activation state.",
	})
	@ApiBody(swaggerRequestBody(UpdateSeniorRequestSchema))
	@ApiOkResponse(
		swaggerResponse(SeniorAdminResponseSchema, {
			description: "Updated senior account.",
		}),
	)
	@ApiBadRequestResponse(
		swaggerResponse(ErrorResponseSchema, {
			description: "Validation error, duplicate email, or invalid institution.",
		}),
	)
	@ApiUnauthorizedResponse(
		swaggerResponse(ErrorResponseSchema, {
			description: "Authentication is required or the user is not an admin.",
		}),
	)
	async updateSenior(
		@CurrentSession() session: LocalSession,
		@Param(new ZodValidationPipe(SeniorAdminIdParamSchema)) params: unknown,
		@Body(new ZodValidationPipe(UpdateSeniorRequestSchema)) body: unknown,
	) {
		const { seniorId } = params as { seniorId: string };
		return SeniorAdminResponseSchema.parse(
			await this.adminService.updateSenior(session, seniorId, body as never),
		);
	}

	@Patch("seniors/:seniorId/institution")
	@ApiOperation({
		summary: "Reassign senior institution",
		description:
			"Explicitly updates the institution associated with a senior account.",
	})
	@ApiBody(swaggerRequestBody(ReassignInstitutionRequestSchema))
	@ApiOkResponse(
		swaggerResponse(SeniorAdminResponseSchema, {
			description: "Senior account after institution reassignment.",
		}),
	)
	@ApiBadRequestResponse(
		swaggerResponse(ErrorResponseSchema, {
			description: "Validation error or invalid institution.",
		}),
	)
	@ApiUnauthorizedResponse(
		swaggerResponse(ErrorResponseSchema, {
			description: "Authentication is required or the user is not an admin.",
		}),
	)
	async reassignSeniorInstitution(
		@CurrentSession() session: LocalSession,
		@Param(new ZodValidationPipe(SeniorAdminIdParamSchema)) params: unknown,
		@Body(new ZodValidationPipe(ReassignInstitutionRequestSchema))
		body: unknown,
	) {
		const { seniorId } = params as { seniorId: string };
		return SeniorAdminResponseSchema.parse(
			await this.adminService.reassignSeniorInstitution(
				session,
				seniorId,
				body as never,
			),
		);
	}

	// ── DELETE ───────────────────────────────────────────────────────────────

	@Delete("institutions/:institutionId")
	@ApiOperation({
		summary: "Delete an institution",
		description:
			"Permanently deletes an institution and all its members (caregivers and seniors) along with all their data.",
	})
	@ApiOkResponse(
		swaggerResponse(SuccessResponseSchema, {
			description: "Institution was deleted.",
		}),
	)
	@ApiBadRequestResponse(
		swaggerResponse(ErrorResponseSchema, {
			description: "Institution still has assigned users.",
		}),
	)
	@ApiUnauthorizedResponse(
		swaggerResponse(ErrorResponseSchema, {
			description: "Authentication is required or the user is not an admin.",
		}),
	)
	async deleteInstitution(
		@CurrentSession() session: LocalSession,
		@Param(new ZodValidationPipe(InstitutionIdParamSchema)) params: unknown,
	) {
		const { institutionId } = params as { institutionId: string };
		return SuccessResponseSchema.parse(
			await this.adminService.deleteInstitution(session, institutionId),
		);
	}

	@Delete("caregivers/:caregiverId")
	@ApiOperation({
		summary: "Deactivate a caregiver account",
		description: "Permanently deletes a caregiver account and all associated data.",
	})
	@ApiOkResponse(
		swaggerResponse(SuccessResponseSchema, {
			description: "Caregiver account was permanently deleted.",
		}),
	)
	@ApiUnauthorizedResponse(
		swaggerResponse(ErrorResponseSchema, {
			description: "Authentication is required or the user is not an admin.",
		}),
	)
	async deleteCaregiver(
		@CurrentSession() session: LocalSession,
		@Param(new ZodValidationPipe(CaregiverIdParamSchema)) params: unknown,
	) {
		const { caregiverId } = params as { caregiverId: string };
		return SuccessResponseSchema.parse(
			await this.adminService.deleteCaregiver(session, caregiverId),
		);
	}

	@Delete("seniors/:seniorId")
	@ApiOperation({
		summary: "Deactivate a senior account",
		description: "Permanently deletes a senior account and all associated data.",
	})
	@ApiOkResponse(
		swaggerResponse(SuccessResponseSchema, {
			description: "Senior account was permanently deleted.",
		}),
	)
	@ApiUnauthorizedResponse(
		swaggerResponse(ErrorResponseSchema, {
			description: "Authentication is required or the user is not an admin.",
		}),
	)
	async deleteSenior(
		@CurrentSession() session: LocalSession,
		@Param(new ZodValidationPipe(SeniorAdminIdParamSchema)) params: unknown,
	) {
		const { seniorId } = params as { seniorId: string };
		return SuccessResponseSchema.parse(
			await this.adminService.deleteSenior(session, seniorId),
		);
	}

	// ── Plans ─────────────────────────────────────────────────────────────────

	@Get("plans")
	@ApiOperation({ summary: "List all plans" })
	@ApiOkResponse(swaggerResponse(PlansListResponseSchema, { description: "All plans." }))
	async getPlans(@CurrentSession() session: LocalSession) {
		return PlansListResponseSchema.parse(
			await this.adminService.getPlans(session),
		);
	}

	@Post("plans")
	@ApiOperation({ summary: "Create a plan" })
	@ApiBody(swaggerRequestBody(CreatePlanRequestSchema))
	@ApiCreatedResponse(swaggerResponse(PlanResponseSchema, { description: "Created plan." }))
	@ApiBadRequestResponse(swaggerResponse(ErrorResponseSchema, { description: "Validation error or duplicate name." }))
	async createPlan(
		@CurrentSession() session: LocalSession,
		@Body(new ZodValidationPipe(CreatePlanRequestSchema)) body: unknown,
	) {
		return PlanResponseSchema.parse(
			await this.adminService.createPlan(session, body as never),
		);
	}

	@Patch("plans/:planId")
	@ApiOperation({ summary: "Update a plan" })
	@ApiBody(swaggerRequestBody(UpdatePlanRequestSchema))
	@ApiOkResponse(swaggerResponse(PlanResponseSchema, { description: "Updated plan." }))
	async updatePlan(
		@CurrentSession() session: LocalSession,
		@Param(new ZodValidationPipe(PlanIdParamSchema)) params: unknown,
		@Body(new ZodValidationPipe(UpdatePlanRequestSchema)) body: unknown,
	) {
		const { planId } = params as { planId: string };
		return PlanResponseSchema.parse(
			await this.adminService.updatePlan(session, planId, body as never),
		);
	}

	@Delete("plans/:planId")
	@ApiOperation({ summary: "Delete a plan" })
	@ApiOkResponse(swaggerResponse(SuccessResponseSchema, { description: "Plan was deleted." }))
	@ApiBadRequestResponse(swaggerResponse(ErrorResponseSchema, { description: "Plan is still assigned to institutions." }))
	async deletePlan(
		@CurrentSession() session: LocalSession,
		@Param(new ZodValidationPipe(PlanIdParamSchema)) params: unknown,
	) {
		const { planId } = params as { planId: string };
		return SuccessResponseSchema.parse(
			await this.adminService.deletePlan(session, planId),
		);
	}
}
