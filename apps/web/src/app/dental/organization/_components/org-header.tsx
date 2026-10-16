'use client'

import type { Organization, OrganizationStats, SubscriptionSummary } from '@medicore/types'
import {
  Building2,
  ChevronDown,
  Clock,
  CreditCard,
  HardDrive,
  Hash,
  History,
  Palette,
  Plus,
  Users,
} from 'lucide-react'
import * as React from 'react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { PageHeaderMeta } from '@/components/ui/page-header'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/ui/status-badge'

import { formatBytes, formatRelativeTime, humanizeEnum } from './format'

interface OrgHeaderStatProps {
  icon: React.ElementType
  label: string
  value: React.ReactNode
}

function OrgHeaderStat({ icon: Icon, label, value }: OrgHeaderStatProps) {
  return (
    <div className="flex items-center gap-2 py-2">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-surface text-subtle-foreground ring-1 ring-inset ring-border/60">
        <Icon className="size-3.5" aria-hidden="true" />
      </span>
      <div className="min-w-0 leading-tight">
        <p className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <div className="truncate text-sm font-medium text-foreground">{value}</div>
      </div>
    </div>
  )
}

export interface OrgHeaderProps {
  org?: Organization
  loading: boolean
  stats?: OrganizationStats
  subscription?: SubscriptionSummary
  lastActivityAt?: string | null
  onNavigate: (section: string) => void
}

/**
 * The Organization workspace header - identity, live standing (status,
 * subscription, members, storage, recent activity) and quick actions, all
 * before any navigation. Everything below the org's name is a real,
 * already-fetched number; nothing here is decorative.
 */
export function OrgHeader({ org, loading, stats, subscription, lastActivityAt, onNavigate }: OrgHeaderProps) {
  if (loading || !org) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Skeleton className="size-11 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-64" />
            <Skeleton className="h-3.5 w-40" />
          </div>
        </div>
        <Skeleton className="h-16 w-full rounded-lg" />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-primary-subtle text-primary-subtle-foreground ring-1 ring-inset ring-border/60">
            {org.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={org.logo} alt="" className="h-full w-full object-contain" />
            ) : (
              <Building2 className="size-5" aria-hidden="true" />
            )}
          </span>
          <div className="min-w-0 space-y-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-xl font-semibold tracking-tight text-foreground">
                {org.name}
              </h1>
              <StatusBadge status={org.status} />
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <PageHeaderMeta icon={Hash}>{org.slug}</PageHeaderMeta>
              <PageHeaderMeta icon={Building2}>{humanizeEnum(org.type)}</PageHeaderMeta>
            </div>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              Quick actions
              <ChevronDown className="size-3.5" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onClick={() => onNavigate('workspace')}>
              <Plus className="size-4" aria-hidden="true" />
              Onboard a hospital
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onNavigate('brand')}>
              <Palette className="size-4" aria-hidden="true" />
              Update branding
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onNavigate('audit')}>
              <History className="size-4" aria-hidden="true" />
              View audit log
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex flex-wrap items-stretch gap-x-5 gap-y-1 rounded-lg border border-border bg-surface-secondary/60 px-4">
        <OrgHeaderStat
          icon={CreditCard}
          label="Subscription"
          value={
            subscription ? (
              <span className="inline-flex items-center gap-1.5">
                {humanizeEnum(subscription.plan)}
                <StatusBadge status={subscription.status} size="sm" />
              </span>
            ) : (
              '—'
            )
          }
        />
        <Separator orientation="vertical" className="hidden h-auto self-center sm:block" />
        <OrgHeaderStat
          icon={Users}
          label="Members"
          value={stats ? stats.users.total.toLocaleString() : '—'}
        />
        <Separator orientation="vertical" className="hidden h-auto self-center sm:block" />
        <OrgHeaderStat
          icon={HardDrive}
          label="Storage used"
          value={stats ? formatBytes(stats.storageBytes) : '—'}
        />
        <Separator orientation="vertical" className="hidden h-auto self-center sm:block" />
        <OrgHeaderStat
          icon={Clock}
          label="Last activity"
          value={formatRelativeTime(lastActivityAt)}
        />
      </div>
    </div>
  )
}
