'use client'

import { useQuery } from '@tanstack/react-query'
import { Bar, BarChart, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis } from 'recharts'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Progress } from '@/components/ui/progress'
import { StatCard, StatCardGrid } from '@/components/ui/stat-card'
import { Table, TableBody, TableCell, TableContainer, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { getOrganizationUsage } from '@/lib/api/organization'

import { formatAgainstLimit, formatBytes, percentOf } from './format'

export function UsageTab() {
  const query = useQuery({ queryKey: ['organization', 'usage'], queryFn: getOrganizationUsage })
  const usage = query.data

  if (query.isLoading) {
    return <p className="pt-4 text-sm text-muted-foreground">Loading usage…</p>
  }
  if (!usage) {
    return <EmptyState compact title="No usage data available" />
  }

  const storageQuotaBytes = usage.storage.quotaMb ? usage.storage.quotaMb * 1024 * 1024 : null
  const storagePercent = percentOf(usage.storage.totalBytes, storageQuotaBytes)

  return (
    <div className="space-y-4 pt-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <UsageCard
          label="Storage"
          headline={formatBytes(usage.storage.totalBytes)}
          detail={
            usage.storage.quotaMb === null
              ? 'No quota set'
              : `of ${formatBytes(storageQuotaBytes ?? 0)}`
          }
          percent={storagePercent}
        />
        <UsageCard
          label="Users"
          headline={formatAgainstLimit(usage.users.total, usage.users.limit)}
          detail={`${usage.users.activeLast30Days} active in last 30 days`}
          percent={percentOf(usage.users.total, usage.users.limit)}
        />
        <UsageCard
          label="Hospitals"
          headline={formatAgainstLimit(usage.hospitals.total, usage.hospitals.limit)}
          detail="Across the organization"
          percent={percentOf(usage.hospitals.total, usage.hospitals.limit)}
        />
        <UsageCard
          label="Patients"
          headline={formatAgainstLimit(usage.patients.total, usage.patients.limit)}
          detail="Active records"
          percent={percentOf(usage.patients.total, usage.patients.limit)}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>API requests</CardTitle>
          <p className="text-xs text-muted-foreground">
            {usage.api.totalRequests.toLocaleString()} in the last {usage.api.windowDays} days
          </p>
        </CardHeader>
        <CardContent>
          {usage.api.daily.length === 0 ? (
            <EmptyState compact title="No API activity in this window" />
          ) : (
            <div className="h-32">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={usage.api.daily}>
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} width={32} />
                  <RechartsTooltip formatter={(value: number) => [value, 'Requests']} />
                  <Bar dataKey="requests" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            Measured from live traffic on a rolling {usage.api.windowDays}-day window. Counters are
            held in Redis and are not a durable billing ledger.
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Storage breakdown</CardTitle>
          </CardHeader>
          <TableContainer className="rounded-none border-0 border-y">
            <Table density="compact" container={false}>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead align="right">Files</TableHead>
                  <TableHead align="right">Size</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usage.storage.byCategory.map((row) => (
                  <TableRow key={row.category}>
                    <TableCell>{row.category}</TableCell>
                    <TableCell align="right">{row.files}</TableCell>
                    <TableCell align="right">{formatBytes(row.bytes)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>AI usage</CardTitle>
          </CardHeader>
          <CardContent>
            <StatCardGrid columns={3}>
              <StatCard label="Requests" value={usage.ai.totalRequests} />
              <StatCard label="Tokens" value={usage.ai.totalTokens.toLocaleString()} />
              <StatCard label="Estimated cost" value={`$${usage.ai.estimatedCost.toFixed(2)}`} />
            </StatCardGrid>
            <p className="mt-3 text-xs text-muted-foreground">
              Real metered figures from the AI usage log. These read zero until an AI provider
              credential is configured; a $0.00 cost means no per-token price is set, not that usage
              was free.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function UsageCard({
  label,
  headline,
  detail,
  percent,
}: {
  label: string
  headline: string
  detail: string
  percent: number | null
}) {
  return (
    <Card className="p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-foreground">{headline}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
      {percent !== null && <Progress value={percent} tone={percent >= 90 ? 'danger' : 'default'} className="mt-2" />}
    </Card>
  )
}
