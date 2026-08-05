'use client'

import type { OrganizationBranding } from '@medicore/types'
import { useQuery } from '@tanstack/react-query'
import { createContext, useContext, useEffect, useMemo } from 'react'

import { getOrganizationBranding } from '@/lib/api/organization'
import { useAuth } from '@/lib/auth/auth-context'
import { applyBrandingStylesheet, buildBrandingStylesheet } from '@/lib/branding/theme'

/**
 * Applies the signed-in organization's branding to the live design system.
 *
 * Everything visual flows from this: the token stylesheet it injects is what
 * makes buttons, links, the sidebar's active item, focus rings, badges,
 * progress bars and chart series follow a tenant's colours (see
 * `lib/branding/theme.ts` for exactly which tokens move, and `color.ts` for
 * the accessibility derivation that keeps a badly chosen colour readable).
 *
 * ── A disclosed limitation ────────────────────────────────────────────────
 * `GET /organizations/me/branding` is gated behind `organizations.read`, which
 * in the seeded role catalogue only Hospital Admin holds. This phase was
 * explicitly scoped to the UI foundation with no API changes, so the endpoint
 * was left exactly as it is. The consequence is real and is **not** papered
 * over: a doctor or nurse gets the default MediCore palette unless a
 * successful fetch has previously been cached on that device.
 *
 * The cache below narrows the gap (branding survives reloads, and the login
 * screen can show the last organization used on this device) but does not
 * close it. Closing it needs one of: branding included in the login/refresh
 * payload, or an ungated read endpoint. Tracked as TD-0074.
 */

interface BrandingContextValue {
  branding: OrganizationBranding | null
  /** Organization logo URL, or `null` when none has been uploaded. */
  logo: string | null
  /** Branding display name, falling back to the organization's real name. */
  displayName: string
  loginTagline: string | null
  isLoading: boolean
}

const BrandingContext = createContext<BrandingContextValue | undefined>(undefined)

const CACHE_PREFIX = 'medicore.branding.'
const LAST_ORG_KEY = 'medicore.branding.lastOrganizationId'

interface CachedBranding {
  branding: OrganizationBranding
  logo: string | null
  displayName: string | null
}

function readCache(organizationId: string | null): CachedBranding | null {
  if (typeof window === 'undefined' || !organizationId) return null
  try {
    const raw = window.localStorage.getItem(CACHE_PREFIX + organizationId)
    return raw ? (JSON.parse(raw) as CachedBranding) : null
  } catch {
    // A corrupt or unavailable localStorage (private mode, quota, a manual
    // edit) must never break rendering — the default palette is a fine answer.
    return null
  }
}

function writeCache(organizationId: string, value: CachedBranding): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(CACHE_PREFIX + organizationId, JSON.stringify(value))
    window.localStorage.setItem(LAST_ORG_KEY, organizationId)
  } catch {
    // Non-fatal: branding simply will not survive this reload.
  }
}

/** The last organization branded on this device — used before sign-in. */
export function readLastKnownOrganizationId(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(LAST_ORG_KEY)
  } catch {
    return null
  }
}

export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, hasPermission } = useAuth()

  const organizationId = user?.organizationId ?? null

  // Only ask for what this user is allowed to have. Firing the request for
  // every role would produce a guaranteed 403 on nearly every page load, which
  // pollutes the audit trail and the browser console for no benefit.
  const canReadBranding = isAuthenticated && hasPermission('organizations.read')

  const query = useQuery({
    queryKey: ['organization', 'branding', organizationId],
    queryFn: getOrganizationBranding,
    enabled: canReadBranding && Boolean(organizationId),
    staleTime: 5 * 60 * 1000,
  })

  // Fall back through: live fetch → this device's cache for this organization
  // → nothing (default palette).
  const cached = useMemo(
    () => readCache(organizationId ?? readLastKnownOrganizationId()),
    [organizationId],
  )

  const resolved = useMemo<CachedBranding | null>(() => {
    if (query.data) {
      const { logo, ...branding } = query.data
      return { branding, logo: logo ?? null, displayName: branding.displayName ?? null }
    }
    return cached
  }, [query.data, cached])

  useEffect(() => {
    if (query.data && organizationId) {
      const { logo, ...branding } = query.data
      writeCache(organizationId, {
        branding,
        logo: logo ?? null,
        displayName: branding.displayName ?? null,
      })
    }
  }, [query.data, organizationId])

  const css = useMemo(
    () => buildBrandingStylesheet(resolved?.branding ?? null),
    [resolved?.branding],
  )

  useEffect(() => {
    applyBrandingStylesheet(css)
  }, [css])

  const value = useMemo<BrandingContextValue>(
    () => ({
      branding: resolved?.branding ?? null,
      logo: resolved?.logo ?? null,
      displayName:
        resolved?.branding?.displayName?.trim() || user?.organizationName || 'MediCore',
      loginTagline: resolved?.branding?.loginTagline?.trim() || null,
      isLoading: query.isLoading,
    }),
    [resolved, user?.organizationName, query.isLoading],
  )

  return <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>
}

/**
 * Branding for chrome that needs the *name* or *logo* rather than the colours.
 * Colours never come through here — they are already applied as CSS tokens, so
 * a component styles itself with `bg-primary`, not with a value read from
 * this hook.
 */
export function useBranding(): BrandingContextValue {
  const context = useContext(BrandingContext)
  if (!context) throw new Error('useBranding must be used within a BrandingProvider')
  return context
}
