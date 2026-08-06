'use client'

import { useEffect, useState } from 'react'

/**
 * Chart colours, resolved from the design-system tokens.
 *
 * Charting libraries want concrete colour strings, not CSS variables - a
 * `<Bar fill="hsl(var(--chart-1))" />` works in SVG but breaks the moment the
 * library needs to compute a gradient or a legend swatch. So this reads the
 * computed value of each token once and hands back real `hsl(...)` strings.
 *
 * Series 1 is the organization's brand colour (see `lib/branding/theme.ts`), so
 * the first series on every chart in the product follows the tenant. Series 2
 * and 3 follow their configured accent and secondary. The rest are fixed.
 *
 * The values are re-read when the light/dark class on `<html>` changes and when
 * the branding stylesheet is swapped, because both change what these tokens
 * resolve to.
 */

const CHART_TOKENS = [
  '--chart-1',
  '--chart-2',
  '--chart-3',
  '--chart-4',
  '--chart-5',
  '--chart-6',
  '--chart-7',
  '--chart-8',
] as const

/** Fallbacks used during SSR, where there is no computed style to read. */
const SSR_FALLBACK = [
  'hsl(221 83% 53%)',
  'hsl(173 58% 39%)',
  'hsl(43 74% 46%)',
  'hsl(280 55% 55%)',
  'hsl(12 76% 55%)',
  'hsl(199 89% 42%)',
  'hsl(330 60% 52%)',
  'hsl(94 45% 40%)',
]

function readToken(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return raw ? `hsl(${raw})` : fallback
}

function readPalette(): string[] {
  return CHART_TOKENS.map((token, index) => readToken(token, SSR_FALLBACK[index]))
}

export interface ChartTheme {
  /** Ordered series colours. Index with `series[i % series.length]`. */
  series: string[]
  grid: string
  axis: string
  tooltipBackground: string
  tooltipBorder: string
  tooltipForeground: string
}

function readTheme(): ChartTheme {
  return {
    series: readPalette(),
    grid: readToken('--border', 'hsl(214 20% 90%)'),
    axis: readToken('--muted-foreground', 'hsl(215 14% 43%)'),
    tooltipBackground: readToken('--popover', 'hsl(0 0% 100%)'),
    tooltipBorder: readToken('--border', 'hsl(214 20% 90%)'),
    tooltipForeground: readToken('--popover-foreground', 'hsl(215 25% 12%)'),
  }
}

export function useChartTheme(): ChartTheme {
  const [theme, setTheme] = useState<ChartTheme>(() => readTheme())

  useEffect(() => {
    // Read once on mount: the first render may have been server-side, where the
    // fallbacks were used and the tenant's branding was not yet applied.
    setTheme(readTheme())

    // The `.dark` class toggle and the injected branding <style> both change
    // what these tokens resolve to, and neither fires a React update.
    const observer = new MutationObserver(() => setTheme(readTheme()))
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'style'],
    })
    observer.observe(document.head, { childList: true, subtree: true, characterData: true })

    return () => observer.disconnect()
  }, [])

  return theme
}

/** Non-reactive read, for a one-off render outside a component. */
export function getChartTheme(): ChartTheme {
  return readTheme()
}
