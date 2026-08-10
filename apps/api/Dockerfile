# syntax=docker/dockerfile:1
FROM node:20-alpine AS base
RUN apk add --no-cache openssl
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
COPY --from=deps /app ./
COPY . .
RUN pnpm --filter @medicore/types build
RUN pnpm --filter @medicore/database db:generate
RUN pnpm --filter @medicore/database build
RUN pnpm --filter @medicore/api build

# ─── Production ───────────────────────────────────────────────────────────────
FROM node:20-alpine AS production
# Matches the `base` stage - the engine binary generated there was built
# against whatever OpenSSL `prisma generate` found, and needs the same major
# version actually present here at runtime.
RUN apk add --no-cache openssl
WORKDIR /app

ENV NODE_ENV=production

# `apps/api/dist/main.js` requires bare specifiers like `@nestjs/config` and
# `@medicore/types` - Node resolves those by walking up from the requiring
# file's own directory looking for a `node_modules` at each level. pnpm's
# node-linker gives every workspace package its own `node_modules` (holding
# symlinks to its *own* deps, pointing into this root node_modules' `.pnpm`
# store) rather than hoisting everything to one flat tree. So the app's own
# package tree has to stay nested exactly as it is in the workspace -
# `apps/api/dist` next to `apps/api/node_modules`, `packages/types/dist` next
# to `packages/types/node_modules` - or that walk never reaches the
# `node_modules` holding the symlink it needs, and every such import 404s
# with `Cannot find module` despite the module plainly being on disk.
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder /app/packages/types/node_modules ./packages/types/node_modules
COPY --from=builder /app/packages/types/dist ./packages/types/dist
COPY --from=builder /app/packages/types/package.json ./packages/types/package.json
COPY --from=builder /app/packages/database/node_modules ./packages/database/node_modules
COPY --from=builder /app/packages/database/dist ./packages/database/dist
COPY --from=builder /app/packages/database/package.json ./packages/database/package.json
# `docs/operations/deployment.md` runs migrations/seeding with
# `--schema ./prisma/schema.prisma` and `require('./node_modules/@medicore/database/dist/seed.js')`
# from this WORKDIR, so the schema stays at the top-level path those commands
# already assume.
COPY --from=builder /app/packages/database/prisma ./prisma

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
CMD ["node", "apps/api/dist/main"]
