'use client'

import { useQuery } from '@tanstack/react-query'
import { Bar, BarChart, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis } from 'recharts'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { SectionHeader } from '@/components/ui/page-header'
import { Progress } from '@/components/ui/progress'
import { StatCard, StatCardGrid } from '@/components/ui/stat-card'
import { StatusBadge } from '@/components/ui/status-badge'
import { Table, TableBody, TableCell, TableContainer, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { getOrganizationUsage, getSubscription } from '@/lib/api/organization'

import { formatBytes, formatDate, humanizeEnum, percentOf } from './format'

export function SubscriptionSection() {
  const subscriptionQuery = useQuery({
    queryKey: ['organization', 'subscription'],
    queryFn: getSubscription,
  })
  const usageQuery = useQuery({ queryKey: ['organization', 'usage'], queryFn: getOrganizationUsage })

  const subscription = subscriptionQuery.data
  const usage = usageQuery.data

  if (subscriptionQuery.isLoading || usageQuery.isLoading) {
    return <p className="pt-4 text-sm text-muted-foreground">Loading subscription…</p>
  }

  if (!subscription) {
    return <EmptyState compact title="No subscription information" />
  }

  const storageQuotaBytes = usage?.storage.quotaMb ? usage.storage.quotaMb * 1024 * 1024 : null

  const limits = [
    {
      label: 'Storage',
      used: usage ? formatBytes(usage.storage.totalBytes) : '—',
      limit: storageQuotaBytes ? formatBytes(storageQuotaBytes) : null,
      percent: usage ? percentOf(usage.storage.totalBytes, storageQuotaBytes) : null,
    },
    {
      label: 'Users',
      used: usage ? String(usage.users.total) : '—',
      limit: usage?.users.limit ? String(usage.users.limit) : null,
      percent: usage ? percentOf(usage.users.total, usage.users.limit) : null,
    },
    {
      label: 'Hospitals',
      used: usage ? String(usage.hospitals.total) : '—',
      limit: usage?.hospitals.limit ? String(usage.hospitals.limit) : null,
      percent: usage ? percentOf(usage.hospitals.total, usage.hospitals.limit) : null,
    },
    {
      label: 'Patients',
      used: usage ? String(usage.patients.total) : '—',
      limit: usage?.patients.limit ? String(usage.patients.limit) : null,
      percent: usage ? percentOf(usage.patients.total, usage.patients.limit) : null,
    },
  ]

  return (
    <div className="space-y-4">
      <SectionHeader title="Subscription" description="Plan, renewal and usage against every metered limit." />

      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Current plan</p>
              <p className="text-2xl font-semibold text-foreground">{humanizeEnum(subscription.plan)}</p>
            </div>
            <StatusBadge status={subscription.status} />
          </div>

          <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Field label="Started" value={formatDate(subscription.startsAt)} />
            <Field
              label="Renews / ends"
              value={subscription.endsAt ? formatDate(subscription.endsAt) : 'No end date'}
            />
            <Field
              label="Monthly price"
              value={
                subscription.monthlyPrice
                  ? `${subscription.currency} ${subscription.monthlyPrice}`
                  : 'Not set'
              }
            />
            <Field label="Currency" value={subscription.currency} />
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Usage against plan limits</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {limits.map((limit) => (
              <div key={limit.label}>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{limit.label}</span>
                  <span className="font-medium text-foreground">
                    {limit.used}
                    {limit.limit ? ` of ${limit.limit}` : ''}
                  </span>
                </div>
                {limit.percent === null ? (
                  <p className="mt-1.5 text-xs text-muted-foreground">Unlimited</p>
                ) : (
                  <Progress value={limit.percent} tone={limit.percent >= 90 ? 'danger' : 'default'} className="mt-1.5" />
                )}
              </div>
            ))}
            <div className="opacity-60">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Invoices</span>
                <span className="font-medium text-foreground">Not metered</span>
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">Not part of usage tracking yet</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Storage breakdown</CardTitle>
          </CardHeader>
          {!usage || usage.storage.byCategory.length === 0 ? (
            <EmptyState compact title="No stored files yet" />
          ) : (
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
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>AI usage</CardTitle>
          </CardHeader>
          <CardContent>
            {usage && (
              <StatCardGrid columns={3}>
                <StatCard label="Requests" value={usage.ai.totalRequests} />
                <StatCard label="Tokens" value={usage.ai.totalTokens.toLocaleString()} />
                <StatCard label="Estimated cost" value={`$${usage.ai.estimatedCost.toFixed(2)}`} />
              </StatCardGrid>
            )}
            <p className="mt-3 text-xs text-muted-foreground">
              Real metered figures from the AI usage log. These read zero until an AI provider
              credential is configured; a $0.00 cost means no per-token price is set, not that usage
              was free.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>API requests</CardTitle>
          {usage && (
            <p className="text-xs text-muted-foreground">
              {usage.api.totalRequests.toLocaleString()} in the last {usage.api.windowDays} days
            </p>
          )}
        </CardHeader>
        <CardContent>
          {!usage || usage.api.daily.length === 0 ? (
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
            Measured from live traffic on a rolling {usage?.api.windowDays ?? '—'}-day window. Counters
            are held in Redis and are not a durable billing ledger.
          </p>
        </CardContent>
      </Card>

      {subscription.notes && (
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-sm text-muted-foreground">{subscription.notes}</CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        Plan changes are made by the platform operator, not from this dashboard. No payment gateway
        is connected - a plan records the commercial agreement and does not charge anyone.
      </p>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium text-foreground">{value}</dd>
    </div>
  )
}
