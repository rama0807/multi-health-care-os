/**
 * Colour maths for white-label branding.
 *
 * An organization configures a single hex colour. That colour has to work as a
 * button fill, as button *text* on a tinted pill, as a selected-row background,
 * as a border, and as a chart series — in both light and dark mode — while
 * staying legible. A tenant that picks `#FFFF00` or `#0A0A0A` must not be able
 * to render an unreadable application.
 *
 * So nothing here trusts the input colour directly. Every derived role is
 * checked against WCAG 2.1 contrast and *moved* until it passes, rather than
 * being rendered as configured and hoping. All of it is pure and synchronous so
 * it can run during the first paint and be unit-tested without a DOM.
 */

export interface Hsl {
  /** 0–360 */
  h: number
  /** 0–100 */
  s: number
  /** 0–100 */
  l: number
}

/** WCAG AA for normal-size text. */
export const AA_TEXT = 4.5
/** WCAG AA for large text (≥18.66px bold / 24px regular) and UI components. */
export const AA_LARGE = 3

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

const round = (value: number, places = 2) => {
  const factor = 10 ** places
  return Math.round(value * factor) / factor
}

/**
 * Parses `#rgb`, `#rrggbb` (with or without the hash). Returns `null` for
 * anything else — callers fall back to the default palette rather than
 * throwing, because a malformed branding value must never white-screen the app.
 */
export function parseHex(input: string): { r: number; g: number; b: number } | null {
  if (typeof input !== 'string') return null
  const hex = input.trim().replace(/^#/, '')

  if (/^[0-9a-f]{3}$/i.test(hex)) {
    return {
      r: parseInt(hex[0] + hex[0], 16),
      g: parseInt(hex[1] + hex[1], 16),
      b: parseInt(hex[2] + hex[2], 16),
    }
  }

  if (/^[0-9a-f]{6}$/i.test(hex)) {
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
    }
  }

  return null
}

export function hexToHsl(input: string): Hsl | null {
  const rgb = parseHex(input)
  if (!rgb) return null

  const r = rgb.r / 255
  const g = rgb.g / 255
  const b = rgb.b / 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const delta = max - min
  const l = (max + min) / 2

  let h = 0
  let s = 0

  if (delta !== 0) {
    s = delta / (1 - Math.abs(2 * l - 1))
    switch (max) {
      case r:
        h = ((g - b) / delta) % 6
        break
      case g:
        h = (b - r) / delta + 2
        break
      default:
        h = (r - g) / delta + 4
    }
    h *= 60
    if (h < 0) h += 360
  }

  return { h: round(h, 1), s: round(clamp(s * 100, 0, 100), 1), l: round(clamp(l * 100, 0, 100), 1) }
}

export function hslToRgb({ h, s, l }: Hsl): { r: number; g: number; b: number } {
  const sat = clamp(s, 0, 100) / 100
  const lig = clamp(l, 0, 100) / 100
  const c = (1 - Math.abs(2 * lig - 1)) * sat
  const hp = (((h % 360) + 360) % 360) / 60
  const x = c * (1 - Math.abs((hp % 2) - 1))

  let rgb: [number, number, number]
  if (hp < 1) rgb = [c, x, 0]
  else if (hp < 2) rgb = [x, c, 0]
  else if (hp < 3) rgb = [0, c, x]
  else if (hp < 4) rgb = [0, x, c]
  else if (hp < 5) rgb = [x, 0, c]
  else rgb = [c, 0, x]

  const m = lig - c / 2
  return {
    r: Math.round((rgb[0] + m) * 255),
    g: Math.round((rgb[1] + m) * 255),
    b: Math.round((rgb[2] + m) * 255),
  }
}

/** Serialises to the bare-channel form the CSS token layer expects. */
export function hslToTokenString({ h, s, l }: Hsl): string {
  return `${round(((h % 360) + 360) % 360, 1)} ${round(clamp(s, 0, 100), 1)}% ${round(clamp(l, 0, 100), 1)}%`
}

export function hslToHex(hsl: Hsl): string {
  const { r, g, b } = hslToRgb(hsl)
  const hex = (n: number) => n.toString(16).padStart(2, '0')
  return `#${hex(r)}${hex(g)}${hex(b)}`
}

