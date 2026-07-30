# MediCore Design System

> The design language of MediCore is **clinical clarity** — information-dense, functional, and trustworthy. Inspired by Linear and Stripe Dashboard: no decorative flourishes, no gradients, no shadows for their own sake. Every pixel serves a purpose.

---

## Design Principles

1. **Density over emptiness** — Healthcare professionals need information, not whitespace. Tables show 20 rows by default.
2. **Predictability** — Identical interactions produce identical results. No surprises.
3. **Status at a glance** — Color carries semantic meaning. Red means urgent, green means complete.
4. **Keyboard-first** — Every action reachable without a mouse for power users.
5. **Accessible** — WCAG 2.1 AA minimum. Color is never the only indicator.

---

## Typography

**Font Stack:**
```css
--font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
--font-mono: 'JetBrains Mono', 'Fira Code', Consolas, monospace;
```

| Token | Size | Weight | Line Height | Usage |
|-------|------|--------|-------------|-------|
| `text-xs` | 11px | 400 | 1.5 | Table metadata, timestamps |
| `text-sm` | 13px | 400 | 1.5 | Body text, form labels, table cells |
| `text-base` | 14px | 400 | 1.5 | Default body |
| `text-md` | 15px | 500 | 1.4 | Subheadings, card titles |
| `text-lg` | 18px | 600 | 1.3 | Section headings |
| `text-xl` | 22px | 700 | 1.2 | Page headings |
| `text-2xl` | 28px | 700 | 1.1 | Dashboard metric numbers |

**Numeric display:** Always use tabular figures (`font-variant-numeric: tabular-nums`) in tables, metrics, and anywhere numbers need to align.

---

## Color System

All colors defined as CSS custom properties. Dark mode inverts surface and text, keeps semantic colors.

### Neutral Palette (Zinc-based)

```css
--color-bg:           #FAFAFA;  /* Page background */
--color-surface:      #FFFFFF;  /* Cards, panels */
--color-surface-2:    #F4F4F5;  /* Striped rows, hover states */
--color-border:       #E4E4E7;  /* Borders */
--color-border-2:     #D4D4D8;  /* Active borders */
--color-text:         #18181B;  /* Primary text */
--color-text-muted:   #71717A;  /* Secondary text, placeholders */
--color-text-subtle:  #A1A1AA;  /* Tertiary, disabled */

/* Dark mode */
--color-bg:           #09090B;
--color-surface:      #18181B;
--color-surface-2:    #27272A;
--color-border:       #27272A;
--color-text:         #FAFAFA;
--color-text-muted:   #A1A1AA;
```

### Brand Palette

```css
--color-primary:      #2563EB;  /* Blue-600: CTAs, links, active states */
--color-primary-hover: #1D4ED8; /* Blue-700 */
--color-primary-subtle: #EFF6FF; /* Blue-50: backgrounds, badges */
```

### Semantic Colors

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `--color-success` | #16A34A | #22C55E | Completed, discharged, paid |
| `--color-warning` | #D97706 | #F59E0B | Pending, awaiting, review |
| `--color-danger` | #DC2626 | #EF4444 | Critical, overdue, error |
| `--color-info` | #0891B2 | #22D3EE | Info badges, scheduled |

### Clinical Status Colors

| Status | Color | Usage |
|--------|-------|-------|
| Confirmed | `#16A34A` (green) | Appointment confirmed, payment received |
| Pending | `#D97706` (amber) | Awaiting action |
| Critical | `#DC2626` (red) | Lab abnormal, urgent, overdue |
| Cancelled | `#71717A` (gray) | Cancelled appointments, void invoices |
| In Progress | `#2563EB` (blue) | Active consultations, in-lab |
| Scheduled | `#0891B2` (cyan) | Future appointments |

---

## Spacing

4px base unit. All spacing is multiples of 4.

```css
--space-1:  4px
--space-2:  8px
--space-3:  12px
--space-4:  16px
--space-5:  20px
--space-6:  24px
--space-8:  32px
--space-10: 40px
--space-12: 48px
--space-16: 64px
```

---

## Components

### Tables

The most important component. Used everywhere.

```
┌─────────────────────────────────────────────────────────────────────┐
│  Patients                                        [+ Add Patient]    │
│  ─────────────────────────────────────────────────────────────────  │
│  [Search patients...]  [Filter ▾]  [Status: All ▾]  [Export]       │
│  ─────────────────────────────────────────────────────────────────  │
│  □  UHID          Name               Age  Status      Last Visit    │
│  ─────────────────────────────────────────────────────────────────  │
│  □  MED-2024-0001  Rahul Sharma       34   ● Active    Jan 14, 2024  │
│  □  MED-2024-0002  Priya Patel        28   ● Active    Jan 13, 2024  │
│  □  MED-2024-0003  Arjun Nair         52   ○ Inactive  Dec 20, 2023  │
│  ─────────────────────────────────────────────────────────────────  │
│  Showing 1–20 of 1,247                    [‹ Prev]  [1] 2 3  [Next ›]│
└─────────────────────────────────────────────────────────────────────┘
```

Table rules:
- Default 20 rows per page
- Sticky header on scroll
- Checkbox column for bulk actions
- Clicking a row navigates to detail view
- Status indicators use colored dots, not full badges (saves space)
- Date columns always show human-readable format with relative time on hover

### Forms

