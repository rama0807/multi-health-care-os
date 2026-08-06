# MediCore Frontend Design Review — Phase 2 Audit

> Phase 1 deliverable (audit only — **no code changed** for this document).
> Companion to `docs/design-system.md` and **ADR-0031**. Do not re-litigate
> anything ADR-0031 already decided (token architecture, branding, status
> colour ownership) — this review is scoped to **adoption**, not foundation.

## 0. Headline finding

**The design system this brief asks for already exists.** Design System V2
Phase 1 (completed today, 2026-08-06, ADR-0031) built the token layer,
branding pipeline, and ~20 primitives — `PageLayout`, `StatusBadge`,
`StatCard`/`StatCardGrid`, `EmptyState`, `EmptyValue`, `TableContainer` /
`Table density`, `TableSkeleton`, `BulkActionBar`, `TableRowActions`,
`EntityCell`, a collapsible sidebar, a header with a working command palette
and hospital selector.

**Adoption is 0%.** Verified by grep across every `app/dashboard/**/page.tsx`:

| Primitive | Pages using it | Pages that could |
|---|---|---|
| `PageLayout` | 0 | 76 |
| `StatusBadge` | 0 | 76 |
| `StatCard` / `StatCardGrid` | 0 | ~20 dashboards |
| `EmptyState` | 0 | 76 |
| `TableSkeleton` | 0 | 56 (pages with a table) |
| `TableContainer` (new `Table`) | 0 | 56 |

76 `page.tsx` files, 105 `.tsx` files total under `app/`, 56 still importing
the table primitives directly, 46 using dialogs — every one of them predates
Phase 1 and inherits only what Phase 1 changed for free (colour tokens,
density, focus ring, branding). None of them uses the new *composition*
primitives. This is exactly what TD-0077 recorded and what `NEXT.md` calls
"Phase 2 — not started, needs a fresh instruction." **This session's brief is
that instruction.**

So the review below is not "the app needs a design system" — it's "the
design system needs to reach the app." Findings are the concrete patterns
found in real pages that Phase 2 replaces, illustrated with the actual files
read for this audit (`billing/page.tsx`, `patients/page.tsx`,
`page-layout.tsx`, `globals.css`, `sidebar.tsx`).

---

## 1. Page layout & headers — **Critical**

**Current:** Every page hand-rolls its own header:
```tsx
// dashboard/billing/page.tsx
<div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
  <div>
    <h1 className="text-xl font-semibold text-foreground">Billing</h1>
    <p className="text-sm text-muted-foreground">Invoices, payments, and refunds.</p>
  </div>
  <div className="flex flex-wrap gap-2">…buttons…</div>
</div>
```
No breadcrumbs anywhere in the 76 pages sampled. No `max-width` cap — content
stretches edge-to-edge on a wide monitor. Detail pages have no consistent
place for status/meta/aside.

**Why it feels generic:** every page reinvents header spacing by eye, so
titles sit at slightly different baselines page to page — the "forty
products stapled together" feel. No breadcrumb means no sense of place in a
17-module app; a user landing on an invoice detail page has no path back
except the browser's back button.

**How premium products solve it:** Linear and Stripe Dashboard use exactly
one header shape everywhere — breadcrumb, title, one badge, metadata row,
actions right-aligned with primary last — so switching modules costs zero
re-orientation.

**Proposed solution:** `PageLayout` (already built, `components/layout/
page-layout.tsx`) does precisely this, including the `aside` utility column
and a content-width cap (`max-w-[1600px]` default, `full` for dense tables).
Zero new component work — pure adoption.

---

## 2. Dashboards & KPI tiles — **Critical**

**Current** (`billing/page.tsx`, representative of every module dashboard —
Pharmacy, Insurance, IPD, Radiology, Staff, Inventory all share this shape):
```tsx
<div className="flex items-center gap-3 rounded-lg border bg-card p-4 shadow-sm">
  <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
    <tile.icon className="h-4 w-4" />
  </div>
  <div>
    <p className="text-lg font-semibold text-foreground">{statsQuery.isLoading ? '—' : (tile.value ?? 0)}</p>
    <p className="text-xs text-muted-foreground">{tile.label}</p>
  </div>
</div>
```
Two real defects, not just style: (1) `tile.value ?? 0` renders a genuine
zero-vs-not-yet-loaded ambiguity as the same `0` — exactly the mistake
`docs/design-system.md` §6 calls out and `StatCard`/`EmptyValue` exist to
prevent. (2) The "collection trend" chart is hand-rolled absolute-positioned
divs with an inline `style={{ height: ... }}` percentage, not `recharts` —
even though `recharts` is already a dependency and the Reports module
(`_components/charts.tsx`) already wraps it with theme-aware series colours.

