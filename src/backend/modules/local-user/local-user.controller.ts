import { Controller, Get, Inject, Post } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentSession } from "@/backend/common/current-session.decorator";
import { sessionResponseSchema } from "@/shared/contracts";
import type { LocalSession } from "@/shared/contracts";
import { swaggerResponse } from "@/shared/nest/zod-openapi";
import { LocalUserService } from "./local-user.service";

@ApiTags("local-user")
@Controller()
export class LocalUserController {
	constructor(
		@Inject(LocalUserService)
		private readonly localUserService: LocalUserService,
	) {}

	@Get("me")
	@ApiOperation({
		summary: "Get the local user",
		description:
			"Returns the single local user of this installation, including onboarding state.",
	})
	@ApiOkResponse(
		swaggerResponse(sessionResponseSchema, {
			description: "Local user profile.",
		}),
	)
	async me(@CurrentSession() session: LocalSession) {
		return sessionResponseSchema.parse(session);
	}

	@Post("onboarding/complete")
	@ApiOperation({
		summary: "Mark onboarding as completed",
		description:
			"Records that the welcome flow was finished and the terms were accepted, and returns the refreshed local user.",
	})
	@ApiOkResponse(
		swaggerResponse(sessionResponseSchema, {
			description: "Local user after completing onboarding.",
		}),
	)
	async completeOnboarding(@CurrentSession() session: LocalSession) {
		return sessionResponseSchema.parse(
			await this.localUserService.completeOnboarding(
				session.sessionId.replace(/^visit:/, ""),
			),
		);
	}
}
