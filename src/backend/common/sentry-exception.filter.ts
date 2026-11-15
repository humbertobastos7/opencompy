import { Catch, HttpException, type ArgumentsHost } from "@nestjs/common";
import { BaseExceptionFilter } from "@nestjs/core";
import * as Sentry from "@sentry/node";

// Captura todas as excepções não tratadas.
// Erros 5xx (bugs inesperados) são enviados ao Sentry.
// Erros 4xx (validação, autenticação) são ignorados — são comportamento esperado.
@Catch()
export class SentryExceptionFilter extends BaseExceptionFilter {
	override catch(exception: unknown, host: ArgumentsHost) {
		const status =
			exception instanceof HttpException ? exception.getStatus() : 500;

		if (status >= 500) {
			Sentry.captureException(exception);
		}

		super.catch(exception, host);
	}
}
