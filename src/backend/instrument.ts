// Este ficheiro deve ser importado como PRIMEIRO import no main.ts.
// O Sentry precisa de ser inicializado antes de qualquer outro módulo
// para conseguir interceptar erros e instrumentar chamadas HTTP/DB.
import * as Sentry from "@sentry/node";

const dsn = process.env.SENTRY_DSN;

if (dsn) {
	Sentry.init({
		dsn,
		environment: process.env.NODE_ENV ?? "development",
		// Em produção captura 10% dos requests para traces de performance.
		// Em dev captura tudo para facilitar o debug.
		tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
		// Não enviar dados de utilizadores identificáveis por defeito
		sendDefaultPii: false,
	});
}
