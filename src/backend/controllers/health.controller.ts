import { Controller, Get } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";

@ApiTags("health")
@Controller("health")
export class HealthController {
	@Get()
	@ApiOperation({
		summary: "Health check",
		description: "Returns service liveness status.",
	})
	@ApiOkResponse({ description: "Service is healthy." })
	check() {
		return { status: "ok", timestamp: new Date().toISOString() };
	}
}
