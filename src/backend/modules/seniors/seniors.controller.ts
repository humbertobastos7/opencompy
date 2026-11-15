import {
	Body,
	Controller,
	Get,
	Inject,
	Param,
	Patch,
} from "@nestjs/common";
import {
	ApiBadRequestResponse,
	ApiBody,
	ApiOkResponse,
	ApiOperation,
	ApiParam,
	ApiTags,
	ApiUnauthorizedResponse,
} from "@nestjs/swagger";

import {
	AvailableReportDatesResponseSchema,
	ConversationReportParam,
	ConversationReportResponseSchema,
	EmotionalTrendResponseSchema,
	ErrorResponseSchema,
	SeniorIdParam,
	SeniorNicknameSchema,
	SeniorProfileUpdateSchema,
	SeniorResponseSchema,
	SeniorSettingsResponseSchema,
	SeniorSettingsUpdateSchema,
	SuccessResponseSchema,
	SeniorsListResponseSchema,
	updateSeniorLikesRequestSchema,
} from "@/shared/contracts";
import type { LocalSession, SeniorProfileUpdateRequest, SeniorSettingsUpdateRequest } from "@/shared/contracts";
import { CurrentSession } from "@/backend/common/current-session.decorator";
import {
	swaggerRequestBody,
	swaggerResponse,
} from "@/shared/nest/zod-openapi";
import { ZodValidationPipe } from "@/shared/nest/zod-validation.pipe";
import { SeniorsService } from "./seniors.service";

@ApiTags("seniors")
@Controller("seniors")
export class SeniorsController {
	constructor(
		@Inject(SeniorsService)
		private readonly seniorsService: SeniorsService,
	) {}

	// ── GET ──────────────────────────────────────────────────────────────────

	@Get()
	@ApiOperation({
		summary: "List seniors visible to the current user",
		description:
			"Returns all senior profiles visible to the authenticated user. Seniors receive only their own record.",
	})
	@ApiOkResponse(
		swaggerResponse(SeniorsListResponseSchema, {
			description: "List of visible senior profiles.",
		}),
	)
	@ApiUnauthorizedResponse(swaggerResponse(ErrorResponseSchema, { description: "Authentication is required." }))
	async getSeniors(@CurrentSession() session: LocalSession) {
		return SeniorsListResponseSchema.parse(await this.seniorsService.getSeniors(session));
	}

	@Get("available-dates")
	@ApiOperation({
		summary: "List available conversation report dates grouped by senior",
		description:
			"Returns conversation report dates grouped by senior so the frontend can build report date pickers.",
	})
	@ApiOkResponse(
		swaggerResponse(AvailableReportDatesResponseSchema, {
			description: "Available report dates grouped by senior id.",
		}),
	)
	@ApiUnauthorizedResponse(swaggerResponse(ErrorResponseSchema, { description: "Authentication is required." }))
	async getAvailableDates(@CurrentSession() session: LocalSession) {
		return AvailableReportDatesResponseSchema.parse(
			await this.seniorsService.getAvailableReportDates(session),
		);
	}

	@Get(":seniorId")
	@ApiOperation({
		summary: "Get a senior profile by id",
		description: "Returns a single senior profile when the authenticated user is allowed to access it.",
	})
	@ApiParam({ name: "seniorId", description: "Senior user id." })
	@ApiOkResponse(swaggerResponse(SeniorResponseSchema, { description: "Requested senior profile." }))
	@ApiBadRequestResponse(swaggerResponse(ErrorResponseSchema, { description: "Invalid request parameters." }))
	@ApiUnauthorizedResponse(swaggerResponse(ErrorResponseSchema, { description: "Authentication is required or access is denied." }))
	async getSenior(
		@CurrentSession() session: LocalSession,
		@Param(new ZodValidationPipe(SeniorIdParam))
		params: { seniorId: string },
		) {
		return SeniorResponseSchema.parse(
			await this.seniorsService.getSenior(session, params.seniorId),
		);
	}

