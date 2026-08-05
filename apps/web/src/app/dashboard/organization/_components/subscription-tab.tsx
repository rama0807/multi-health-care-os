'use client'

import { useQuery } from '@tanstack/react-query'

import { Badge } from '@/components/ui/badge'
import { getSubscription } from '@/lib/api/organization'

import { formatDate } from './format'

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive'> = {
  ACTIVE: 'default',
  TRIALING: 'secondary',
  PAST_DUE: 'destructive',
  CANCELLED: 'destructive',
  EXPIRED: 'destructive',
}

export function SubscriptionTab() {
  const query = useQuery({ queryKey: ['organization', 'subscription'], queryFn: getSubscription })
  const subscription = query.data

  if (query.isLoading) {
    return <p className="pt-4 text-sm text-muted-foreground">Loading subscription…</p>
  }

  if (!subscription) {
    return <p className="pt-4 text-sm text-muted-foreground">No subscription information.</p>
  }

  const limits = [
    { label: 'Hospitals', value: subscription.maxHospitals, suffix: '' },
    { label: 'Users', value: subscription.maxUsers, suffix: '' },
    { label: 'Patients', value: subscription.maxPatients, suffix: '' },
    { label: 'Storage', value: subscription.storageQuotaMb, suffix: ' MB' },
  ]

  return (
    <div className="space-y-4 pt-4">
      <div className="rounded-lg border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Current plan</p>
            <p className="text-2xl font-semibold text-foreground">{subscription.plan}</p>
          </div>
          <Badge variant={STATUS_VARIANT[subscription.status] ?? 'secondary'}>
            {subscription.status.replace(/_/g, ' ').toLowerCase()}
          </Badge>
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
      </div>

      <div className="rounded-lg border bg-card p-4">
        <h3 className="mb-3 text-sm font-semibold text-foreground">Plan limits</h3>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {limits.map((limit) => (
            <div key={limit.label}>
              <p className="text-lg font-semibold text-foreground">
                {limit.value === null ? 'Unlimited' : `${limit.value}${limit.suffix}`}
              </p>
              <p className="text-xs text-muted-foreground">{limit.label}</p>
            </div>
          ))}
        </div>
      </div>

      {subscription.notes && (
        <div className="rounded-lg border bg-card p-4">
          <h3 className="mb-1 text-sm font-semibold text-foreground">Notes</h3>
          <p className="text-sm text-muted-foreground">{subscription.notes}</p>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Plan changes are made by the platform operator, not from this dashboard. No payment gateway
        is connected — a plan records the commercial agreement and does not charge anyone.
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