```
┌─────────────────────────────────────────────────────────────────────┐
│  Register New Patient                                               │
│  ─────────────────────────────────────────────────────────────────  │
│  Personal Information                                               │
│                                                                     │
│  First Name *              Last Name *                              │
│  ┌────────────────────┐   ┌────────────────────┐                   │
│  │ Rahul              │   │ Sharma             │                   │
│  └────────────────────┘   └────────────────────┘                   │
│                                                                     │
│  Date of Birth *           Gender *                                 │
│  ┌────────────────────┐   ┌────────────────────┐                   │
│  │ 15 Mar 1990        │   │ Male           ▾  │                   │
│  └────────────────────┘   └────────────────────┘                   │
│                                                                     │
│  Mobile Number *                                                    │
│  ┌─────────────────────────────────────────────┐                   │
│  │ +91  9876543210                             │                   │
│  └─────────────────────────────────────────────┘                   │
│  ─────────────────────────────────────────────────────────────────  │
│                                    [Cancel]  [Register Patient]     │
└─────────────────────────────────────────────────────────────────────┘
```

Form rules:
- Labels always above inputs (not inline — accessibility)
- Required fields marked with `*` and explained at top
- Inline validation on blur, not on keystroke
- Error messages below the field in red, never as toast
- Keyboard-navigable (Tab order follows visual order)
- Submit button always at bottom-right

### Cards / Stat Cards

```
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│  Today's OPD     │  │  Admitted        │  │  Pending Bills   │
│                  │  │                  │  │                  │
│  247             │  │  32 patients     │  │  ₹ 1,24,500      │
│                  │  │                  │  │                  │
│  ↑ 12% vs yest.  │  │  ──── beds       │  │  18 invoices     │
└──────────────────┘  └──────────────────┘  └──────────────────┘
```

### Navigation

Left sidebar navigation (fixed, 240px):

```
┌──────────────────────────┐
│  🏥 MediCore             │
│  Apollo Hospital         │
│  ─────────────────────   │
│  ○ Dashboard             │
│  ● Patients              │  ← Active state: filled dot + bold
│  ○ Appointments          │
│  ─────────────────────   │
│  Clinical                │  ← Section header (uppercase, muted)
│  ○ Medical Records       │
│  ○ Prescriptions         │
│  ○ Laboratory            │
│  ○ Radiology             │
│  ─────────────────────   │
│  Operations              │
│  ○ Billing               │
│  ○ Insurance             │
│  ○ Pharmacy              │
│  ○ Inventory             │
│  ─────────────────────   │
│  Admin                   │
│  ○ Staff                 │
│  ○ Reports               │
│  ○ Settings              │
│  ─────────────────────   │
│  Dr. Ankit Sharma        │  ← User footer
│  [logout icon]           │
└──────────────────────────┘
```

### Badges / Status Pills

Small, inline indicators. Used in tables and detail views.

```
Active        → green background, green text
Inactive      → gray background, gray text
Scheduled     → blue background, blue text
In Progress   → amber background, amber text
Completed     → green background, green text
Cancelled     → red background, red text
Critical      → red background, white text, bold
```

---

## Dashboard Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│ [≡] MediCore    Search...                    [🔔] [Dr. Sharma ▾]   │
├──────────────┬──────────────────────────────────────────────────────┤
│              │  Dashboard                         Jan 15, 2024      │
│  ○ Dashboard │  ────────────────────────────────────────────────── │
│  ● Patients  │                                                      │
│  ○ Appts     │  ┌──────────┐  ┌──────────┐  ┌──────────┐          │
│  ─────────── │  │ Today's  │  │ Admitted │  │ Pending  │          │
│  Clinical    │  │ OPD: 247 │  │  32      │  │ Bills    │          │
│  ○ Records   │  └──────────┘  └──────────┘  └──────────┘          │
│  ○ Lab       │                                                      │
│  ○ Radiology │  Today's Appointments                               │
│  ─────────── │  ─────────────────────────────────────────────────  │
│  Operations  │  10:00  Rahul Sharma  Dr. Verma   OPD  ● Waiting   │
│  ○ Billing   │  10:15  Priya Patel   Dr. Verma   OPD  ● In Room   │
│  ○ Pharmacy  │  10:30  Arjun Nair    Dr. Kumar   Card ● Scheduled │
│  ─────────── │                                                      │
│  Admin       │  Recent Registrations                               │
│  ○ Staff     │  ─────────────────────────────────────────────────  │
│  ○ Settings  │  ...                                                 │
│              │                                                      │
└──────────────┴──────────────────────────────────────────────────────┘
```

---

## Dark Mode

Dark mode is a first-class concern, toggled via `class="dark"` on `<html>`.

All color tokens have dark equivalents. The dark palette uses zinc-900 as base background, zinc-800 for surfaces. No blue-black — zinc keeps it warm and readable.

Dark mode preference is stored in `localStorage` and synced to the server profile.

---

## Accessibility

- All interactive elements have visible focus rings
- Focus ring uses `outline: 2px solid var(--color-primary)` with 2px offset
- Color contrast minimum 4.5:1 for normal text, 3:1 for large text
- All form inputs have associated `<label>` elements
- Tables use `<th scope="col">` for headers
- Status indicators include text alongside color
- Keyboard navigation: Tab, Shift+Tab, Arrow keys in dropdowns/menus
- ARIA live regions for toast notifications and dynamic content updates
- Screen reader testing with NVDA (Windows) and VoiceOver (Mac)
