import type { OrganizationBranding } from '@medicore/types'

import {
  deriveBrandRoles,
  deriveSidebarRoles,
  hexToHsl,
  hslToTokenString,
  type Hsl,
} from './color'

/**
 * Turns an organization's branding record into the CSS custom properties the
 * design system reads.
 *
 * Emitted as a stylesheet rather than inline styles on `<html>` for one
 * reason: dark mode. The app toggles a `.dark` class, and a tenant's palette
 * needs a *different* derivation under it - a mid-blue that is perfect on white
 * is invisible on near-black. Inline styles can only express one set of values;
 * a stylesheet expresses both and lets the cascade pick.
 */

export type ThemeMode = 'light' | 'dark'

/** Only these tokens are tenant-writable. Nothing else in the layer moves. */
const BRAND_TOKENS = [
  'primary',
  'primary-hover',
  'primary-active',
  'primary-foreground',
  'primary-subtle',
  'primary-subtle-foreground',
  'primary-border',
  'ring',
  'sidebar-item-active',
  'sidebar-item-active-foreground',
  'chart-1',
  'brand-accent',
  'brand-accent-foreground',
  'brand-accent-subtle',
  'brand-accent-subtle-foreground',
  'brand-accent-border',
  'chart-2',
  'brand-secondary',
  'brand-secondary-foreground',
  'brand-secondary-subtle',
  'brand-secondary-subtle-foreground',
  'brand-secondary-border',
  'chart-3',
] as const

export type BrandToken = (typeof BRAND_TOKENS)[number]

/** The `<style>` element id, so re-applying replaces rather than stacking. */
export const BRANDING_STYLE_ELEMENT_ID = 'medicore-branding'

function primaryTokens(color: Hsl, mode: ThemeMode): Partial<Record<BrandToken, string>> {
  const roles = deriveBrandRoles(color, mode)
  const sidebar = deriveSidebarRoles(roles, mode)

  return {
    primary: hslToTokenString(roles.base),
    'primary-hover': hslToTokenString(roles.hover),
    'primary-active': hslToTokenString(roles.active),
    'primary-foreground': hslToTokenString(roles.foreground),
    'primary-subtle': hslToTokenString(roles.subtle),
    'primary-subtle-foreground': hslToTokenString(roles.subtleForeground),
    'primary-border': hslToTokenString(roles.border),
    // The focus ring follows the brand - it is the most repeated brand moment
    // in a keyboard-driven clinical UI.
    ring: hslToTokenString(roles.base),
    'sidebar-item-active': hslToTokenString(sidebar.itemActive),
    'sidebar-item-active-foreground': hslToTokenString(sidebar.itemActiveForeground),
    // Series 1 is the brand, so "our number" is brand-coloured on every chart.
    'chart-1': hslToTokenString(roles.base),
  }
}

function accentTokens(color: Hsl, mode: ThemeMode): Partial<Record<BrandToken, string>> {
  const roles = deriveBrandRoles(color, mode)
  return {
    'brand-accent': hslToTokenString(roles.base),
    'brand-accent-foreground': hslToTokenString(roles.foreground),
    'brand-accent-subtle': hslToTokenString(roles.subtle),
    'brand-accent-subtle-foreground': hslToTokenString(roles.subtleForeground),
    'brand-accent-border': hslToTokenString(roles.border),
    'chart-2': hslToTokenString(roles.base),
  }
}

function secondaryTokens(color: Hsl, mode: ThemeMode): Partial<Record<BrandToken, string>> {
  const roles = deriveBrandRoles(color, mode)
  return {
    'brand-secondary': hslToTokenString(roles.base),
    'brand-secondary-foreground': hslToTokenString(roles.foreground),
    'brand-secondary-subtle': hslToTokenString(roles.subtle),
    'brand-secondary-subtle-foreground': hslToTokenString(roles.subtleForeground),
    'brand-secondary-border': hslToTokenString(roles.border),
    'chart-3': hslToTokenString(roles.base),
  }
}

/**
 * Resolves every tenant-writable token for one mode. An unset or unparseable
 * colour contributes nothing, so the default palette shows through - a tenant
 * who configures only a primary keeps MediCore's accent and secondary rather
 * than getting a half-applied theme.
 */
export function resolveBrandTokens(
  branding: OrganizationBranding | null | undefined,
  mode: ThemeMode,
): Partial<Record<BrandToken, string>> {
  if (!branding) return {}

  const primary = branding.primaryColor ? hexToHsl(branding.primaryColor) : null
  const accent = branding.accentColor ? hexToHsl(branding.accentColor) : null
  const secondary = branding.secondaryColor ? hexToHsl(branding.secondaryColor) : null

  return {
    ...(primary ? primaryTokens(primary, mode) : {}),
    ...(accent ? accentTokens(accent, mode) : {}),
    ...(secondary ? secondaryTokens(secondary, mode) : {}),
  }
}

function declarations(tokens: Partial<Record<BrandToken, string>>): string {
  return Object.entries(tokens)
    .map(([name, value]) => `--${name}:${value};`)
    .join('')
}

/**
 * Builds the full stylesheet - light values on `:root`, dark values under
 * `.dark`. Returns an empty string when the organization has configured
 * nothing, so no element is injected at all in the default case.
 */
export function buildBrandingStylesheet(
  branding: OrganizationBranding | null | undefined,
): string {
  const light = resolveBrandTokens(branding, 'light')
  const dark = resolveBrandTokens(branding, 'dark')

  if (Object.keys(light).length === 0 && Object.keys(dark).length === 0) return ''

  const blocks: string[] = []
  if (Object.keys(light).length > 0) blocks.push(`:root{${declarations(light)}}`)
  if (Object.keys(dark).length > 0) blocks.push(`.dark{${declarations(dark)}}`)
  return blocks.join('')
}

/**
 * Writes the stylesheet into the document, replacing any previous one.
 * No-ops outside the browser so it is safe to call from a shared code path.
 */
export function applyBrandingStylesheet(css: string): void {
  if (typeof document === 'undefined') return

  const existing = document.getElementById(BRANDING_STYLE_ELEMENT_ID)

  if (!css) {
    existing?.remove()
    return
  }

  if (existing instanceof HTMLStyleElement) {
    if (existing.textContent !== css) existing.textContent = css
    return
  }

  const style = document.createElement('style')
  style.id = BRANDING_STYLE_ELEMENT_ID
  style.textContent = css
  document.head.appendChild(style)
}
