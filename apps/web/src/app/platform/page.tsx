'use client'

import { useQuery } from '@tanstack/react-query'
import { Building2, HardDrive, Sparkles, TrendingUp, Users } from 'lucide-react'

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { getPlatformAnalytics, getPlatformStats } from '@/lib/api/platform'

import { formatBytes } from '../dashboard/organization/_components/format'

export default function PlatformOverviewPage() {
  const statsQuery = useQuery({ queryKey: ['platform', 'stats'], queryFn: getPlatformStats })
  const analyticsQuery = useQuery({
    queryKey: ['platform', 'analytics'],
    queryFn: getPlatformAnalytics,
  })

  const stats = statsQuery.data
  const analytics = analyticsQuery.data
  const peakApiDay = Math.max(1, ...(stats?.api.daily.map((d) => d.requests) ?? [1]))
  const peakGrowth = Math.max(1, ...(analytics?.organizationGrowth.map((m) => m.created) ?? [1]))

  const tiles = [
    { key: 'orgs', label: 'Organizations', icon: Building2, value: stats?.organizations.total },
    { key: 'hospitals', label: 'Hospitals', icon: Building2, value: stats?.hospitals.total },
    { key: 'users', label: 'Users', icon: Users, value: stats?.users.total },
    {
      key: 'storage',
      label: 'Storage',
      icon: HardDrive,
      value: stats ? formatBytes(stats.storageBytes) : undefined,
    },
    {
      key: 'signups',
      label: 'New tenants (30d)',
      icon: TrendingUp,
      value: stats?.signupsLast30Days,
    },
    { key: 'ai', label: 'AI requests', icon: Sparkles, value: stats?.ai.totalRequests },
  ] as const

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Platform overview</h1>
        <p className="text-sm text-muted-foreground">
          Live figures across every tenant on this deployment.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
        {tiles.map((tile) => (
          <div
            key={tile.key}
            className="flex items-center gap-3 rounded-lg border bg-card p-4 shadow-sm"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
              <tile.icon className="h-4 w-4" />
            </div>
            <div>
              <p className="text-lg font-semibold text-foreground">
                {statsQuery.isLoading ? '—' : (tile.value ?? 0)}
              </p>
              <p className="text-xs text-muted-foreground">{tile.label}</p>
            </div>
          </div>
        ))}
      </div>

      {stats && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-lg border bg-card p-4">
            <h3 className="mb-3 text-sm font-semibold text-foreground">Tenant status</h3>
            <div className="grid grid-cols-4 gap-3">
              <MiniStat label="Active" value={stats.organizations.active} />
              <MiniStat label="Trial" value={stats.organizations.trial} />
              <MiniStat label="Suspended" value={stats.organizations.suspended} />
              <MiniStat label="Cancelled" value={stats.organizations.cancelled} />
            </div>
            <h3 className="mb-2 mt-4 text-sm font-semibold text-foreground">Plans</h3>
            <div className="flex flex-wrap gap-6">
              {stats.subscriptionsByPlan.map((row) => (
                <MiniStat key={row.plan} label={row.plan} value={row.count} />
              ))}
            </div>
          </div>

          <div className="rounded-lg border bg-card p-4">
            <div className="mb-3 flex items-baseline justify-between">
              <h3 className="text-sm font-semibold text-foreground">API requests (all tenants)</h3>
              <p className="text-xs text-muted-foreground">
                {stats.api.totalRequests.toLocaleString()} in {stats.api.windowDays} days
              </p>
            </div>
            <div className="flex h-24 items-end gap-0.5">
              {stats.api.daily.map((day) => (
                <div
                  key={day.date}
                  className="flex-1 rounded-sm bg-primary/70"
                  style={{ height: `${Math.max(2, (day.requests / peakApiDay) * 100)}%` }}
                  title={`${day.date}: ${day.requests} requests`}
                />
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Rolling window held in Redis — real measured traffic, not a durable billing ledger.
            </p>
          </div>
        </div>
      )}

      {analytics && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-lg border bg-card p-4">
            <h3 className="mb-3 text-sm font-semibold text-foreground">Tenant growth</h3>
            {analytics.organizationGrowth.length === 0 ? (
              <p className="text-sm text-muted-foreground">No organizations yet.</p>
            ) : (
              <div className="space-y-1">
                {analytics.organizationGrowth.slice(-12).map((month) => (
                  <div key={month.month} className="flex items-center gap-2 text-xs">
                    <span className="w-16 text-muted-foreground">{month.month}</span>
                    <div className="h-3 flex-1 overflow-hidden rounded-sm bg-muted">
                      <div
                        className="h-full bg-primary"
                        style={{ width: `${(month.created / peakGrowth) * 100}%` }}
                      />
                    </div>
                    <span className="w-20 text-right text-muted-foreground">
                      +{month.created} ({month.cumulative})
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-lg border bg-card">
            <div className="border-b px-4 py-3">
              <h3 className="text-sm font-semibold text-foreground">Largest tenants by users</h3>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Organization</TableHead>
                  <TableHead className="text-right">Users</TableHead>
                  <TableHead className="text-right">Storage</TableHead>
                  <TableHead className="text-right">API (30d)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {analytics.topOrganizationsByUsers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                      No tenants yet.
                    </TableCell>
                  </TableRow>
                )}
                {analytics.topOrganizationsByUsers.map((row) => (
                  <TableRow key={row.organizationId}>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell className="text-right">{row.users}</TableCell>
                    <TableCell className="text-right">
                      {formatBytes(
                        analytics.topOrganizationsByStorage.find(
                          (s) => s.organizationId === row.organizationId,
                        )?.bytes ?? 0,
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {analytics.topOrganizationsByApiRequests
                        .find((a) => a.organizationId === row.organizationId)
                        ?.requests.toLocaleString() ?? 0}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {stats && (
        <div className="rounded-lg border bg-card p-4">
          <h3 className="mb-2 text-sm font-semibold text-foreground">AI usage (all tenants)</h3>
          <div className="grid grid-cols-3 gap-4">
            <MiniStat label="Requests" value={stats.ai.totalRequests} />
            <MiniStat label="Tokens" value={stats.ai.totalTokens} />
            <MiniStat label="Est. cost (USD)" value={stats.ai.estimatedCost.toFixed(2)} />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Real metered data from the AI usage log. Reads zero until an AI provider credential is
            configured; $0.00 means no per-token price is set, not that usage was free.
          </p>
        </div>
      )}
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <p className="text-lg font-semibold text-foreground">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  )
}