	@Get(":seniorId/emotional-trend")
	@ApiOperation({
		summary: "Get emotional tone trend for a senior",
		description: "Returns the daily emotional tone for recent conversations and a negative alert flag.",
	})
	@ApiParam({ name: "seniorId", description: "Senior user id." })
	@ApiOkResponse(swaggerResponse(EmotionalTrendResponseSchema, { description: "Emotional trend data." }))
	@ApiBadRequestResponse(swaggerResponse(ErrorResponseSchema, { description: "Invalid request parameters." }))
	@ApiUnauthorizedResponse(swaggerResponse(ErrorResponseSchema, { description: "Authentication is required or access is denied." }))
	async getEmotionalTrend(
		@CurrentSession() session: LocalSession,
		@Param(new ZodValidationPipe(SeniorIdParam))
		params: { seniorId: string },
	) {
		return EmotionalTrendResponseSchema.parse(
			await this.seniorsService.getEmotionalTrend(session, params.seniorId),
		);
	}

	@Get(":seniorId/report/:date")
	@ApiOperation({
		summary: "Get a conversation report for a specific date",
		description: "Returns the aggregated conversation report and AI-generated summaries for one date.",
	})
	@ApiParam({ name: "seniorId", description: "Senior user id." })
	@ApiParam({ name: "date", description: "Date in YYYY-MM-DD format." })
	@ApiOkResponse(swaggerResponse(ConversationReportResponseSchema, { description: "Conversation report for the requested date." }))
	@ApiBadRequestResponse(swaggerResponse(ErrorResponseSchema, { description: "Invalid request parameters." }))
	@ApiUnauthorizedResponse(swaggerResponse(ErrorResponseSchema, { description: "Authentication is required or access is denied." }))
	async getConversationReport(
		@CurrentSession() session: LocalSession,
		@Param(new ZodValidationPipe(ConversationReportParam))
		params: { seniorId: string; date: string },
		) {
		return ConversationReportResponseSchema.parse(
			await this.seniorsService.getConversationReport(
				session,
				params.seniorId,
				params.date,
			),
		);
	}

	@Get(":seniorId/senior-settings")
	@ApiOperation({
		summary: "Get runtime conversation settings for a senior",
		description: "Returns the assistant runtime settings currently configured for the selected senior.",
	})
	@ApiParam({ name: "seniorId", description: "Senior user id." })
	@ApiOkResponse(swaggerResponse(SeniorSettingsResponseSchema, { description: "Current runtime settings for the selected senior." }))
	@ApiBadRequestResponse(swaggerResponse(ErrorResponseSchema, { description: "Invalid request parameters." }))
	@ApiUnauthorizedResponse(swaggerResponse(ErrorResponseSchema, { description: "Authentication is required or access is denied." }))
	async getSeniorSettings(
		@CurrentSession() session: LocalSession,
		@Param(new ZodValidationPipe(SeniorIdParam))
		params: { seniorId: string },
		) {
		return SeniorSettingsResponseSchema.parse(
			await this.seniorsService.getSeniorSettings(session, params.seniorId),
		);
	}

	// ── PATCH ────────────────────────────────────────────────────────────────

	@Patch(":seniorId/likes")
	@ApiOperation({
		summary: "Update a senior's preference likes",
		description: "Updates the structured interest categories used by the assistant and the frontend.",
	})
	@ApiParam({ name: "seniorId", description: "Senior user id." })
	@ApiBody(swaggerRequestBody(updateSeniorLikesRequestSchema))
	@ApiOkResponse(swaggerResponse(SuccessResponseSchema, { description: "Senior likes were updated." }))
	@ApiBadRequestResponse(swaggerResponse(ErrorResponseSchema, { description: "Validation error or invalid request parameters." }))
	@ApiUnauthorizedResponse(swaggerResponse(ErrorResponseSchema, { description: "Authentication is required or access is denied." }))
	async updateLikes(
		@CurrentSession() session: LocalSession,
		@Param(new ZodValidationPipe(SeniorIdParam))
		params: { seniorId: string },
		@Body(new ZodValidationPipe(updateSeniorLikesRequestSchema))
		body: { likes: never },
		) {
		return SuccessResponseSchema.parse(
			await this.seniorsService.saveSeniorLikes(
				session,
				params.seniorId,
				body.likes,
			),
		);
	}

