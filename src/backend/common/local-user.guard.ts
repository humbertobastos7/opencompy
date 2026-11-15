import { Inject, Injectable } from "@nestjs/common";
import type { CanActivate, ExecutionContext } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import type { LocalSession } from "@/shared/contracts";
import { LocalUserService } from "@/backend/modules/local-user/local-user.service";
import { HealthController } from "@/backend/controllers/health.controller";

export const VISIT_KEY_HEADER = "x-compy-visit";

/**
 * Attaches the local user to every request. It never rejects: there are no
 * accounts, so whoever can reach the server is the local user.
 */
@Injectable()
export class LocalUserGuard implements CanActivate {
	constructor(
		@Inject(LocalUserService)
		private readonly localUserService: LocalUserService,
	) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		// Liveness must answer even when the database is unavailable.
		if (context.getClass() === HealthController) {
			return true;
		}

		const request = context
			.switchToHttp()
			.getRequest<FastifyRequest & { localSession?: LocalSession }>();
		const header = request.headers[VISIT_KEY_HEADER];
		request.localSession = await this.localUserService.getSession(
			Array.isArray(header) ? header[0] : header,
		);
		return true;
	}
}