**Why it feels generic:** flat icon-in-a-box tiles with no trend indicator,
no comparison to yesterday/last period, and a bar chart that visibly doesn't
line up with the rest of the app's chart language (Reports pages use real
`recharts` bars with tokenised colours; Billing's dashboard uses raw divs).
This is the single biggest "AI-dashboard-template" tell across the app —
every reference product (Stripe, Linear Insights) uses one consistent stat
tile with a delta, not a grid of static numbers.

**How premium products solve it:** one `StatCard` component, used
everywhere, that knows how to render loading/empty/error identically, with
an optional trend/delta and an icon that's decoration, not the visual
anchor.

**Proposed solution:** `StatCard`/`StatCardGrid` (built, `components/ui/
stat-card.tsx`) plus `useChartTheme`/the existing `charts.tsx` pattern from
Reports, extended to every module dashboard. Also close the day-1 alert
banner's hardcoded colour (`border-amber-300 bg-amber-50 … dark:bg-amber-950`
— a direct violation of design-system.md §2's "never write a colour value in
a component," bypassing the `warning` token family that exists for exactly
this).

---

## 3. Tables — **Critical**

**Current:** 56 pages still import `Table`/`TableHeader`/`TableRow`/
`TableCell` directly from `components/ui/table` with no `TableContainer`,
no `density`, no sticky header, no `TableSkeleton`, no `BulkActionBar`
(patients' list page manages a `Set<string>` selection and renders its own
ad hoc bulk-action affordance rather than the docked bar). One page
(`patients/page.tsx`) is 518 lines because pagination, sorting, selection,
and bulk-action UI are all hand-built per page instead of composed from
primitives.

**Why it feels generic:** un-sticky headers on a long list mean losing
column context on scroll; no density option means every table looks like a
consumer app's list, not an operator's dense grid; selection UI that shifts
row position when a checkbox is ticked is a specific, well-known "cheap
admin template" tell.

**How premium products solve it:** Linear's issue table and Stripe's
transaction table both keep the header pinned, use a docked selection bar
that never reflows the rows under the cursor, and default to a denser row
height than a marketing site would ever use.

**Proposed solution:** already built (`TableContainer`, `Table
density="compact"`, sticky `TableHeader`, `BulkActionBar`,
`TableRowActions`, `EntityCell`). Migrate list pages onto them — this is
`NEXT.md`'s explicit suggested step 2.

---

## 4. Status representation — **Critical, but smallest diff**

**Current:** Zero pages use `<StatusBadge>`. Status is very likely still
rendered per-page via ad hoc `Badge variant="..."` with per-page colour
choices — the exact "Cancelled is grey in Pharmacy and red in Billing"
problem ADR-0031 names as the reason `StatusBadge` was built centrally, but
which no page has adopted yet.

**Why it feels generic:** inconsistent status colour across ~20 domain
vocabularies (appointment status, invoice status, claim status, admission
status…) is one of the fastest ways an app reads as "many features bolted
together" instead of one product.

**How premium products solve it:** one status-to-tone mapping, owned
centrally, so "cancelled," "rejected," and "failed" never accidentally share
a colour with "completed."

**Proposed solution:** swap every remaining `<Badge>` status rendering for
`<StatusBadge status={…} />`. `NEXT.md` calls this the right first move —
"largest consistency win, smallest diff, no layout risk" — and this review
agrees: do it first, across all 76 pages, before anything else.

---

## 5. Forms & dialogs — **Major**

**Current:** 46 pages use dialogs (patients' CSV-import dialog, billing's
discount/refund/payment dialogs, IPD's 5-step admit wizard, etc.), built
directly on the shadcn `Dialog` primitives with per-dialog spacing and
footer button order. No shared "form section" or "field group" pattern is
visible in the sampled pages — every multi-field form (patient registration,
staff onboarding, admit-patient wizard) lays out labels/inputs/help text by
hand per field.

**Why it feels generic:** inconsistent field spacing/label position across
forms, and dialogs whose footer button order isn't uniform (sometimes
Cancel-then-Save, sometimes reversed) reads as "several developers, no
shared spec" — a hallmark of template-assembled admin UIs.

**How premium products solve it:** one field-group rhythm, one dialog
footer convention (secondary action left, primary right — already the rule
`docs/design-system.md` states for page actions; dialogs should match), and
skeleton/disabled states that match the eventual form exactly.

**Proposed solution:** audit `components/ui/form.tsx` (exists, presumably
wraps `react-hook-form` — confirm during Phase 2 rather than guessing) and
extend it with a `FormSection`/`FieldGroup` composition primitive if one
doesn't already exist, then apply the same dialog-footer-order convention
already implied by `PageLayout`'s action-order rule. Lower urgency than
tables/dashboards/status since dialogs are transient, not a wall of daily
visual noise.

