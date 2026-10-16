'use client'

import { AppWindow, Fingerprint, KeyRound, Lock, ShieldCheck, Timer } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { SectionHeader } from '@/components/ui/page-header'

interface SecurityCard {
  key: string
  icon: React.ElementType
  title: string
  description: string
  status: 'enabled' | 'unavailable'
}

const SECURITY_CARDS: SecurityCard[] = [
  {
    key: 'authentication',
    icon: Fingerprint,
    title: 'Authentication',
    description:
      'Email and password sign-in over JWT access/refresh tokens, with per-account lockout after repeated failed attempts.',
    status: 'enabled',
  },
  {
    key: 'password-policy',
    icon: Lock,
    title: 'Password policy',
    description: 'A per-organization minimum length, complexity and rotation policy is not yet configurable.',
    status: 'unavailable',
  },
  {
    key: 'sessions',
    icon: Timer,
    title: 'Sessions',
    description: 'Viewing or revoking a user’s active sessions from this dashboard is not yet available.',
    status: 'unavailable',
  },
  {
    key: '2fa',
    icon: ShieldCheck,
    title: 'Two-factor authentication',
    description: 'No second factor (TOTP, SMS or email code) is enforced at sign-in yet.',
    status: 'unavailable',
  },
  {
    key: 'api-keys',
    icon: KeyRound,
    title: 'API keys',
    description: 'Every request authenticates as a signed-in user - there is no organization-level API key to issue or revoke.',
    status: 'unavailable',
  },
  {
    key: 'connected-apps',
    icon: AppWindow,
    title: 'Connected apps',
    description: 'No third-party OAuth application can currently be authorized against this organization.',
    status: 'unavailable',
  },
]

/**
 * Every card states what is genuinely true today, not a toggle that would
 * silently do nothing. `enabled` cards describe real, already-enforced
 * behaviour (see `apps/api/src/modules/auth/`); `unavailable` cards disclose
 * a real gap rather than a working control - see `CLAUDE.md`'s prohibition
 * on faking auth logic to "make it work."
 */
export function SecuritySection() {
  return (
    <div className="space-y-4">
      <SectionHeader title="Security" description="Authentication and access controls for this organization." />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {SECURITY_CARDS.map((card) => (
          <Card key={card.key} variant={card.status === 'enabled' ? 'default' : 'inset'} className="p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="flex size-7 items-center justify-center rounded-md bg-surface text-subtle-foreground ring-1 ring-inset ring-border/60">
                  <card.icon className="size-3.5" aria-hidden="true" />
                </span>
                <p className="text-sm font-medium text-foreground">{card.title}</p>
              </div>
              <Badge variant={card.status === 'enabled' ? 'success' : 'neutral'} size="sm">
                {card.status === 'enabled' ? 'Enabled' : 'Not available'}
              </Badge>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{card.description}</p>
          </Card>
        ))}
      </div>
    </div>
  )
}
