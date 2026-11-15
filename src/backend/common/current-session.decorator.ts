import { createParamDecorator } from "@nestjs/common";
import type { ExecutionContext } from "@nestjs/common";
import type { LocalSession } from "@/shared/contracts";

export const CurrentSession = createParamDecorator(
	(_data: unknown, ctx: ExecutionContext): LocalSession | undefined => {
		const request = ctx
			.switchToHttp()
			.getRequest<{ localSession?: LocalSession }>();
		return request.localSession;
	},
);
