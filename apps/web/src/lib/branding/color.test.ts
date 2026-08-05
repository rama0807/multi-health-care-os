import {
  AA_LARGE,
  AA_TEXT,
  contrastRatio,
  deriveBrandRoles,
  ensureContrast,
  hexToHsl,
  hslToTokenString,
  parseHex,
  readableForeground,
} from './color'

const WHITE = { h: 0, s: 0, l: 100 }
const DARK_SURFACE = { h: 220, s: 20, l: 11 }

describe('parseHex', () => {
  it('accepts 3- and 6-digit hex, with or without a hash', () => {
    expect(parseHex('#fff')).toEqual({ r: 255, g: 255, b: 255 })
    expect(parseHex('0F62FE')).toEqual({ r: 15, g: 98, b: 254 })
    expect(parseHex('  #0f62fe  ')).toEqual({ r: 15, g: 98, b: 254 })
  })

  it('returns null rather than throwing on junk', () => {
    expect(parseHex('rebeccapurple')).toBeNull()
    expect(parseHex('#12345')).toBeNull()
    expect(parseHex('')).toBeNull()
    expect(parseHex(undefined as unknown as string)).toBeNull()
  })
})

describe('hexToHsl', () => {
  it('round-trips a known colour', () => {
    const hsl = hexToHsl('#0F62FE')!
    expect(Math.round(hsl.h)).toBe(219)
    expect(Math.round(hsl.s)).toBe(99)
    expect(Math.round(hsl.l)).toBe(53)
  })

  it('reports greys as zero-saturation', () => {
    expect(hexToHsl('#808080')!.s).toBe(0)
  })
})

describe('contrastRatio', () => {
  it('matches the WCAG reference extremes', () => {
    expect(contrastRatio({ h: 0, s: 0, l: 0 }, WHITE)).toBeCloseTo(21, 1)
    expect(contrastRatio(WHITE, WHITE)).toBeCloseTo(1, 5)
  })

  it('is order-independent', () => {
    const a = { h: 220, s: 90, l: 40 }
    expect(contrastRatio(a, WHITE)).toBe(contrastRatio(WHITE, a))
  })
})

describe('ensureContrast', () => {
  it('leaves a colour alone when it already passes', () => {
    const dark = { h: 220, s: 50, l: 20 }
    expect(ensureContrast(dark, WHITE, AA_TEXT)).toEqual(dark)
  })

  it('darkens against a light surface until AA is met', () => {
    const tooLight = { h: 50, s: 100, l: 60 }
    const fixed = ensureContrast(tooLight, WHITE, AA_TEXT)
    expect(contrastRatio(fixed, WHITE)).toBeGreaterThanOrEqual(AA_TEXT)
    expect(fixed.l).toBeLessThan(tooLight.l)
  })

  it('lightens against a dark surface until AA is met', () => {
    const tooDark = { h: 220, s: 80, l: 15 }
    const fixed = ensureContrast(tooDark, DARK_SURFACE, AA_TEXT)
    expect(contrastRatio(fixed, DARK_SURFACE)).toBeGreaterThanOrEqual(AA_TEXT)
    expect(fixed.l).toBeGreaterThan(tooDark.l)
  })

  it('returns the best available colour instead of throwing on an impossible target', () => {
    const mid = { h: 0, s: 0, l: 50 }
    const result = ensureContrast(mid, { h: 0, s: 0, l: 50 }, 21)
    expect(result).toBeDefined()
    expect(contrastRatio(result, mid)).toBeGreaterThan(1)
  })
})

describe('readableForeground', () => {
  it('picks light text on a dark fill and dark text on a light fill', () => {
    expect(readableForeground({ h: 220, s: 90, l: 20 }).l).toBeGreaterThan(50)
    expect(readableForeground({ h: 55, s: 95, l: 85 }).l).toBeLessThan(50)
  })
})

describe('deriveBrandRoles', () => {
  // These are the colours a real tenant is most likely to break the UI with.
  const cases: Array<[string, string]> = [
    ['a normal brand blue', '#0F62FE'],
    ['a light yellow', '#FFEB3B'],
    ['near-white', '#FFFFFF'],
    ['near-black', '#050505'],
    ['pure grey', '#808080'],
    ['a saturated red', '#DC2626'],
    ['a deep purple', '#4C1D95'],
  ]

  describe.each(cases)('%s (%s)', (_label, hex) => {
    const color = hexToHsl(hex)!

    it('produces button text that clears AA on the fill, in both modes', () => {
      for (const mode of ['light', 'dark'] as const) {
        const roles = deriveBrandRoles(color, mode)
        expect(contrastRatio(roles.foreground, roles.base)).toBeGreaterThanOrEqual(AA_TEXT)
      }
    })

    it('produces pill text that clears AA on its own tint, in both modes', () => {
      for (const mode of ['light', 'dark'] as const) {
        const roles = deriveBrandRoles(color, mode)
        expect(contrastRatio(roles.subtleForeground, roles.subtle)).toBeGreaterThanOrEqual(
          AA_TEXT,
        )
      }
    })

    it('keeps the solid fill visible as a component against the dark surface', () => {
      const roles = deriveBrandRoles(color, 'dark')
      expect(contrastRatio(roles.base, DARK_SURFACE)).toBeGreaterThanOrEqual(AA_LARGE)
    })

    it('moves hover away from the surface, not toward it', () => {
      expect(deriveBrandRoles(color, 'light').hover.l).toBeLessThan(
        deriveBrandRoles(color, 'light').base.l,
      )
      expect(deriveBrandRoles(color, 'dark').hover.l).toBeGreaterThan(
        deriveBrandRoles(color, 'dark').base.l,
      )
    })
  })

  it('preserves a usable configured colour exactly', () => {
    const color = hexToHsl('#0F62FE')!
    const roles = deriveBrandRoles(color, 'light')
    expect(roles.base.h).toBeCloseTo(color.h, 1)
    expect(roles.base.l).toBeCloseTo(color.l, 1)
  })

  it('lifts an unusable near-white colour into a visible band', () => {
    const roles = deriveBrandRoles(hexToHsl('#FFFFFF')!, 'light')
    expect(roles.base.l).toBeLessThanOrEqual(68)
  })
})

describe('hslToTokenString', () => {
  it('emits bare HSL channels for the CSS token layer', () => {
    expect(hslToTokenString({ h: 221, s: 83, l: 53 })).toBe('221 83% 53%')
  })

  it('normalises out-of-range hues', () => {
    expect(hslToTokenString({ h: -40, s: 50, l: 50 })).toBe('320 50% 50%')
  })
})
