import "./instrument"; // Sentry — deve ser o primeiro import
import "reflect-metadata";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { NestFactory } from "@nestjs/core";
import { HttpAdapterHost } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import {
	FastifyAdapter,
	type NestFastifyApplication,
} from "@nestjs/platform-fastify";
import helmet from "@fastify/helmet";
import fastifyStatic from "@fastify/static";
import websocket from "@fastify/websocket";
import { env } from "@/env/backend";
import { AppModule } from "./app.module";
import { SentryExceptionFilter } from "./common/sentry-exception.filter";

async function bootstrap() {
	const app = await NestFactory.create<NestFastifyApplication>(
		AppModule,
		new FastifyAdapter({
			logger: env.NODE_ENV !== "test",
			bodyLimit: 1_048_576, // 1 MB
			trustProxy: true,
		}),
	);
	const fastify = app.getHttpAdapter().getInstance();
	fastify.addHook("onRequest", (request, reply, done) => {
		reply.header("x-request-id", request.id);
		done();
	});

	await app.register(helmet as never, {
		contentSecurityPolicy: env.NODE_ENV === "production",
		crossOriginResourcePolicy: { policy: "cross-origin" },
	});
	await app.register(websocket as never);
	const frontendDist = join(process.cwd(), "dist/frontend");
	if (existsSync(frontendDist)) {
		await app.register(fastifyStatic as never, {
			root: frontendDist,
			prefix: "/",
			decorateReply: false,
			wildcard: false,
		});
	}

	const allowedOrigins = env.CORS_ORIGINS
		? env.CORS_ORIGINS.split(",")
				.map((o) => o.trim())
				.filter(Boolean)
		: [];
	app.enableCors({
		origin:
			env.NODE_ENV === "production"
				? (origin, cb) => {
						if (!origin || allowedOrigins.includes(origin)) {
							cb(null, true);
						} else {
							cb(null, false);
						}
					}
				: true,
		methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
	});

	app.setGlobalPrefix("api");

	const swaggerConfig = new DocumentBuilder()
		.setTitle("Compy Backend API")
		.setDescription("HTTP API for the Compy backend service.")
		.setVersion("1.0.0")
		.addTag("local-user", "Local user and onboarding state")
		.addTag("onboarding", "Senior onboarding and assignment")
		.addTag("seniors", "Seniors, settings, and reports")
		.addTag("chat", "Realtime AI session orchestration")
		.build();

	const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig, {
		deepScanRoutes: true,
	});

	if (env.NODE_ENV !== "production")
		SwaggerModule.setup("docs", app, swaggerDocument, {
			useGlobalPrefix: true,
			jsonDocumentUrl: "" + "docs/json",
			yamlDocumentUrl: "docs/yaml",
			customSiteTitle: "Compy Backend API",
			swaggerOptions: {
				displayRequestDuration: true,
			},
		});

	const { httpAdapter } = app.get(HttpAdapterHost);
	app.useGlobalFilters(new SentryExceptionFilter(httpAdapter));

	app.enableShutdownHooks();
	await app.listen(env.PORT, "0.0.0.0");
}

bootstrap();
