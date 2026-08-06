'use client'

import type { AuthenticatedUser } from '@medicore/types'
import { FileText, Hammer, Scale, ScrollText } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SectionHeader } from '@/components/ui/page-header'

import { humanizeRole, parseUserAgent } from './format'
import { NotAvailableCard } from './not-available-card'

export interface AboutSectionProps {
  user?: AuthenticatedUser
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs font-medium uppercase tracking-wide text-subtle-foreground">{label}</p>
      <p className="text-sm text-foreground">{value}</p>
    </div>
  )
}

/**
 * Every fact here is either a real build-time constant (`NEXT_PUBLIC_APP_VERSION`,
 * set from `package.json` in `next.config.mjs`), a real runtime value
 * (`NODE_ENV`, the signed-in user's own org/role, the browser's own user
 * agent), or an honest "not available" - never a guessed support URL. This
 * app has no Privacy Policy, Terms or Open Source licenses page to link to
 * yet, so none are fabricated here.
 */
export function AboutSection({ user }: AboutSectionProps) {
  const [browser, setBrowser] = useState<string | null>(null)

  useEffect(() => {
    setBrowser(`${parseUserAgent(navigator.userAgent).browser} on ${parseUserAgent(navigator.userAgent).os}`)
  }, [])

  return (
    <div className="space-y-4">
      <SectionHeader title="About" description="Build, environment and account context." />

      <Card>
        <CardHeader>
          <CardTitle>MediCore</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Fact label="Version" value={process.env.NEXT_PUBLIC_APP_VERSION ?? 'Unknown'} />
          <Fact label="Environment" value={process.env.NODE_ENV} />
          <Fact label="Browser" value={browser ?? '—'} />
          <Fact label="Current organization" value={user?.organizationName ?? '—'} />
          <Fact label="Role" value={user ? user.roles.map(humanizeRole).join(', ') : '—'} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <NotAvailableCard icon={Hammer} title="Build" description="No build identifier (commit hash, build number) is exposed to the app yet." />
        <NotAvailableCard icon={Scale} title="License" description="Subscription and licensing details live in Organization → Subscription for admins - there's no per-user license view." />
        <NotAvailableCard icon={FileText} title="Privacy Policy & Terms" description="No Privacy Policy or Terms of Service page exists in this app yet." />
        <NotAvailableCard icon={ScrollText} title="Open source licenses" description="A third-party license attribution page isn't generated yet." />
      </div>
    </div>
  )
}
