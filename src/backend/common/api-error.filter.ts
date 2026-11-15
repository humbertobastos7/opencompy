import { Catch, HttpException, HttpStatus, Logger } from "@nestjs/common";
import type { ArgumentsHost, ExceptionFilter } from "@nestjs/common";
import type { FastifyReply, FastifyRequest } from "fastify";
import { env } from "@/env/backend";

const allowedOrigins = env.CORS_ORIGINS
	? env.CORS_ORIGINS.split(",")
			.map((o) => o.trim())
			.filter(Boolean)
	: [];

type ErrorResponseBody = {
	statusCode: number;
	code: string;
	message: string;
	details?: unknown;
	requestId: string | undefined;
	timestamp: string;
	path: string;
};

@Catch()
export class ApiErrorFilter implements ExceptionFilter {
	private readonly logger = new Logger(ApiErrorFilter.name);

	catch(exception: unknown, host: ArgumentsHost) {
		const ctx = host.switchToHttp();
		const request = ctx.getRequest<FastifyRequest>();
		const reply = ctx.getResponse<FastifyReply>();

		const statusCode =
			exception instanceof HttpException
				? exception.getStatus()
				: HttpStatus.INTERNAL_SERVER_ERROR;
		const response = this.buildErrorResponse(exception, request, statusCode);

		if (statusCode >= 500) {
			this.logger.error(
				`${request.method} ${request.url} failed with ${statusCode}`,
				exception instanceof Error ? exception.stack : undefined,
			);
		}

		const origin = request.headers.origin;
		if (typeof origin === "string" && origin.length > 0) {
			const isAllowed =
				env.NODE_ENV !== "production" || allowedOrigins.includes(origin);
			if (isAllowed) {
				reply.header("access-control-allow-origin", origin);
				reply.header("access-control-allow-credentials", "true");
				reply.header("vary", "Origin");
			}
		}

		reply.status(statusCode).send(response);
	}

	private buildErrorResponse(
		exception: unknown,
		request: FastifyRequest,
		statusCode: number,
	): ErrorResponseBody {
		const base = {
			statusCode,
			requestId: request.id,
			timestamp: new Date().toISOString(),
			path: request.url,
		};

		if (!(exception instanceof HttpException)) {
			return {
				...base,
				code: "INTERNAL_SERVER_ERROR",
				message: "Internal server error",
			};
		}

		const response = exception.getResponse();
		if (typeof response === "string") {
			return {
				...base,
				code: this.normalizeCode(response),
				message: response,
			};
		}

		if (response && typeof response === "object") {
			const payload = response as Record<string, unknown>;
			const message = this.extractMessage(payload.message);

			return {
				...base,
				code: this.normalizeCode(
					typeof payload.error === "string" ? payload.error : message,
				),
				message,
				details: payload,
			};
		}

		return {
			...base,
			code: "HTTP_EXCEPTION",
			message: exception.message,
		};
	}

	private extractMessage(message: unknown) {
		if (Array.isArray(message)) {
			return message.join(", ");
		}
		if (typeof message === "string") {
			return message;
		}
		return "Request failed";
	}

	private normalizeCode(value: string) {
		return (
			value
				.trim()
				.toUpperCase()
				.replace(/[^A-Z0-9]+/g, "_")
				.replace(/^_+|_+$/g, "") || "HTTP_EXCEPTION"
		);
	}
}
