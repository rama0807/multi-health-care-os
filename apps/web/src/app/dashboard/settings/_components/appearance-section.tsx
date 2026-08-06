'use client'

import { Laptop2, Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import * as React from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { SectionHeader } from '@/components/ui/page-header'
import { ACCENT_SWATCHES, useAppearancePreferences } from '@/lib/settings/use-appearance-preferences'
import { cn } from '@/lib/utils'

import { useRegisterSettingsFooter } from './settings-footer-context'

const THEME_OPTIONS = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Laptop2 },
] as const

const FONT_SIZES = [
  { value: 'sm', label: 'Small', previewClass: 'text-sm' },
  { value: 'default', label: 'Default', previewClass: 'text-base' },
  { value: 'lg', label: 'Large', previewClass: 'text-lg' },
] as const

/**
 * Theme is real and applies instantly, app-wide, through `next-themes` -
 * exactly like the header's `ThemeToggle`; this is a second entry point to
 * the same control, not a competing one.
 *
 * Everything else here (density, sidebar default, motion, corners, font
 * size, accent) has no backend to persist to. Rather than silently doing
 * nothing, they're saved to this browser via `useAppearancePreferences` and
 * demonstrated live in the preview card below - real, working, just scoped
 * to localStorage instead of the server. See that hook for why accent colour
 * previews here rather than repainting the app (it would fight the tenant
 * branding rules in `docs/design-system.md`).
 */
export function AppearanceSection() {
  const { theme, setTheme } = useTheme()
  const { draft, isDirty, hydrated, update, save, discard } = useAppearancePreferences()

  useRegisterSettingsFooter({ isDirty, onSave: save, onDiscard: discard })

  const accent = ACCENT_SWATCHES.find((s) => s.key === draft.accentColor) ?? ACCENT_SWATCHES[0]

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Appearance"
        description="Theme applies immediately, everywhere. Everything below is saved to this browser and previewed live on the right - not applied to the whole app, so it never fights your organization's branding."
      />

      <Card>
        <CardHeader>
          <CardTitle>Theme</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-2">
            {THEME_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setTheme(option.value)}
                className={cn(
                  'flex flex-col items-center gap-1.5 rounded-lg border p-3 text-sm font-medium transition-colors duration-fast',
                  theme === option.value
                    ? 'border-primary bg-primary-subtle text-primary-subtle-foreground'
                    : 'border-border text-muted-foreground hover:border-border-strong hover:text-foreground',
                )}
              >
                <option.icon className="size-4" aria-hidden="true" />
                {option.label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Density</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2">
                {(['comfortable', 'compact'] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    disabled={!hydrated}
                    onClick={() => update('density', value)}
                    className={cn(
                      'rounded-lg border p-3 text-left text-sm font-medium capitalize transition-colors duration-fast',
                      draft.density === value
                        ? 'border-primary bg-primary-subtle text-primary-subtle-foreground'
                        : 'border-border text-muted-foreground hover:border-border-strong hover:text-foreground',
                    )}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Layout</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <label className="flex cursor-pointer items-start gap-3 rounded-md border p-3 hover:bg-accent/40">
                <Checkbox
                  checked={draft.sidebarCollapsedByDefault}
                  disabled={!hydrated}
                  onCheckedChange={(checked) => update('sidebarCollapsedByDefault', checked === true)}
                  className="mt-0.5"
                />
                <span className="space-y-0.5">
                  <span className="block text-sm font-medium">Sidebar collapsed by default</span>
                  <span className="block text-xs text-muted-foreground">
                    Previewed on the right only - the real sidebar isn&apos;t wired to this yet.
                  </span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-3 rounded-md border p-3 hover:bg-accent/40">
                <Checkbox
                  checked={draft.reduceMotion}
                  disabled={!hydrated}
                  onCheckedChange={(checked) => update('reduceMotion', checked === true)}
                  className="mt-0.5"
                />
                <span className="space-y-0.5">
                  <span className="block text-sm font-medium">Reduce motion</span>
                  <span className="block text-xs text-muted-foreground">
                    Stops the preview card&apos;s transition. A screen-wide reduced-motion mode isn&apos;t built yet -
                    see Accessibility.
                  </span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-3 rounded-md border p-3 hover:bg-accent/40">
                <Checkbox
                  checked={draft.roundedCorners}
                  disabled={!hydrated}
                  onCheckedChange={(checked) => update('roundedCorners', checked === true)}
                  className="mt-0.5"
                />
                <span className="space-y-0.5">
                  <span className="block text-sm font-medium">Rounded corners</span>
                  <span className="block text-xs text-muted-foreground">Square vs. rounded, shown in the preview.</span>
                </span>
              </label>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Font size</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-2">
                {FONT_SIZES.map((size) => (
                  <button
                    key={size.value}
                    type="button"
                    disabled={!hydrated}
                    onClick={() => update('fontSize', size.value)}
                    className={cn(
                      'rounded-lg border p-3 text-sm font-medium transition-colors duration-fast',
                      draft.fontSize === size.value
                        ? 'border-primary bg-primary-subtle text-primary-subtle-foreground'
                        : 'border-border text-muted-foreground hover:border-border-strong hover:text-foreground',
                    )}
                  >
                    {size.label}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Accent colour</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {ACCENT_SWATCHES.map((swatch) => (
                  <button
                    key={swatch.key}
                    type="button"
                    disabled={!hydrated}
                    aria-label={swatch.label}
                    onClick={() => update('accentColor', swatch.key)}
                    className={cn(
                      'flex size-9 items-center justify-center rounded-full border-2 transition-shadow',
                      draft.accentColor === swatch.key ? 'border-foreground' : 'border-transparent',
                    )}
                  >
                    <span className={cn('size-6 rounded-full', swatch.swatchClassName)} />
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Used only in the preview card - your organization&apos;s brand colour still drives the real app.
              </p>
            </CardContent>
          </Card>
        </div>

        <Card
          className={cn('h-fit p-4 transition-[border-radius]', !draft.roundedCorners && 'rounded-none')}
          style={{ transitionDuration: draft.reduceMotion ? '0ms' : undefined }}
        >
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-subtle-foreground">Preview</p>
          <div
            className={cn(
              'rounded-lg border bg-surface',
              draft.density === 'compact' ? 'space-y-2 p-2.5' : 'space-y-3 p-4',
              !draft.roundedCorners && 'rounded-none',
            )}
          >
            <div className="flex items-center justify-between">
              <span className={cn('font-semibold text-foreground', FONT_SIZES.find((f) => f.value === draft.fontSize)?.previewClass)}>
                Patient queue
              </span>
              <Badge variant="outline" size="sm">
                {draft.sidebarCollapsedByDefault ? 'Rail collapsed' : 'Rail expanded'}
              </Badge>
            </div>
            <div className={cn('flex items-center gap-2 rounded-md border p-2', !draft.roundedCorners && 'rounded-none')}>
              <span className={cn('size-2.5 rounded-full', accent.swatchClassName)} />
              <span className={cn('text-muted-foreground', FONT_SIZES.find((f) => f.value === draft.fontSize)?.previewClass)}>
                Next: Aarav Sharma · 10:30
              </span>
            </div>
            <Button size="sm" className={cn(!draft.roundedCorners && 'rounded-none')}>
              Sample action
            </Button>
          </div>
        </Card>
      </div>
    </div>
  )
}
