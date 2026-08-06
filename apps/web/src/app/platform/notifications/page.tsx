'use client'

import { useQuery } from '@tanstack/react-query'
import { AlertTriangle } from 'lucide-react'

import { humanCategory } from '@/components/notifications/notification-bell'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  getPlatformNotificationAnalytics,
  getPlatformProviderStatuses,
  getPlatformQueueStatus,
} from '@/lib/api/notifications'

/**
 * Platform Owner notification analytics (Checkpoint 18.6).
 *
 * Cross-tenant delivery volume, success/failure rates, per-organization
 * usage, queue depth and provider configuration. Provider configuration is
 * deployment-wide rather than per-tenant, which the page states rather than
 * implying otherwise.
 */
export default function PlatformNotificationsPage() {
  const analyticsQuery = useQuery({
    queryKey: ['platform', 'notifications', 'analytics'],
    queryFn: () => getPlatformNotificationAnalytics(),
  })
  const queueQuery = useQuery({
    queryKey: ['platform', 'notifications', 'queue'],
    queryFn: getPlatformQueueStatus,
  })
  const providersQuery = useQuery({
    queryKey: ['platform', 'notifications', 'providers'],
    queryFn: getPlatformProviderStatuses,
  })

  const analytics = analyticsQuery.data
  const totals = analytics?.totals
  const queue = queueQuery.data

  return (
    <div className="space-y-4 p-6">
      <div>
        <h1 className="text-xl font-semibold">Notification analytics</h1>
        <p className="text-sm text-muted-foreground">
          Delivery volume and health across every tenant on this deployment.
        </p>
      </div>

      {queue && !queue.workerEnabled && (
        <Card className="flex items-start gap-2 border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
          <p className="text-amber-900 dark:text-amber-200">{queue.workerDisabledReason}</p>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <Stat label="Notifications" value={totals ? String(totals.total) : '-'} />
        <Stat label="Read" value={totals ? String(totals.read) : '-'} />
        <Stat
          label="Success rate"
          value={totals?.successRate ? `${totals.successRate}%` : 'Not measured'}
          muted={!totals?.successRate}
        />
        <Stat
          label="Failure rate"
          value={totals?.failureRate ? `${totals.failureRate}%` : 'Not measured'}
          muted={!totals?.failureRate}
        />
        <Stat label="Queued" value={queue ? String(queue.pending + queue.queued) : '-'} />
        <Stat label="Failed" value={queue ? String(queue.failed) : '-'} />
      </div>

      <Card className="p-4">
        <h2 className="mb-3 text-sm font-semibold">Usage by organization</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Organization</TableHead>
              <TableHead className="text-right">Notifications</TableHead>
              <TableHead className="text-right">Sent</TableHead>
              <TableHead className="text-right">Failed</TableHead>
              <TableHead className="text-right">Success rate</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(analytics?.byOrganization ?? []).map((row) => (
              <TableRow key={row.organizationId}>
                <TableCell className="font-medium">{row.organizationName}</TableCell>
                <TableCell className="text-right">{row.total}</TableCell>
                <TableCell className="text-right">{row.sent}</TableCell>
                <TableCell className="text-right">{row.failed}</TableCell>
                <TableCell className="text-right">
                  {row.successRate ? (
                    `${row.successRate}%`
                  ) : (
                    <span className="text-muted-foreground">Not measured</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {(analytics?.byOrganization.length ?? 0) === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                  No notification activity in this period.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold">Queue</h2>
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <Row label="Pending" value={queue?.pending} />
            <Row label="Queued" value={queue?.queued} />
            <Row label="Due now" value={queue?.due} />
            <Row label="Retrying" value={queue?.retrying} />
            <Row label="Failed" value={queue?.failed} />
            <Row label="Scheduled" value={queue?.scheduled} />
          </dl>
          {queue?.oldestPendingAt && (
            <p className="mt-3 text-xs text-muted-foreground">
              Oldest waiting delivery: {new Date(queue.oldestPendingAt).toLocaleString()}
            </p>
          )}
        </Card>

        <Card className="p-4">
          <h2 className="mb-1 text-sm font-semibold">Providers</h2>
          <p className="mb-3 text-xs text-muted-foreground">
            Channel adapters are selected by deployment environment configuration, so these apply to every
            tenant. Per-organization provider configuration does not exist yet.
          </p>
          <div className="space-y-2">
            {providersQuery.data?.map((provider) => (
              <div key={provider.channel} className="rounded-md border p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">
                    {humanCategory(provider.channel)}{' '}
                    <span className="text-xs text-muted-foreground">({provider.providerName})</span>
                  </p>
                  <Badge variant={provider.configured ? 'default' : 'outline'}>
                    {provider.configured ? 'Configured' : 'Not configured'}
                  </Badge>
                </div>
                {provider.reason && <p className="mt-1 text-xs text-muted-foreground">{provider.reason}</p>}
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}

function Stat({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <Card className="p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-lg font-semibold ${muted ? 'text-muted-foreground' : ''}`}>{value}</p>
    </Card>
  )
}

function Row({ label, value }: { label: string; value?: number }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value ?? '-'}</dd>
    </>
  )
}
