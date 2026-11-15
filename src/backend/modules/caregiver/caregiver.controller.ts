import { Body, Controller, Delete, Get, Inject, Param, Patch, Post } from "@nestjs/common";
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
	CaregiverDailyOverviewResponseSchema,
	CaregiverDashboardResponseSchema,
	CaregiverInstitutionResponseSchema,
	CaregiverNoteIdParamSchema,
	CaregiverNoteResponseSchema,
	CaregiverNotesResponseSchema,
	CaregiverSeniorActivityResponseSchema,
	CaregiverSeniorIdParamSchema,
	CaregiverSeniorSummaryResponseSchema,
	CreateCaregiverNoteRequestSchema,
	CreateFamilySeniorRequestSchema,
	CreateFamilySeniorResponseSchema,
	DeleteCaregiverNoteResponseSchema,
	ElevenLabsQuotaResponseSchema,
	ErrorResponseSchema,
	SeniorConversationCountResponseSchema,
	UpdateCaregiverNoteRequestSchema,
	UpdateCaregiverProfileResponseSchema,
	UpdateCaregiverProfileRequestSchema,
	type LocalSession,
	type CreateCaregiverNoteRequest,
	type UpdateCaregiverNoteRequest,
} from "@/shared/contracts";
import { AiClientService } from "@/backend/integrations/ai.client";
import { CurrentSession } from "@/backend/common/current-session.decorator";
import {
	swaggerRequestBody,
	swaggerResponse,
} from "@/shared/nest/zod-openapi";
import { ZodValidationPipe } from "@/shared/nest/zod-validation.pipe";
import { CaregiverService } from "./caregiver.service";

@ApiTags("caregiver")
@Controller("caregiver")
export class CaregiverController {
	constructor(
		@Inject(CaregiverService)
		private readonly caregiverService: CaregiverService,
		@Inject(AiClientService)
		private readonly aiClientService: AiClientService,
	) {}

	@Get("institution")
	@ApiOperation({ summary: "Get institution info for the authenticated caregiver" })
	@ApiOkResponse(swaggerResponse(CaregiverInstitutionResponseSchema, { description: "Institution type and name." }))
	@ApiUnauthorizedResponse(swaggerResponse(ErrorResponseSchema, { description: "Not a caregiver." }))
	async getInstitution(@CurrentSession() session: LocalSession) {
		return CaregiverInstitutionResponseSchema.parse(
			await this.caregiverService.getInstitution(session),
		);
	}

	@Patch("profile")
	@ApiOperation({ summary: "Update caregiver name and email" })
	@ApiBody(swaggerRequestBody(UpdateCaregiverProfileRequestSchema))
	@ApiOkResponse(swaggerResponse(UpdateCaregiverProfileResponseSchema, { description: "Success." }))
	@ApiUnauthorizedResponse(swaggerResponse(ErrorResponseSchema, { description: "Not a caregiver." }))
	async updateProfile(
		@CurrentSession() session: LocalSession,
		@Body(new ZodValidationPipe(UpdateCaregiverProfileRequestSchema)) body: unknown,
	) {
		return UpdateCaregiverProfileResponseSchema.parse(
			await this.caregiverService.updateProfile(session, body as never),
		);
	}

	@Post("seniors")
	@ApiOperation({ summary: "Create a senior in the caregiver's family institution" })
	@ApiBody(swaggerRequestBody(CreateFamilySeniorRequestSchema))
	@ApiCreatedResponse(swaggerResponse(CreateFamilySeniorResponseSchema, { description: "Senior created." }))
	@ApiUnauthorizedResponse(swaggerResponse(ErrorResponseSchema, { description: "Not a caregiver or no institution." }))
	async createFamilySenior(
		@CurrentSession() session: LocalSession,
		@Body(new ZodValidationPipe(CreateFamilySeniorRequestSchema)) body: unknown,
	) {
		return CreateFamilySeniorResponseSchema.parse(
			await this.caregiverService.createFamilySenior(session, body as never),
		);
	}

	@Get("dashboard")
	@ApiOperation({
		summary: "Get caregiver dashboard metrics",
		description:
			"Returns aggregate operational data for the authenticated caregiver and the seniors in the same institution.",
	})
	@ApiOkResponse(
		swaggerResponse(CaregiverDashboardResponseSchema, {
			description: "Caregiver dashboard aggregate.",
		}),
	)
	@ApiUnauthorizedResponse(
		swaggerResponse(ErrorResponseSchema, {
			description:
				"Authentication is required or the current user is not a caregiver.",
		}),
	)
	async getDashboard(@CurrentSession() session: LocalSession) {
		return CaregiverDashboardResponseSchema.parse(
			await this.caregiverService.getDashboard(session),
		);
	}