/** WCAG 2.1 relative luminance. */
export function relativeLuminance(hsl: Hsl): number {
  const { r, g, b } = hslToRgb(hsl)
  const channel = (value: number) => {
    const v = value / 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

/** WCAG 2.1 contrast ratio, 1–21. Order-independent. */
export function contrastRatio(a: Hsl, b: Hsl): number {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  const lighter = Math.max(la, lb)
  const darker = Math.min(la, lb)
  return round((lighter + 0.05) / (darker + 0.05), 3)
}

/**
 * Picks whichever of near-white / near-black is more readable **on** the given
 * colour. Not pure white and pure black: at full contrast the edge of a filled
 * button shimmers, and every serious design system pulls both ends in slightly.
 */
export function readableForeground(background: Hsl): Hsl {
  const light: Hsl = { h: background.h, s: Math.min(background.s, 20), l: 99 }
  const dark: Hsl = { h: background.h, s: Math.min(background.s, 30), l: 12 }
  return contrastRatio(light, background) >= contrastRatio(dark, background) ? light : dark
}

/**
 * Walks a colour's lightness — in the direction that helps — until it clears
 * `target` against `against`, or until it runs out of room.
 *
 * Returns the best colour it found. It never *throws* on an impossible
 * request: a caller asking for 7:1 between two mid-greys should get the most
 * contrasting pair available, not an exception during render.
 */
export function ensureContrast(
  color: Hsl,
  against: Hsl,
  target: number,
  options: { direction?: 'darker' | 'lighter' | 'auto' } = {},
): Hsl {
  if (contrastRatio(color, against) >= target) return color

  const direction =
    options.direction && options.direction !== 'auto'
      ? options.direction
      : relativeLuminance(against) > 0.5
        ? 'darker'
        : 'lighter'

  const step = direction === 'darker' ? -1 : 1
  let best = color
  let bestRatio = contrastRatio(color, against)

  for (let l = color.l + step; l >= 0 && l <= 100; l += step) {
    const candidate: Hsl = { ...color, l }
    const ratio = contrastRatio(candidate, against)
    if (ratio > bestRatio) {
      bestRatio = ratio
      best = candidate
    }
    if (ratio >= target) return candidate
  }

  return best
}

/** Lightness shift, clamped. Positive lightens. */
export function shiftLightness(color: Hsl, delta: number): Hsl {
  return { ...color, l: round(clamp(color.l + delta, 0, 100), 1) }
}

/** Saturation shift, clamped. */
export function shiftSaturation(color: Hsl, delta: number): Hsl {
  return { ...color, s: round(clamp(color.s + delta, 0, 100), 1) }
}

/**
 * The seven brand roles the token layer exposes, derived from one hex colour.
 *
 * `base` is deliberately *not* guaranteed to equal the configured colour: a
 * near-white or near-black brand colour is nudged into a usable band first
 * (a `#FFFFFF` primary would otherwise produce an invisible button). The
 * configured colour is preserved exactly whenever it is usable, which is the
 * overwhelmingly common case.
 */
export interface BrandRoles {
  base: Hsl
  hover: Hsl
  active: Hsl
  foreground: Hsl
  subtle: Hsl
  subtleForeground: Hsl
  border: Hsl
}

export function deriveBrandRoles(color: Hsl, mode: 'light' | 'dark'): BrandRoles {
  const surface: Hsl =
    mode === 'light' ? { h: 0, s: 0, l: 100 } : { h: 220, s: 20, l: 11 }

  // 1. Keep the solid fill inside a band where a readable foreground exists at
  //    all. Outside it, no text colour clears AA on the fill.
  const bandMin = mode === 'light' ? 22 : 30
  const bandMax = mode === 'light' ? 68 : 78
  let base: Hsl = { ...color, l: clamp(color.l, bandMin, bandMax) }

  // A fully desaturated "brand" colour is legal but reads as a bug; nudge it
  // just enough to look intentional without inventing a hue the tenant didn't
  // choose.
  if (base.s < 6) base = shiftSaturation(base, 6 - base.s)

  // 2. In dark mode a mid-dark brand disappears against the surface. Lift it
  //    until the fill itself is distinguishable as a component (3:1).
  if (mode === 'dark') {
    base = ensureContrast(base, surface, AA_LARGE, { direction: 'lighter' })
  }

  // 3. A fill sitting near 50% lightness is the one case where *neither* light
  //    nor dark text clears AA — mid-grey tops out around 4.2:1 either way. The
  //    band in step 1 does not catch it, because the limit is not the band but
  //    the colour's own luminance. Push the fill off the midpoint, in whichever
  //    direction the better text candidate is already pulling.
  let foreground = readableForeground(base)
  if (contrastRatio(foreground, base) < AA_TEXT) {
    base = ensureContrast(base, foreground, AA_TEXT, {
      direction: foreground.l > 50 ? 'darker' : 'lighter',
    })
    foreground = readableForeground(base)
  }

  // 4. Interaction states move *away* from the surface, so hover always reads
  //    as "more", never as "faded", in both modes.
  const interactionStep = mode === 'light' ? -6 : 6
  const hover = shiftLightness(base, interactionStep)
  const active = shiftLightness(base, interactionStep * 2)

  // 5. Text on the solid fill. Forced to AA — this is button copy.
  foreground = ensureContrast(foreground, base, AA_TEXT)

  // 5. The tint used for pills, selected rows and soft buttons, plus the text
  //    that sits on it. The tint is a wash of the brand hue; the text is the
  //    brand colour pushed until it clears AA *against that tint* — which is a
  //    different requirement from clearing AA against the page.
  const subtle: Hsl =
    mode === 'light'
      ? { h: base.h, s: clamp(base.s, 0, 85), l: 96 }
      : { h: base.h, s: clamp(base.s * 0.7, 0, 60), l: 18 }

  const subtleForeground = ensureContrast(
    { ...base, l: mode === 'light' ? Math.min(base.l, 40) : Math.max(base.l, 72) },
    subtle,
    AA_TEXT,
    { direction: mode === 'light' ? 'darker' : 'lighter' },
  )

  // 6. Border only has to be *perceivable*, not readable — 1.5:1 against the
  //    surface is the conventional floor for a decorative edge.
  const border: Hsl =
    mode === 'light'
      ? { h: base.h, s: clamp(base.s * 0.6, 0, 70), l: 86 }
      : { h: base.h, s: clamp(base.s * 0.5, 0, 50), l: 30 }

  return { base, hover, active, foreground, subtle, subtleForeground, border }
}

/**
 * Sidebar treatment derived from the brand.
 *
 * The rail keeps a neutral surface — a fully brand-coloured sidebar is a 2014
 * look and destroys the calm this system is after — but the *active item*
 * carries the brand, which is the one place navigation state must be
 * unambiguous.
 */
export interface SidebarRoles {
  itemActive: Hsl
  itemActiveForeground: Hsl
}

export function deriveSidebarRoles(roles: BrandRoles, mode: 'light' | 'dark'): SidebarRoles {
  return {
    itemActive: roles.subtle,
    itemActiveForeground: ensureContrast(
      roles.subtleForeground,
      roles.subtle,
      AA_TEXT,
      { direction: mode === 'light' ? 'darker' : 'lighter' },
    ),
  }
}
