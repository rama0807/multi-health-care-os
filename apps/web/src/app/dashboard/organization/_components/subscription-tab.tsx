'use client'

import { useQuery } from '@tanstack/react-query'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { StatCard, StatCardGrid } from '@/components/ui/stat-card'
import { StatusBadge } from '@/components/ui/status-badge'
import { getSubscription } from '@/lib/api/organization'

import { formatDate } from './format'

export function SubscriptionTab() {
  const query = useQuery({ queryKey: ['organization', 'subscription'], queryFn: getSubscription })
  const subscription = query.data

  if (query.isLoading) {
    return <p className="pt-4 text-sm text-muted-foreground">Loading subscription…</p>
  }

  if (!subscription) {
    return <EmptyState compact title="No subscription information" />
  }

  const limits = [
    { label: 'Hospitals', value: subscription.maxHospitals, suffix: '' },
    { label: 'Users', value: subscription.maxUsers, suffix: '' },
    { label: 'Patients', value: subscription.maxPatients, suffix: '' },
    { label: 'Storage', value: subscription.storageQuotaMb, suffix: ' MB' },
  ]

  return (
    <div className="space-y-4 pt-4">
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Current plan</p>
              <p className="text-2xl font-semibold text-foreground">{subscription.plan}</p>
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
          <CardTitle>Plan limits</CardTitle>
        </CardHeader>
        <CardContent>
          <StatCardGrid columns={4}>
            {limits.map((limit) => (
              <StatCard key={limit.label} label={limit.label} value={limit.value === null ? 'Unlimited' : `${limit.value}${limit.suffix}`} />
            ))}
          </StatCardGrid>
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