	@Get("daily-overview")
	@ApiOperation({
		summary: "Get daily activity overview for all seniors",
		description:
			"Returns per-day aggregated metrics (conversation minutes, emotional tone distribution, active seniors count) for all seniors accessible to the caregiver. Only days with at least one conversation are included.",
	})
	@ApiOkResponse(
		swaggerResponse(CaregiverDailyOverviewResponseSchema, {
			description: "Daily overview entries ordered newest first.",
		}),
	)
	@ApiUnauthorizedResponse(
		swaggerResponse(ErrorResponseSchema, {
			description: "Authentication is required or the current user is not a caregiver.",
		}),
	)
	async getDailyOverview(@CurrentSession() session: LocalSession) {
		return CaregiverDailyOverviewResponseSchema.parse(
			await this.caregiverService.getDailyOverview(session),
		);
	}

	@Get("seniors/:seniorId/summary")
	@ApiOperation({
		summary: "Get caregiver summary for a senior",
		description:
			"Returns a condensed operational summary for one senior accessible to the authenticated caregiver.",
	})
	@ApiOkResponse(
		swaggerResponse(CaregiverSeniorSummaryResponseSchema, {
			description: "Senior operational summary.",
		}),
	)
	@ApiUnauthorizedResponse(
		swaggerResponse(ErrorResponseSchema, {
			description:
				"Authentication is required or the caregiver does not have access to the senior.",
		}),
	)
	async getSeniorSummary(
		@CurrentSession() session: LocalSession,
		@Param(new ZodValidationPipe(CaregiverSeniorIdParamSchema))
		params: { seniorId: string },
	) {
		const { seniorId } = params;
		return CaregiverSeniorSummaryResponseSchema.parse(
			await this.caregiverService.getSeniorSummary(session, seniorId),
		);
	}

	@Get("seniors/:seniorId/conversations/count")
	@ApiOperation({
		summary: "Count conversations for a senior",
		description:
			"Returns the total number of recorded conversations for a senior accessible to the authenticated caregiver.",
	})
	@ApiOkResponse(
		swaggerResponse(SeniorConversationCountResponseSchema, {
			description: "Conversation count for the selected senior.",
		}),
	)
	@ApiUnauthorizedResponse(
		swaggerResponse(ErrorResponseSchema, {
			description:
				"Authentication is required or the caregiver does not have access to the senior.",
		}),
	)
	async getConversationCount(
		@CurrentSession() session: LocalSession,
		@Param(new ZodValidationPipe(CaregiverSeniorIdParamSchema))
		params: { seniorId: string },
	) {
		const { seniorId } = params;
		return SeniorConversationCountResponseSchema.parse(
			await this.caregiverService.getConversationCount(session, seniorId),
		);
	}

	@Get("seniors/:seniorId/activity")
	@ApiOperation({
		summary: "Get recent senior activity for caregivers",
		description:
			"Returns recent conversations and caregiver notes for a senior accessible to the current caregiver.",
	})
	@ApiOkResponse(
		swaggerResponse(CaregiverSeniorActivityResponseSchema, {
			description: "Recent senior activity feed.",
		}),
	)
	@ApiUnauthorizedResponse(
		swaggerResponse(ErrorResponseSchema, {
			description:
				"Authentication is required or the caregiver does not have access to the senior.",
		}),
	)
	async getSeniorActivity(
		@CurrentSession() session: LocalSession,
		@Param(new ZodValidationPipe(CaregiverSeniorIdParamSchema))
		params: { seniorId: string },
	) {
		const { seniorId } = params;
		return CaregiverSeniorActivityResponseSchema.parse(
			await this.caregiverService.getSeniorActivity(session, seniorId),
		);
	}

	@Get("elevenlabs-quota")
	@ApiOperation({
		summary: "Get ElevenLabs subscription quota",
		description: "Returns the current character usage and remaining quota for the ElevenLabs TTS service.",
	})
	@ApiOkResponse(
		swaggerResponse(ElevenLabsQuotaResponseSchema, {
			description: "ElevenLabs subscription quota.",
		}),
	)
	@ApiUnauthorizedResponse(
		swaggerResponse(ErrorResponseSchema, {
			description: "Authentication is required or the current user is not a caregiver.",
		}),
	)
	async getElevenLabsQuota() {
		return ElevenLabsQuotaResponseSchema.parse(
			await this.aiClientService.getElevenLabsQuota(),
		);
	}

