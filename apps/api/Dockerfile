# syntax=docker/dockerfile:1
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# ─── Dependencies ────────────────────────────────────────────────────────────
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY packages/database/package.json ./packages/database/
COPY packages/types/package.json ./packages/types/
COPY packages/config/eslint-config/package.json ./packages/config/eslint-config/
COPY packages/config/tsconfig/package.json ./packages/config/tsconfig/
COPY apps/api/package.json ./apps/api/
RUN pnpm install --frozen-lockfile

# ─── Builder ──────────────────────────────────────────────────────────────────
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY . .
RUN pnpm --filter @medicore/types build
RUN pnpm --filter @medicore/database db:generate
RUN pnpm --filter @medicore/api build

# ─── Production ───────────────────────────────────────────────────────────────
FROM node:20-alpine AS production
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/package.json ./package.json
COPY --from=builder /app/packages/database/prisma ./prisma
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules

# Runs unprivileged (Milestone 19.5), matching what apps/web/Dockerfile already
# did. A container escape from the API process should not land on root.
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 medicore \
  && chown -R medicore:nodejs /app
USER medicore

EXPOSE 4000

# Liveness, not the dependency check: a Postgres blip must not make Docker
# restart a healthy API container. The previous path (`/api/health`) did not
# exist - health was mounted at `/api/v1/health` only - so this healthcheck
# reported unhealthy on every deployment until Milestone 19.4 made the probes
# version-neutral.
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget -qO- http://127.0.0.1:4000/api/health/live || exit 1

# Exec form, so node is PID 1 and receives SIGTERM directly - that is what
# starts the graceful drain in `main.ts`.
CMD ["node", "dist/main"]
