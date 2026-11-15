FROM node:20-slim AS build

RUN apt-get update \
	&& apt-get install -y --no-install-recommends ca-certificates \
	&& rm -rf /var/lib/apt/lists/*
RUN corepack enable

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

ARG VITE_API_URL=http://localhost:3000
ARG VITE_USE_REALTIME_CHAT=true

ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_USE_REALTIME_CHAT=${VITE_USE_REALTIME_CHAT}

RUN pnpm run build:frontend

FROM nginx:1.27-alpine

COPY docker/frontend.nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/frontend /usr/share/nginx/html

EXPOSE 80
STOPSIGNAL SIGQUIT
