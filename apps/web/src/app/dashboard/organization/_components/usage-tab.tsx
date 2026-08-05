'use client'

import { useQuery } from '@tanstack/react-query'

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { getOrganizationUsage } from '@/lib/api/organization'

import { formatAgainstLimit, formatBytes, percentOf } from './format'

export function UsageTab() {
  const query = useQuery({ queryKey: ['organization', 'usage'], queryFn: getOrganizationUsage })
  const usage = query.data

  if (query.isLoading) {
    return <p className="pt-4 text-sm text-muted-foreground">Loading usage…</p>
  }
  if (!usage) {
    return <p className="pt-4 text-sm text-muted-foreground">No usage data available.</p>
  }

  const storageQuotaBytes = usage.storage.quotaMb ? usage.storage.quotaMb * 1024 * 1024 : null
  const storagePercent = percentOf(usage.storage.totalBytes, storageQuotaBytes)
  const peakApiDay = Math.max(1, ...usage.api.daily.map((d) => d.requests))

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

      <div className="rounded-lg border bg-card p-4">
        <div className="mb-3 flex items-baseline justify-between">
          <h3 className="text-sm font-semibold text-foreground">API requests</h3>
          <p className="text-xs text-muted-foreground">
            {usage.api.totalRequests.toLocaleString()} in the last {usage.api.windowDays} days
          </p>
        </div>
        <div className="flex h-24 items-end gap-0.5">
          {usage.api.daily.map((day) => (
            <div
              key={day.date}
              className="flex-1 rounded-sm bg-primary/70"
              style={{ height: `${Math.max(2, (day.requests / peakApiDay) * 100)}%` }}
              title={`${day.date}: ${day.requests} requests`}
            />
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Measured from live traffic on a rolling {usage.api.windowDays}-day window. Counters are
          held in Redis and are not a durable billing ledger.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-lg border bg-card">
          <div className="border-b px-4 py-3">
            <h3 className="text-sm font-semibold text-foreground">Storage breakdown</h3>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Files</TableHead>
                <TableHead className="text-right">Size</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usage.storage.byCategory.map((row) => (
                <TableRow key={row.category}>
                  <TableCell>{row.category}</TableCell>
                  <TableCell className="text-right">{row.files}</TableCell>
                  <TableCell className="text-right">{formatBytes(row.bytes)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="rounded-lg border bg-card p-4">
          <h3 className="mb-3 text-sm font-semibold text-foreground">AI usage</h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-lg font-semibold text-foreground">{usage.ai.totalRequests}</p>
              <p className="text-xs text-muted-foreground">Requests</p>
            </div>
            <div>
              <p className="text-lg font-semibold text-foreground">
                {usage.ai.totalTokens.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">Tokens</p>
            </div>
            <div>
              <p className="text-lg font-semibold text-foreground">
                ${usage.ai.estimatedCost.toFixed(2)}
              </p>
              <p className="text-xs text-muted-foreground">Estimated cost</p>
            </div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Real metered figures from the AI usage log. These read zero until an AI provider
            credential is configured; a $0.00 cost means no per-token price is set, not that usage
            was free.
          </p>
        </div>
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
    <div className="rounded-lg border bg-card p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold text-foreground">{headline}</p>
      <p className="text-xs text-muted-foreground">{detail}</p>
      {percent !== null && (
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={percent >= 90 ? 'h-full bg-destructive' : 'h-full bg-primary'}
            style={{ width: `${percent}%` }}
          />
        </div>
      )}
    </div>
  )
}
