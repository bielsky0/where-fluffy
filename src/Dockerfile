# syntax=docker/dockerfile:1

# --- builder -----------------------------------------------------------------
# Generates the Prisma client and compiles TS -> dist/ on the SAME base image the
# runtime stage uses below, so the Prisma query engine binary generate() downloads
# matches the OS/libc the app actually runs on (alpine == musl, not glibc).
FROM node:22-alpine AS builder
RUN apk add --no-cache openssl
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY tsconfig.json ./
COPY . .
RUN npm run build

# --- runtime -------------------------------------------------------------------
FROM node:22-alpine AS runtime
RUN apk add --no-cache openssl
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

# Prisma's generated client + query engine binary (produced by `prisma generate` in the
# builder stage) live under node_modules/.prisma and node_modules/@prisma/client — `npm ci
# --omit=dev` above installs @prisma/client's JS but not the generated bits, so they're
# copied in explicitly rather than re-running generate a second time here.
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

EXPOSE 3000
CMD ["node", "dist/main.js"]
