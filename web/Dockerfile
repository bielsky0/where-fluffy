# syntax=docker/dockerfile:1

# --- builder -------------------------------------------------------------------
FROM node:22-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Vite inlines VITE_-prefixed vars into the built bundle at build time (see
# web/src/lib/apiClient.ts, web/src/lib/telemetry.ts) — there is no web/.env in this image, so
# these must arrive as build args (see docker-compose.prod.yml's web.build.args).
ARG VITE_API_BASE_URL
ARG VITE_OTEL_EXPORTER_OTLP_ENDPOINT
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL \
    VITE_OTEL_EXPORTER_OTLP_ENDPOINT=$VITE_OTEL_EXPORTER_OTLP_ENDPOINT

RUN npm run build

# --- runtime ---------------------------------------------------------------
# Static SPA, so runtime is just nginx serving the built assets — no Node needed here at all.
FROM nginx:1.27-alpine AS runtime

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
