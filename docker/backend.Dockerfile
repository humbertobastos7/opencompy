FROM node:20-slim

RUN apt-get update \
	&& apt-get install -y --no-install-recommends ca-certificates curl \
	&& curl -fsSL https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem \
		-o /etc/ssl/certs/rds-ca.pem \
	&& rm -rf /var/lib/apt/lists/*
RUN corepack enable

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY tsconfig.json tsconfig.backend.json ./
COPY drizzle.config.ts ./
COPY scripts ./scripts
COPY src ./src
COPY drizzle ./drizzle

RUN pnpm run build:server
RUN chmod +x scripts/start-backend.sh

EXPOSE 3000
STOPSIGNAL SIGTERM

CMD ["./scripts/start-backend.sh"]
