import { KeyRound, Terminal, Webhook } from 'lucide-react'

import { SectionHeader } from '@/components/ui/page-header'

import { NotAvailableCard } from './not-available-card'

/**
 * No personal API token, webhook, or CLI token model exists anywhere in this
 * codebase - not schema-only like MFA, genuinely absent. Framed as an
 * edition gate (matching how the rest of the product would plausibly ship
 * this) rather than "not available yet", per this task's explicit copy.
 */
export function DeveloperSection() {
  return (
    <div className="space-y-4">
      <SectionHeader title="Developer" description="Programmatic access to your account." />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <NotAvailableCard
          icon={KeyRound}
          title="Personal API token"
          description="Issue a token scoped to your own account for scripts or integrations."
          badgeLabel="Enterprise edition"
        />
        <NotAvailableCard
          icon={Webhook}
          title="Webhook status"
          description="Personal webhook subscriptions for events on your own account."
          badgeLabel="Enterprise edition"
        />
        <NotAvailableCard
          icon={Terminal}
          title="CLI token"
          description="A long-lived token for authenticating a MediCore CLI."
          badgeLabel="Enterprise edition"
        />
      </div>
    </div>
  )
}