	@Patch(":seniorId/profile")
	@ApiOperation({ summary: "Partially update a senior's profile fields" })
	@ApiParam({ name: "seniorId", description: "Senior user id." })
	@ApiBody(swaggerRequestBody(SeniorProfileUpdateSchema))
	@ApiOkResponse(swaggerResponse(SuccessResponseSchema, { description: "Profile updated." }))
	@ApiBadRequestResponse(swaggerResponse(ErrorResponseSchema, { description: "Validation error or invalid request parameters." }))
	@ApiUnauthorizedResponse(swaggerResponse(ErrorResponseSchema, { description: "Authentication is required or access is denied." }))
	async updateProfile(
		@CurrentSession() session: LocalSession,
		@Param(new ZodValidationPipe(SeniorIdParam)) params: { seniorId: string },
		@Body(new ZodValidationPipe(SeniorProfileUpdateSchema)) body: SeniorProfileUpdateRequest,
	) {
		return SuccessResponseSchema.parse(
			await this.seniorsService.updateSeniorProfile(session, params.seniorId, body),
		);
	}

	@Patch(":seniorId/nickname")
	@ApiOperation({
		summary: "Update a senior nickname",
		description: "Updates the preferred display nickname for the selected senior.",
	})
	@ApiParam({ name: "seniorId", description: "Senior user id." })
	@ApiBody(swaggerRequestBody(SeniorNicknameSchema))
	@ApiOkResponse(swaggerResponse(SeniorResponseSchema, { description: "Updated senior profile." }))
	@ApiBadRequestResponse(swaggerResponse(ErrorResponseSchema, { description: "Validation error or invalid request parameters." }))
	@ApiUnauthorizedResponse(swaggerResponse(ErrorResponseSchema, { description: "Authentication is required or access is denied." }))
	async updateNickname(
		@CurrentSession() session: LocalSession,
		@Param(new ZodValidationPipe(SeniorIdParam))
		params: { seniorId: string },
		@Body(new ZodValidationPipe(SeniorNicknameSchema))
		body: { nickname: string },
		) {
		return SeniorResponseSchema.parse(
			await this.seniorsService.updateSeniorNickname(
				session,
				params.seniorId,
				body.nickname,
			),
		);
	}

	@Patch(":seniorId/senior-settings")
	@ApiOperation({
		summary: "Update runtime conversation settings for a senior",
		description: "Applies a partial update to the assistant runtime settings for the selected senior.",
	})
	@ApiParam({ name: "seniorId", description: "Senior user id." })
	@ApiBody(swaggerRequestBody(SeniorSettingsUpdateSchema))
	@ApiOkResponse(swaggerResponse(SeniorSettingsResponseSchema, { description: "Updated runtime settings for the selected senior." }))
	@ApiBadRequestResponse(swaggerResponse(ErrorResponseSchema, { description: "Validation error or invalid request parameters." }))
	@ApiUnauthorizedResponse(swaggerResponse(ErrorResponseSchema, { description: "Authentication is required or access is denied." }))
	async updateSeniorSettings(
		@CurrentSession() session: LocalSession,
		@Param(new ZodValidationPipe(SeniorIdParam))
		params: { seniorId: string },
		@Body(new ZodValidationPipe(SeniorSettingsUpdateSchema))
		body: SeniorSettingsUpdateRequest,
		) {
		return SeniorSettingsResponseSchema.parse(
			await this.seniorsService.updateSeniorSettings(
				session,
				params.seniorId,
				body,
			),
		);
	}

}
