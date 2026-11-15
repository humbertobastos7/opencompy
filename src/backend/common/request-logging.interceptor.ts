import { Injectable, Logger } from "@nestjs/common";
import type {
	CallHandler,
	ExecutionContext,
	NestInterceptor,
} from "@nestjs/common";
import type { FastifyReply, FastifyRequest } from "fastify";
import { tap } from "rxjs/operators";

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
	private readonly logger = new Logger(RequestLoggingInterceptor.name);

	intercept(context: ExecutionContext, next: CallHandler) {
		const request = context.switchToHttp().getRequest<FastifyRequest>();
		const reply = context.switchToHttp().getResponse<FastifyReply>();
		const startedAt = Date.now();

		reply.header("x-request-id", request.id);

		return next.handle().pipe(
			tap({
				next: () => {
					this.logger.log(
						`${request.method} ${request.url} ${reply.statusCode} ${Date.now() - startedAt}ms requestId=${request.id}`,
					);
				},
				error: () => {
					this.logger.warn(
						`${request.method} ${request.url} ${reply.statusCode} ${Date.now() - startedAt}ms requestId=${request.id}`,
					);
				},
			}),
		);
	}
}
