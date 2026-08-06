# ADR-001: Monorepo with Turborepo

**Status:** Accepted  
**Date:** 2024-01-15  
**Deciders:** Architecture team

---

## Context

MediCore has two primary applications (Next.js frontend, NestJS backend) and several shared concerns: TypeScript types, UI components, database schema, and configuration. We need a strategy for managing code that:

1. Allows sharing code (types, components, validation schemas) without duplication
2. Enforces consistent tooling (linting, formatting, testing)
3. Scales as more apps/services are added
4. Supports fast CI/CD

## Decision

Use a **monorepo structure managed by Turborepo** with pnpm workspaces.

```
medicore/
├── apps/api         (NestJS)
├── apps/web         (Next.js)
├── packages/database  (Prisma)
├── packages/types
├── packages/ui
└── packages/config
```

## Rationale

**Why monorepo over polyrepo?**

- **Shared code without publishing:** `@medicore/types` is imported directly - no npm publish cycle for every DTO change
- **Atomic commits:** A change that touches the API, frontend, and types ships in one commit with one CI run
- **Unified tooling:** One ESLint config, one Prettier config, one TypeScript base config - applied everywhere
- **Easier refactoring:** Renaming a shared type shows all broken references across apps immediately

**Why Turborepo over alternatives?**

| Tool | Build Caching | Parallel Execution | pnpm Support | Complexity |
|------|-------------|-------------------|--------------|------------|
| Turborepo | Remote + local cache | Yes | First-class | Low |
| Nx | Remote cache (paid) | Yes | Yes | High |
| Lerna | No | Partial | Yes | Medium |
| Manual scripts | No | Manual | Yes | High |

Turborepo's key advantage is **zero-config build caching** - unchanged packages are never rebuilt. In CI, this cuts build time by 60-80% after the first run.

## Consequences

**Positive:**
- Shared `@medicore/types` package means the API and frontend never have type drift
- Prisma schema lives in `@medicore/database` - single source of truth
- `turbo run build` builds only what changed and its dependents
- Adding a new service (e.g., a separate AI microservice) is straightforward

**Negative:**
- Initial setup complexity vs. two separate repos
- `pnpm install` pulls all dependencies for all packages - mitigated by pnpm's content-addressable store
- Engineers need to understand workspace-aware commands (`pnpm --filter`)

## Rejected Alternatives

**Polyrepo:** Two separate repos. Rejected because type drift between API and web DTOs caused real bugs in prior projects, and the overhead of keeping shared code in sync across repos is high.

**Nx:** More powerful but significantly more complex. Turborepo is sufficient for our scale and has lower learning curve.