	@Get("seniors/:seniorId/notes")
	@ApiOperation({
		summary: "List caregiver notes for a senior",
		description:
			"Returns caregiver-authored notes for a senior accessible to the current caregiver.",
	})
	@ApiOkResponse(
		swaggerResponse(CaregiverNotesResponseSchema, {
			description: "Caregiver notes ordered newest first.",
		}),
	)
	@ApiUnauthorizedResponse(
		swaggerResponse(ErrorResponseSchema, {
			description:
				"Authentication is required or the caregiver does not have access to the senior.",
		}),
	)
	async getNotes(
		@CurrentSession() session: LocalSession,
		@Param(new ZodValidationPipe(CaregiverSeniorIdParamSchema))
		params: { seniorId: string },
	) {
		const { seniorId } = params;
		return CaregiverNotesResponseSchema.parse(
			await this.caregiverService.getNotes(session, seniorId),
		);
	}

	@Post("seniors/:seniorId/notes")
	@ApiOperation({
		summary: "Create a caregiver note for a senior",
		description:
			"Stores a caregiver-authored note linked to a senior accessible to the current caregiver.",
	})
	@ApiBody(swaggerRequestBody(CreateCaregiverNoteRequestSchema))
	@ApiCreatedResponse(
		swaggerResponse(CaregiverNoteResponseSchema, {
			description: "Stored caregiver note.",
		}),
	)
	@ApiBadRequestResponse(
		swaggerResponse(ErrorResponseSchema, {
			description: "Validation error.",
		}),
	)
	@ApiUnauthorizedResponse(
		swaggerResponse(ErrorResponseSchema, {
			description:
				"Authentication is required or the caregiver does not have access to the senior.",
		}),
	)
	async createNote(
		@CurrentSession() session: LocalSession,
		@Param(new ZodValidationPipe(CaregiverSeniorIdParamSchema))
		params: { seniorId: string },
		@Body(new ZodValidationPipe(CreateCaregiverNoteRequestSchema))
		body: CreateCaregiverNoteRequest,
	) {
		const { seniorId } = params;
		return CaregiverNoteResponseSchema.parse(
			await this.caregiverService.createNote(session, seniorId, body),
		);
	}

	@Patch("seniors/:seniorId/notes/:noteId")
	@ApiOperation({
		summary: "Update a caregiver note",
		description:
			"Updates the content, category or pinned state of a caregiver note.",
	})
	@ApiBody(swaggerRequestBody(UpdateCaregiverNoteRequestSchema))
	@ApiOkResponse(
		swaggerResponse(CaregiverNoteResponseSchema, {
			description: "Updated caregiver note.",
		}),
	)
	@ApiBadRequestResponse(
		swaggerResponse(ErrorResponseSchema, {
			description: "Validation error.",
		}),
	)
	@ApiUnauthorizedResponse(
		swaggerResponse(ErrorResponseSchema, {
			description:
				"Authentication is required or the caregiver does not have access to the senior.",
		}),
	)
	async updateNote(
		@CurrentSession() session: LocalSession,
		@Param(new ZodValidationPipe(CaregiverNoteIdParamSchema))
		params: { seniorId: string; noteId: string },
		@Body(new ZodValidationPipe(UpdateCaregiverNoteRequestSchema))
		body: UpdateCaregiverNoteRequest,
	) {
		const { seniorId, noteId } = params;
		return CaregiverNoteResponseSchema.parse(
			await this.caregiverService.updateNote(session, seniorId, noteId, body),
		);
	}

	@Delete("seniors/:seniorId/notes/:noteId")
	@ApiOperation({
		summary: "Delete a caregiver note",
		description: "Deletes a caregiver note for a senior accessible to the caregiver.",
	})
	@ApiOkResponse(
		swaggerResponse(DeleteCaregiverNoteResponseSchema, {
			description: "Delete result.",
		}),
	)
	@ApiUnauthorizedResponse(
		swaggerResponse(ErrorResponseSchema, {
			description:
				"Authentication is required or the caregiver does not have access to the senior.",
		}),
	)
	async deleteNote(
		@CurrentSession() session: LocalSession,
		@Param(new ZodValidationPipe(CaregiverNoteIdParamSchema))
		params: { seniorId: string; noteId: string },
	) {
		const { seniorId, noteId } = params;
		return DeleteCaregiverNoteResponseSchema.parse(
			await this.caregiverService.deleteNote(session, seniorId, noteId),
		);
	}
}
