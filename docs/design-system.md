# MediCore Design System V2

> The design language every screen inherits from. Decision record: **ADR-0031**.
> Phase 1 (this foundation) is complete; Phase 2 is migrating feature pages onto
> it (TD-0077).

The product should read as **enterprise, calm, premium, trustworthy, fast,
medical, dense and relentlessly consistent** — Linear and Stripe Dashboard, not
a gradient-heavy AI dashboard. In practice that means: depth comes from borders
rather than shadows, colour belongs to *data* rather than chrome, motion is a
hint rather than a performance, and no screen invents a pattern another screen
already has.

---

## 1. Where things live

```
apps/web/src/
  app/globals.css              THE token layer — the only place a colour is defined
  components/ui/               Primitives (button, table, badge, page-header, …)
  components/layout/           App shell (sidebar, header, command palette, page layout)
  lib/branding/color.ts        Colour maths + WCAG derivation (43 unit tests)
  lib/branding/theme.ts        Branding → CSS custom properties
  lib/charts/palette.ts        Chart colours resolved from the tokens
  providers/branding-provider  Applies a tenant's branding at runtime
  providers/workspace-provider Active hospital selection
tailwind.config.ts             Token *references* only — contains no colour values
```

There is no `packages/ui`. Earlier `.ai/` documents claimed one; it has never
existed.

---

## 2. The one rule

**Never write a colour value in a component.** Not a hex, not an `rgb()`, not a
Tailwind palette class like `bg-blue-600` or `text-red-500`.

Every colour resolves through a semantic token, because an organization's
branding rewrites that layer at runtime. A hardcoded colour is a colour that
silently ignores the tenant's brand — and, in the status case, a colour that
ignores a clinical convention.

If the colour you need does not exist, **add a token** to `globals.css` (light
*and* dark) and reference it from `tailwind.config.ts`.

### Token families

| Family | Tokens | Use for |
|---|---|---|
| Surface | `background`, `surface`, `surface-secondary`, `surface-hover`, `card`, `popover`, `overlay` | Page → panel → recessed → transient |
| Text | `foreground`, `muted-foreground`, `subtle-foreground` | Body → metadata → decoration only |
| Line | `border`, `border-strong`, `input`, `ring` | |
| Brand | `primary`, `-hover`, `-active`, `-foreground`, `-subtle`, `-subtle-foreground`, `-border` | Branded. Actions, links, selection, focus |
| Brand accent / secondary | `brand-accent-*`, `brand-secondary-*` | Branded. Chart series 2–3, accent badges |
| Neutral interaction | `secondary`, `accent`, `muted` | **Not** branded — hover surfaces, muted buttons |
| Sidebar | `sidebar`, `-foreground`, `-muted`, `-border`, `-item-hover`, `-item-active`, `-item-active-foreground` | The rail's own surface |
| Status | `success`, `warning`, `danger`, `info`, `neutral` × `DEFAULT / foreground / subtle / subtle-foreground / border` | **Never** branded |
| Chart | `chart-1` … `chart-8` | 1–3 follow branding; 4–8 fixed |

`subtle-foreground` is the text colour that sits **on** the matching `subtle`
tint — a different contrast requirement from clearing AA against the page. Use
`bg-danger-subtle text-danger-subtle-foreground`, never
`bg-danger-subtle text-danger`.

Elevation is `shadow-xs|sm|md|lg|xl`; radius is `rounded-xs|sm|md|lg|xl`;
layering is a named scale (`z-sticky`, `z-dropdown`, `z-overlay`, `z-modal`,
`z-toast`, `z-tooltip`) — never an ad-hoc `z-50`.

---

## 3. White-label branding

An organization configures `primaryColor`, `accentColor`, `secondaryColor`,
`displayName`, `loginTagline`, a logo and an email footer
(`/dashboard/organization` → Branding).

`BrandingProvider` turns those into a stylesheet injected into `<head>`, emitting
both a `:root` block and a `.dark` block — dark mode needs a *different*
derivation of the same colour, which inline styles cannot express. From there,
branding flows automatically to buttons, links, focus rings, the sidebar's active
item, badges, progress fills and chart series.

### A configured colour is never trusted

`lib/branding/color.ts` derives seven roles per theme and **moves each one until
it clears WCAG**:

- button text → **4.5:1** against its fill
- pill text → **4.5:1** against its own tint
- dark-mode fill → **3:1** against the dark surface, so it does not vanish
- near-white / near-black / desaturated colours → nudged into a usable band
- a mid-grey fill (where *neither* white nor black text clears 4.5:1) → pushed
  off the lightness midpoint

43 unit tests assert these across seven adversarial colours in both themes.
A tenant cannot make the application unreadable by picking a bad colour.

### Two things branding deliberately does **not** touch

1. **`--accent` / `--secondary`.** They are neutral interaction surfaces used on
   nearly every screen; branding them turns every dropdown hover into a
   saturated block with unreadable text. `accentColor`/`secondaryColor` write
   `--brand-accent-*` / `--brand-secondary-*` instead.
2. **Status colours.** Green-means-normal and red-means-critical are clinical
   conventions. Letting a tenant brand "danger" to their corporate teal would be
   a patient-safety defect, not a customisation.