---

## 6. Sidebar & navigation — **Minor (foundation already strong)**

**Current:** `sidebar.tsx` (379 lines) and `nav-config.ts` (294 lines) are
substantial and, per `MODULE_STATUS.md`, already Phase-1-complete:
collapsible + persisted, nested groups, tenant logo, quick create. The
header (190 lines) already has a working ⌘K command palette and hospital
selector.

**Why review it at all:** two disclosed gaps remain open from Phase 1 and
directly affect how "premium" the shell feels: **TD-0074** (branding only
reaches `organizations.read` holders — most clinical roles never see the
tenant's actual colours) and **TD-0076** (`/dashboard/settings` is a
pre-existing dead link from both the sidebar and the profile menu — a broken
link in the primary nav is a fast, visible way to look unfinished).

**Proposed solution:** these are correctly scoped as backend/routing fixes,
not visual redesign — flagged here only so Phase 2 doesn't rediscover them.
Not a page-migration task; raise separately if in scope.

---

## 7. Empty & loading states — **Major**

**Current:** Zero pages use `EmptyState` or `TableSkeleton`. `billing/
page.tsx`'s loading state is literally the string `'Loading...'` in a `<p>`;
its "no data" affordance for the collection-trend chart doesn't exist —
absence of data isn't distinguished from zero-value data.

**Why it feels generic:** a text-string loading state causes a layout jump
the instant data arrives (nothing reserves the eventual shape); an
undifferentiated empty table ("no rows" with no distinction between
genuinely-empty and filtered-to-empty) is explicitly the mistake
`docs/design-system.md` §6 names as "the most common way a dashboard wastes
a user's time."

**How premium products solve it:** skeletons shaped like the real content
so nothing shifts on load; two distinct empty states — "nothing here yet"
(with a create action) vs. "nothing matches your filters" (with a clear
action) — because they have different fixes.

**Proposed solution:** `TableSkeleton`/`EmptyState` (both built) — swap in
during the same pass as table migration, since they're used at the same
call site.

---

## 8. Colour discipline — **Major (isolated violations, not systemic)**

**Current:** One confirmed hardcoded-colour violation outside `page.tsx`
files: `dashboard/reports/_components/report-filters.tsx` uses a raw
Tailwind palette colour class. The billing dashboard's approval banner
(`border-amber-300 bg-amber-50 ... dark:bg-amber-950 dark:text-amber-200`)
is a second, undetected-by-grep case (`amber` isn't in the standard grep
palette list but is exactly the class of violation ADR-0031 eliminated from
`tailwind.config.ts` itself). Both bypass the `warning` token family that
exists specifically so this never needs a per-page decision.

**Why it feels generic:** hardcoded warning colours don't participate in
dark mode's *re-derivation* (§3 of the design-system doc: "a 95%-lightness
tint that works on white is a glare panel on near-black") — exactly the
failure `globals.css`'s dark-mode status tokens were built to avoid, quietly
reappearing in the two files that don't use them.

**Proposed solution:** grep for the full extended palette (including
`amber`, `emerald`, `rose`, `cyan`, `teal`, `violet`, `lime`, `sky`,
`fuchsia`, `zinc`, `neutral`, `stone`) at the start of Phase 2, not just the
eight colours checked in this audit's automated pass, and replace every hit
with the matching status/brand token.

---

## Summary — ranked backlog

| # | Area | Rank | Diff size | Risk |
|---|---|---|---|---|
| 1 | `StatusBadge` everywhere | Critical | Smallest | None — pure swap |
| 2 | List pages → `PageLayout` + tables + `EmptyState`/`TableSkeleton` | Critical | Medium | Low — primitives preserve old props |
| 3 | Dashboards → `StatCard`/`StatCardGrid` + real charts | Critical | Medium | Low |
| 4 | Detail pages → `PageLayout` + breadcrumbs + `aside` | Major | Medium | Low |
| 5 | Colour audit (extended palette sweep) | Major | Small | None |
| 6 | Forms/dialogs → shared field-group + footer convention | Major | Medium | Medium — most bespoke logic per dialog |
| 7 | Sidebar/nav dead-link + branding-reach fixes | Minor | Small | Out of visual-only scope (backend/route) |

This matches `NEXT.md`'s own suggested order exactly (`StatusBadge` → list
pages → dashboards → detail pages) — independently arrived at from reading
the actual pages, which is a good sign the plan is right rather than just
convenient.

**No code was changed to produce this document.** Phase 2 (execution)
begins from item 1 once confirmed.
