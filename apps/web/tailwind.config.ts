import type { Config } from 'tailwindcss'

/**
 * MediCore Design System V2 - Tailwind mapping.
 *
 * This file contains **no colour values**. Every colour is a reference to a
 * semantic token declared in `src/app/globals.css`, which an organization's
 * branding rewrites at runtime (see `src/lib/branding/`). If you find yourself
 * adding a hex code here, the token layer is missing something - add it there
 * instead.
 *
 * `<alpha-value>` is threaded through every token so `bg-primary/10`,
 * `ring-ring/40`, `border-border/60` all compose correctly.
 */

/** Wraps a bare HSL-channel token so Tailwind can compose opacity against it. */
const token = (name: string) => `hsl(var(--${name}) / <alpha-value>)`

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)', 'Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'ui-monospace', 'Consolas', 'monospace'],
      },

      /**
       * Type scale. Sizes match Tailwind's defaults so no existing page shifts;
       * what changes is the *leading and tracking* - tightened at display sizes
       * (large text needs less air to feel deliberate) and loosened at caption
       * sizes (small text needs more to stay legible). `2xs` is new, for
       * table metadata and eyebrow labels.
       */
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem', letterSpacing: '0.01em' }],
        xs: ['0.75rem', { lineHeight: '1.125rem' }],
        sm: ['0.875rem', { lineHeight: '1.375rem' }],
        base: ['1rem', { lineHeight: '1.5rem' }],
        lg: ['1.125rem', { lineHeight: '1.625rem', letterSpacing: '-0.006em' }],
        xl: ['1.25rem', { lineHeight: '1.75rem', letterSpacing: '-0.012em' }],
        '2xl': ['1.5rem', { lineHeight: '2rem', letterSpacing: '-0.018em' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem', letterSpacing: '-0.022em' }],
        '4xl': ['2.25rem', { lineHeight: '2.5rem', letterSpacing: '-0.026em' }],
      },

      colors: {
        // ── Structure ────────────────────────────────────────────────────
        border: token('border'),
        'border-strong': token('border-strong'),
        input: token('input'),
        ring: token('ring'),
        background: token('background'),
        foreground: token('foreground'),
        surface: {
          DEFAULT: token('surface'),
          secondary: token('surface-secondary'),
          hover: token('surface-hover'),
        },
        overlay: token('overlay'),

        // ── Brand (rewritten by organization branding) ───────────────────
        primary: {
          DEFAULT: token('primary'),
          hover: token('primary-hover'),
          active: token('primary-active'),
          foreground: token('primary-foreground'),
          subtle: token('primary-subtle'),
          'subtle-foreground': token('primary-subtle-foreground'),
          border: token('primary-border'),
        },
        secondary: {
          DEFAULT: token('secondary'),
          foreground: token('secondary-foreground'),
          hover: token('secondary-hover'),
        },
        /**
         * The organization's accent and secondary brand colours. Kept apart
         * from `accent`/`secondary` above, which are neutral interaction
         * surfaces - see the note in globals.css.
         */
        brand: {
          accent: {
            DEFAULT: token('brand-accent'),
            foreground: token('brand-accent-foreground'),
            subtle: token('brand-accent-subtle'),
            'subtle-foreground': token('brand-accent-subtle-foreground'),
            border: token('brand-accent-border'),
          },
          secondary: {
            DEFAULT: token('brand-secondary'),
            foreground: token('brand-secondary-foreground'),
            subtle: token('brand-secondary-subtle'),
            'subtle-foreground': token('brand-secondary-subtle-foreground'),
            border: token('brand-secondary-border'),
          },
        },
        accent: {
          DEFAULT: token('accent'),
          foreground: token('accent-foreground'),
        },
        muted: {
          DEFAULT: token('muted'),
          foreground: token('muted-foreground'),
        },
        subtle: {
          foreground: token('subtle-foreground'),
        },
        popover: {
          DEFAULT: token('popover'),
          foreground: token('popover-foreground'),
        },
        card: {
          DEFAULT: token('card'),
          foreground: token('card-foreground'),
        },

        // ── Sidebar ──────────────────────────────────────────────────────
        sidebar: {
          DEFAULT: token('sidebar'),
          foreground: token('sidebar-foreground'),
          muted: token('sidebar-muted'),
          border: token('sidebar-border'),
          'item-hover': token('sidebar-item-hover'),
          'item-active': token('sidebar-item-active'),
          'item-active-foreground': token('sidebar-item-active-foreground'),
        },

        // ── Status (fixed by clinical convention, never branded) ─────────
        success: {
          DEFAULT: token('success'),
          foreground: token('success-foreground'),
          subtle: token('success-subtle'),
          'subtle-foreground': token('success-subtle-foreground'),
          border: token('success-border'),
        },
        warning: {
          DEFAULT: token('warning'),
          foreground: token('warning-foreground'),
          subtle: token('warning-subtle'),
          'subtle-foreground': token('warning-subtle-foreground'),
          border: token('warning-border'),
        },
        danger: {
          DEFAULT: token('danger'),
          foreground: token('danger-foreground'),
          subtle: token('danger-subtle'),
          'subtle-foreground': token('danger-subtle-foreground'),
          border: token('danger-border'),
        },
        info: {
          DEFAULT: token('info'),
          foreground: token('info-foreground'),
          subtle: token('info-subtle'),
          'subtle-foreground': token('info-subtle-foreground'),
          border: token('info-border'),
        },
        neutral: {
          subtle: token('neutral-subtle'),
          'subtle-foreground': token('neutral-subtle-foreground'),
          border: token('neutral-border'),
        },
        /** Pre-V2 alias for `danger` - kept so existing pages keep working. */
        destructive: {
          DEFAULT: token('destructive'),
          foreground: token('destructive-foreground'),
        },

        // ── Charts ───────────────────────────────────────────────────────
        chart: {
          1: token('chart-1'),
          2: token('chart-2'),
          3: token('chart-3'),
          4: token('chart-4'),
          5: token('chart-5'),
          6: token('chart-6'),
          7: token('chart-7'),
          8: token('chart-8'),
        },
      },

      borderRadius: {
        xs: 'var(--radius-xs)',
        // shadcn primitives derive these three from `--radius`; kept for them.
        sm: 'calc(var(--radius) - 4px)',
        md: 'calc(var(--radius) - 2px)',
        lg: 'var(--radius)',
        xl: 'var(--radius-xl)',
      },

      boxShadow: {
        xs: 'var(--shadow-xs)',
        sm: 'var(--shadow-sm)',
        DEFAULT: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
        xl: 'var(--shadow-xl)',
        /** Inset hairline used to fake a 0.5px border on a raised surface. */
        hairline: 'inset 0 0 0 1px hsl(var(--border))',
      },

      spacing: {
        header: 'var(--header-height)',
        sidebar: 'var(--sidebar-width)',
        'sidebar-collapsed': 'var(--sidebar-width-collapsed)',
      },

      /**
       * A named z-index scale. Ad-hoc `z-50` everywhere is how overlays end up
       * fighting; these are the only layers that exist.
       *
       * `dropdown` sits above `modal`, not below it: Select/DropdownMenu
       * content is portaled to `document.body` and is very often opened from
       * *inside* an already-open Dialog/Sheet (a "Doctor" select in a form
       * dialog, an export menu in a page toolbar next to a modal) - it must
       * outrank the modal it's nested in, or it renders visually behind it.
       */
      zIndex: {
        base: '0',
        raised: '10',
        sticky: '20',
        overlay: '30',
        modal: '40',
        dropdown: '50',
        toast: '60',
        tooltip: '70',
      },

      transitionDuration: {
        fast: '120ms',
        DEFAULT: '160ms',
        slow: '240ms',
      },

      transitionTimingFunction: {
        // A gentle ease-out. Enterprise motion decelerates into place; it does
        // not bounce.
        DEFAULT: 'cubic-bezier(0.32, 0.72, 0, 1)',
        emphasized: 'cubic-bezier(0.2, 0, 0, 1)',
      },

      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },

      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        shimmer: 'shimmer 1.6s infinite',
        'fade-in': 'fade-in 160ms ease-out',
        'slide-up': 'slide-up 200ms cubic-bezier(0.32, 0.72, 0, 1)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}

export default config