### In components

```tsx
// Colours: use tokens. Never read a colour from the hook.
<Button>Save</Button>                        // already brand-coloured

// Name and logo only:
const { displayName, logo } = useBranding()
```

**Known gap (TD-0074):** `GET /organizations/me/branding` is gated behind
`organizations.read`, which only Hospital Admin holds — so most clinical users
currently see the default palette. The last successful payload is cached in
`localStorage` per organization, which helps on a returning device but does not
close the gap. The fix is backend-side and was out of scope for Phase 1.

---

## 4. Page anatomy

Every page uses the same skeleton, so moving between Billing, Radiology and IPD
feels like one product:

```tsx
<PageLayout
  breadcrumbs={[{ label: 'Patients', href: '/dashboard/patients' }, { label: patient.fullName }]}
  title={patient.fullName}
  badge={<StatusBadge status={patient.status} />}
  meta={<>
    <PageHeaderMeta label="UHID">{patient.uhid}</PageHeaderMeta>
    <PageHeaderMeta label="Age">{patient.age}</PageHeaderMeta>
  </>}
  actions={<>
    <Button variant="outline" size="sm">Export</Button>
    <Button size="sm">New encounter</Button>
  </>}
  toolbar={<Tabs …/>}
  aside={<Card>…</Card>}   // optional right-hand utility column
>
  …content…
</PageLayout>
```

One `<h1>` per page (`PageHeader`); everything below is `SectionHeader`.
Primary action last in the `actions` row, the way a dialog reads.

---

## 5. Tables

```tsx
<TableContainer className="max-h-[70vh]">
  <Table density="compact" container={false}>
    <TableHeader>{/* sticky by default */}
      <TableRow>
        <TableHead><Checkbox …/></TableHead>
        <TableHead>Patient</TableHead>
        <TableHead align="right">Balance</TableHead>
        <TableHead className="w-24" />
      </TableRow>
    </TableHeader>
    <TableBody>
      <TableRow selected={isSelected} interactive onClick={open}>
        <TableCell><Checkbox …/></TableCell>
        <TableCell><EntityCell name={p.fullName} secondary={p.uhid} mono /></TableCell>
        <TableCell align="right">{fmt(p.balance)}</TableCell>
        <TableCell><TableRowActions>…</TableRowActions></TableCell>
      </TableRow>
    </TableBody>
  </Table>
</TableContainer>

<BulkActionBar count={selected.length} onClear={clear} noun="patient">…</BulkActionBar>
```

- Sticky headers need a **height-bounded** container; scrolling is the
  container's job, never the page's.
- `align="right"` on numeric columns — combined with global tabular numerals,
  that is what makes a currency column comparable at a glance.
- `TableRowActions` fades in on hover but stays keyboard-reachable and is always
  visible on touch.
- `BulkActionBar` is docked, so ticking a checkbox never shifts the rows under
  the pointer.

---

## 6. Status, empty, loading

```tsx
<StatusBadge status="SAMPLE_COLLECTED" />   // → "Sample collected", info tone
```

Tone is decided once, centrally, by *meaning* — terminal-good, in-flight,
waiting-on-a-human, failed/urgent, inert. If a status maps wrongly, **fix the
map**, do not override `tone` at the call site.

```tsx
{isLoading ? <TableSkeleton rows={8} columns={5} />
 : rows.length === 0 && hasFilters
   ? <EmptyState variant="search" title="No patients match these filters"
       secondaryAction={{ label: 'Clear filters', onClick: clear }} />
 : rows.length === 0
   ? <EmptyState title="No patients yet" description="Register the first one."
       action={{ label: 'Register patient', href: '/dashboard/patients/new' }} />
 : <Table …/>}
```

Empty and *filtered*-empty are different states with different fixes; collapsing
them into one grey "No data" is the most common way a dashboard wastes a user's
time.

A missing measurement is `<EmptyValue />` (an em dash) — **never `0`**. "Not
recorded" and "zero" are different clinical and financial facts. `StatCard`
enforces this for you.

Skeletons must match the geometry of what they replace; a centred spinner that
becomes a dense table shifts every row exactly when the user starts reading.

---

## 7. Motion and accessibility

- Durations: `duration-fast` (120ms) for hover/colour, default 160ms, `slow`
  (240ms) for layout. Decelerating ease — never a bounce.
- `prefers-reduced-motion` is honoured globally, including Radix keyframe
  animations.
- One focus treatment for the whole app: a 2px brand ring with an offset, on
  `:focus-visible` only.
- Colour is never the only signal — the sidebar's active item has a marker as
  well as a tint, and `Badge dot` pairs a dot with the label.
- Interactive rows are real controls: focusable, Enter-activatable.
- `subtle-foreground` does not pass AA — decoration only, never information.

---

## 8. Adding to the system

1. Does a primitive already do it? Extend it rather than adding a sibling.
2. Needs a colour? Add a **token** (light *and* dark), then reference it.
3. Never remove a pre-V2 export, variant or prop — ~90 pages still depend on
   them (TD-0077).
4. Verify with `pnpm lint && pnpm typecheck && pnpm test && pnpm build`.
