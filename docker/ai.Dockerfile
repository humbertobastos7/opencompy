FROM node:20-slim

RUN apt-get update \
	&& apt-get install -y --no-install-recommends ca-certificates \
	&& rm -rf /var/lib/apt/lists/*
RUN corepack enable

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY tsconfig.json tsconfig.backend.json ./
COPY scripts ./scripts
COPY src ./src

RUN pnpm run build:server

EXPOSE 3001
STOPSIGNAL SIGTERM

CMD ["node", "dist/ai/main.js"]
