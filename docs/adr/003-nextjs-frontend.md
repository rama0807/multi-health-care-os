# ADR-003: Next.js 14 with App Router

**Status:** Accepted  
**Date:** 2024-01-15

---

## Context

The frontend needs to be:
- Fast (SSR for initial loads, CSR for dashboard interactivity)
- Type-safe end-to-end
- Built on a component model that scales to 15+ feature modules
- Capable of SSR for public-facing pages (SEO for clinic landing pages)

## Decision

Use **Next.js 14 with App Router**, TypeScript, Tailwind CSS, and shadcn/ui.

## Rationale

### App Router over Pages Router

The App Router's React Server Components model is the right architecture for a dashboard:
- Server Components fetch data directly — no waterfall, no client-side loading states for initial data
- Client Components are opt-in — only interactive parts hydrate
- Layouts don't re-render on navigation — sidebar and header are persistent
- Streaming with Suspense boundaries gives perceived performance improvements on slow connections

### shadcn/ui over component libraries

shadcn/ui is a collection of copy-paste components built on Radix UI primitives and Tailwind CSS. The critical difference from Chakra, MUI, or Mantine:

- **We own the code** — components live in our repo, we can modify them freely
- **No runtime overhead** — Tailwind is purged at build time, no CSS-in-JS runtime
- **Accessible by default** — Radix UI handles ARIA, keyboard navigation, focus management
- **Visual consistency** — all components use the same design tokens

### TanStack Query v5

Server state management is genuinely different from UI state. TanStack Query handles:
- Automatic background refetching
- Stale-while-revalidate caching
- Optimistic updates for instant UI feedback
- Request deduplication
- Error and loading states

This eliminates 80% of the `useEffect` + `useState` patterns that lead to race conditions and loading flickers.

### Zod for validation

Zod schemas are shared between frontend (form validation) and backend (DTO validation). Single source of truth for shape and constraints.

```typescript
// packages/types/src/patient.ts
export const CreatePatientSchema = z.object({
  firstName: z.string().min(2).max(50),
  phone: z.string().regex(/^[6-9]\d{9}$/),
  dateOfBirth: z.string().datetime(),
  // ...
})

// Used in NestJS DTO and React Hook Form — same schema
```

## Rejected Alternatives

**Remix:** Strong data loading model but less ecosystem maturity for enterprise dashboards. App Router achieves similar patterns now.

**Vite + React SPA:** No SSR for public pages. All data loading is client-side. Healthcare dashboards benefit from server rendering on initial load.

**Create React App:** Deprecated. No SSR. Not suitable.
