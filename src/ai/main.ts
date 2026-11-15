import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import {
	FastifyAdapter,
	type NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { env } from "@/env/ai";
import { AiAppModule } from "./app.module";

const QUIET_REQUEST_LOG_PATHS = new Set(["/api/chat/voice/streaming/events"]);

type RequestLogMethod = (payload: unknown, message: string) => void;

type RequestLogContext = {
	raw: {
		url?: string;
	};
	method: string;
	host: string;
	ip: string;
	socket: {
		remotePort?: number;
	};
	log: {
		info: RequestLogMethod;
		error: RequestLogMethod;
	};
};

type ResponseLogContext = {
	statusCode: number;
	elapsedTime: number;
};

type HookDone = () => void;

type HookableFastifyInstance = {
	addHook(
		name: "onRequest",
		hook: (request: RequestLogContext, reply: unknown, done: HookDone) => void,
	): void;
	addHook(
		name: "onResponse",
		hook: (
			request: RequestLogContext,
			reply: ResponseLogContext,
			done: HookDone,
		) => void,
	): void;
	addHook(
		name: "onError",
		hook: (
			request: RequestLogContext,
			reply: ResponseLogContext,
			error: unknown,
			done: HookDone,
		) => void,
	): void;
};

/**
 * Normalizes one incoming URL so request-log filtering ignores query strings.
 */
function normalizeRequestLogPath(url?: string) {
	return url?.split("?", 1)[0] ?? "";
}

/**
 * Decides whether one request should emit the regular success access logs.
 *
 * The voice streaming events endpoint is polled very frequently by the backend,
 * so keeping its successful requests quiet preserves visibility for slower turns,
 * warnings, and failures.
 */
function shouldLogSuccessfulRequest(url?: string) {
	return !QUIET_REQUEST_LOG_PATHS.has(normalizeRequestLogPath(url));
}

/**
 * Creates the Fastify adapter used by the AI service with default request
 * logging disabled so the service can re-add selective access logs manually.
 */
function createAiFastifyAdapter() {
	return new FastifyAdapter({
		logger:
			env.NODE_ENV === "test"
				? false
				: {
						level: "info",
					},
		disableRequestLogging: true,
	});
}

/**
 * Restores access logging for relevant AI routes while suppressing the noisy
 * success logs produced by the streaming events polling endpoint.
 */
function registerSelectiveRequestLogging(instance: HookableFastifyInstance) {
	instance.addHook("onRequest", (request, _reply, done) => {
		if (shouldLogSuccessfulRequest(request.raw.url)) {
			request.log.info(
				{
					req: {
						method: request.method,
						url: request.raw.url,
						host: request.host,
						remoteAddress: request.ip,
						remotePort: request.socket.remotePort,
					},
				},
				"incoming request",
			);
		}

		done();
	});

	instance.addHook("onResponse", (request, reply, done) => {
		if (shouldLogSuccessfulRequest(request.raw.url)) {
			request.log.info(
				{
					res: {
						statusCode: reply.statusCode,
					},
					responseTime: reply.elapsedTime,
				},
				"request completed",
			);
		}

		done();
	});

	instance.addHook("onError", (request, reply, error, done) => {
		request.log.error(
			{
				err: error,
				res: {
					statusCode: reply.statusCode || 500,
				},
			},
			"request failed",
		);

		done();
	});
}

/**
 * Boots the dedicated AI HTTP service used by the backend voice pipeline.
 */
async function bootstrap() {
	const app = await NestFactory.create<NestFastifyApplication>(
		AiAppModule,
		createAiFastifyAdapter(),
	);
	registerSelectiveRequestLogging(
		app.getHttpAdapter().getInstance() as HookableFastifyInstance,
	);

	app.enableCors({
		origin: true,
		credentials: true,
	});
	app.setGlobalPrefix("api");

	app.enableShutdownHooks();
	await app.listen(env.PORT, "0.0.0.0");
}

bootstrap();
