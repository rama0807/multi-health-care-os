# syntax=docker/dockerfile:1
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# ─── Dependencies ────────────────────────────────────────────────────────────
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY packages/types/package.json ./packages/types/
COPY packages/config/eslint-config/package.json ./packages/config/eslint-config/
COPY packages/config/tsconfig/package.json ./packages/config/tsconfig/
COPY apps/web/package.json ./apps/web/
RUN pnpm install --frozen-lockfile

# ─── Builder ──────────────────────────────────────────────────────────────────
FROM base AS builder
WORKDIR /app
COPY --from=deps /app ./
COPY . .
ENV NEXT_TELEMETRY_DISABLED 1
# NEXT_PUBLIC_* vars are inlined into the client bundle by `next build` -
# setting them only as container `environment:` (runtime) never reaches
# already-built JS, so it has to arrive here as a build arg instead.
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN pnpm --filter @medicore/types build
RUN pnpm --filter @medicore/web build

# ─── Production ───────────────────────────────────────────────────────────────
FROM node:20-alpine AS production
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# `next.config.mjs` doesn't set `outputFileTracingRoot`, so Next auto-detects
# it from the pnpm-lock.yaml at the *monorepo* root (required so tracing
# reaches into `@medicore/types`/`@medicore/ui`) - which makes `standalone`
# preserve the full path from that root, landing server.js at
# `apps/web/server.js` inside the standalone tree, not at its own root.
COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# 127.0.0.1, not localhost - Alpine resolves `localhost` to the IPv6 loopback
# first, and Next only binds the IPv4 socket, so `wget localhost` gets an
# instant connection-refused even while the process is up and serving.
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "apps/web/server.js"]
