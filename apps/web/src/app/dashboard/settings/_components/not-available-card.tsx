import type { LucideIcon } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'

export interface NotAvailableCardProps {
  icon: LucideIcon
  title: string
  description: string
  /** Matches `organization/_components/security-section.tsx`'s honest-disclosure pattern. */
  badgeLabel?: string
}

/**
 * States a real gap plainly instead of rendering a control that would do
 * nothing. Reused across every section of this workspace that has no backing
 * API yet - see `CLAUDE.md`'s prohibition on faking logic to "make it work."
 */
export function NotAvailableCard({ icon: Icon, title, description, badgeLabel = 'Not available yet' }: NotAvailableCardProps) {
  return (
    <Card variant="inset" className="p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-md bg-surface text-subtle-foreground ring-1 ring-inset ring-border/60">
            <Icon className="size-3.5" aria-hidden="true" />
          </span>
          <p className="text-sm font-medium text-foreground">{title}</p>
        </div>
        <Badge variant="neutral" size="sm">
          {badgeLabel}
        </Badge>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{description}</p>
    </Card>
  )
}
