import { ForbiddenException, Injectable } from "@nestjs/common";
import type { CanActivate, ExecutionContext } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import type { LocalSession } from "@/shared/contracts";

@Injectable()
export class AdminGuard implements CanActivate {
	canActivate(context: ExecutionContext): boolean {
		const request = context
			.switchToHttp()
			.getRequest<FastifyRequest & { localSession?: LocalSession }>();

		if (request.localSession?.user.role !== "admin") {
			throw new ForbiddenException("ADMIN_ONLY_ENDPOINT");
		}

		return true;
	}
}
