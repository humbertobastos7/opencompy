import { Body, Controller, Get, Inject, Post } from "@nestjs/common";
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
	ErrorResponseSchema,
	assignSeniorResponseSchema,
	approveLocationResponseSchema,
	onboardSeniorResponseSchema,
	onboardingStatusResponseSchema,
	approveLocationRequestSchema,
	assignSeniorRequestSchema,
	onboardSeniorRequestSchema,
} from "@/shared/contracts";
import type { LocalSession } from "@/shared/contracts";
import { CurrentSession } from "@/backend/common/current-session.decorator";
import {
	swaggerRequestBody,
	swaggerResponse,
} from "@/shared/nest/zod-openapi";
import { ZodValidationPipe } from "@/shared/nest/zod-validation.pipe";
import { OnboardingService } from "./onboarding.service";

@ApiTags("onboarding")
@Controller("onboarding")
export class OnboardingController {
	constructor(
		@Inject(OnboardingService)
		private readonly onboardingService: OnboardingService,
	) {}

	// ── GET ──────────────────────────────────────────────────────────────────

	@Get("status")
	@ApiOperation({
		summary: "Get the senior onboarding association status",
		description:
			"Returns whether the current senior is associated with a caregiver location and who owns that location.",
	})
	@ApiOkResponse(
		swaggerResponse(onboardingStatusResponseSchema, {
			description: "Current onboarding association state.",
		}),
	)
	@ApiUnauthorizedResponse(
		swaggerResponse(ErrorResponseSchema, {
			description: "Only senior users can view onboarding status.",
		}),
	)
	async getStatus(@CurrentSession() session: LocalSession) {
		return onboardingStatusResponseSchema.parse(
			await this.onboardingService.getOnboardingStatus(session),
		);
	}

	// ── POST ─────────────────────────────────────────────────────────────────

	@Post()
	@ApiOperation({
		summary: "Create or update a senior onboarding profile",
		description:
			"Creates or updates the senior profile associated with the current session, or provisions a new senior from a caregiver context.",
	})
	@ApiBody(swaggerRequestBody(onboardSeniorRequestSchema))
	@ApiCreatedResponse(
		swaggerResponse(onboardSeniorResponseSchema, {
			description: "Senior profile was created or updated.",
		}),
	)
	@ApiBadRequestResponse(
		swaggerResponse(ErrorResponseSchema, {
			description: "Validation error or email already registered.",
		}),
	)
	@ApiUnauthorizedResponse(
		swaggerResponse(ErrorResponseSchema, {
			description: "Authenticated user does not have access to a location.",
		}),
	)
	async onboardSenior(
		@CurrentSession() session: LocalSession,
		@Body(new ZodValidationPipe(onboardSeniorRequestSchema))
		body: unknown,
	) {
		return onboardSeniorResponseSchema.parse(
			await this.onboardingService.onboardSenior(session, body as never),
		);
	}

	@Post("assign")
	@ApiOperation({
		summary: "Assign a senior to the caregiver's location using an access code",
		description:
			"Links an existing senior account to the current caregiver location using the senior access code.",
	})
	@ApiBody(swaggerRequestBody(assignSeniorRequestSchema))
	@ApiOkResponse(
		swaggerResponse(assignSeniorResponseSchema, {
			description: "Senior was assigned to the caregiver location.",
		}),
	)
	@ApiBadRequestResponse(
		swaggerResponse(ErrorResponseSchema, {
			description: "Validation error or invalid access code.",
		}),
	)
	@ApiUnauthorizedResponse(
		swaggerResponse(ErrorResponseSchema, {
			description: "Only non-senior users with a location can assign seniors.",
		}),
	)
	async assignSenior(
		@CurrentSession() session: LocalSession,
		@Body(new ZodValidationPipe(assignSeniorRequestSchema))
		body: unknown,
	) {
		return assignSeniorResponseSchema.parse(
			await this.onboardingService.assignSenior(session, body as never),
		);
	}

	@Post("approve-location")
	@ApiOperation({
		summary: "Approve or decline a pending location association",
		description:
			"Allows a senior to accept or reject the currently pending caregiver location association.",
	})
	@ApiBody(swaggerRequestBody(approveLocationRequestSchema))
	@ApiOkResponse(
		swaggerResponse(approveLocationResponseSchema, {
			description: "Approval decision was recorded.",
		}),
	)
	@ApiBadRequestResponse(
		swaggerResponse(ErrorResponseSchema, {
			description: "Validation error.",
		}),
	)
	@ApiUnauthorizedResponse(
		swaggerResponse(ErrorResponseSchema, {
			description: "Only senior users can approve or reject a location.",
		}),
	)
	async approveLocation(
		@CurrentSession() session: LocalSession,
		@Body(new ZodValidationPipe(approveLocationRequestSchema))
		body: unknown,
	) {
		return approveLocationResponseSchema.parse(
			await this.onboardingService.approveLocation(session, body as never),
		);
	}
}
