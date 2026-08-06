'use client'

import { useCallback, useEffect, useState } from 'react'

/**
 * Personal appearance preferences that have nowhere to live on the server -
 * there is no `UserPreferences` table (see TD-0076's research). Theme itself
 * is out of scope here; it already persists app-wide through `next-themes`
 * (`ThemeToggle` in `components/layout/header.tsx`) and applies instantly like
 * every other control in this app.
 *
 * These five are genuinely new personal preferences with no existing
 * persistence path, so they're saved to `localStorage` - real, working,
 * browser-scoped persistence - and previewed live in the Appearance section's
 * preview card rather than silently rewritten into the app's chrome, which
 * would fight the design system's tenant-branding rules (see
 * `docs/design-system.md` §3).
 */
export interface AppearancePreferences {
  density: 'comfortable' | 'compact'
  sidebarCollapsedByDefault: boolean
  reduceMotion: boolean
  roundedCorners: boolean
  fontSize: 'sm' | 'default' | 'lg'
  /** A swatch key from `ACCENT_SWATCHES`, or `'brand'` to follow the org's branded primary colour. */
  accentColor: string
}

export const ACCENT_SWATCHES: Array<{ key: string; label: string; swatchClassName: string }> = [
  { key: 'brand', label: 'Organization brand', swatchClassName: 'bg-primary' },
  { key: 'chart-1', label: 'Blue', swatchClassName: 'bg-chart-1' },
  { key: 'chart-2', label: 'Teal', swatchClassName: 'bg-chart-2' },
  { key: 'chart-3', label: 'Violet', swatchClassName: 'bg-chart-3' },
  { key: 'chart-4', label: 'Amber', swatchClassName: 'bg-chart-4' },
  { key: 'chart-5', label: 'Rose', swatchClassName: 'bg-chart-5' },
]

export const DEFAULT_APPEARANCE_PREFERENCES: AppearancePreferences = {
  density: 'comfortable',
  sidebarCollapsedByDefault: false,
  reduceMotion: false,
  roundedCorners: true,
  fontSize: 'default',
  accentColor: 'brand',
}

const STORAGE_KEY = 'medicore.settings.appearance.v1'

function loadStored(): AppearancePreferences {
  if (typeof window === 'undefined') return DEFAULT_APPEARANCE_PREFERENCES
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_APPEARANCE_PREFERENCES
    return { ...DEFAULT_APPEARANCE_PREFERENCES, ...(JSON.parse(raw) as Partial<AppearancePreferences>) }
  } catch {
    return DEFAULT_APPEARANCE_PREFERENCES
  }
}

/**
 * Draft/save semantics matching the rest of the settings workspace: `update`
 * only touches the in-memory draft, `save` is what actually writes to
 * `localStorage`, and `discard` reverts the draft to what's currently saved.
 */
export function useAppearancePreferences() {
  const [saved, setSaved] = useState<AppearancePreferences>(DEFAULT_APPEARANCE_PREFERENCES)
  const [draft, setDraft] = useState<AppearancePreferences>(DEFAULT_APPEARANCE_PREFERENCES)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    const loaded = loadStored()
    setSaved(loaded)
    setDraft(loaded)
    setHydrated(true)
  }, [])

  const update = useCallback(<K extends keyof AppearancePreferences>(key: K, value: AppearancePreferences[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }))
  }, [])

  const save = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(draft))
    }
    setSaved(draft)
  }, [draft])

  const discard = useCallback(() => {
    setDraft(saved)
  }, [saved])

  const isDirty = hydrated && JSON.stringify(draft) !== JSON.stringify(saved)

  return { draft, saved, isDirty, hydrated, update, save, discard }
}
