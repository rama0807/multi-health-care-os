'use client'

import { useQuery } from '@tanstack/react-query'
import { AlertCircle, IndianRupee, ReceiptText, RefreshCcw, ShieldCheck, Wallet } from 'lucide-react'
import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { getBillingDashboardStats } from '@/lib/api/billing'

export default function BillingDashboardPage() {
  const statsQuery = useQuery({ queryKey: ['billing', 'dashboard-stats'], queryFn: getBillingDashboardStats })
  const stats = statsQuery.data

  const tiles = [
    { key: 'todaysRevenue', label: "Today's revenue", icon: IndianRupee, value: stats ? `₹${stats.todaysRevenue}` : undefined },
    { key: 'pendingInvoices', label: 'Pending invoices', icon: ReceiptText, value: stats?.pendingInvoices },
    { key: 'outstandingBalance', label: 'Outstanding balance', icon: Wallet, value: stats ? `₹${stats.outstandingBalance}` : undefined },
    { key: 'refundsToday', label: 'Refunds today', icon: RefreshCcw, value: stats ? `₹${stats.refundsToday}` : undefined },
  ] as const

  const approvals = [
    { key: 'pendingDiscountApprovals', label: 'Pending discount approvals', value: stats?.pendingDiscountApprovals },
    { key: 'pendingRefundApprovals', label: 'Pending refund approvals', value: stats?.pendingRefundApprovals },
  ] as const

  const maxTrend = Math.max(1, ...(stats?.collectionTrend.map((d) => Number(d.amount)) ?? [1]))

  return (
    <div className="space-y-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Billing</h1>
          <p className="text-sm text-muted-foreground">Invoices, payments, and refunds.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/dashboard/billing/invoices">Invoices</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/dashboard/billing/payments">Payments</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/dashboard/billing/refunds">Refunds</Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((tile) => (
          <div key={tile.key} className="flex items-center gap-3 rounded-lg border bg-card p-4 shadow-sm">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
              <tile.icon className="h-4 w-4" />
            </div>
            <div>
              <p className="text-lg font-semibold text-foreground">{statsQuery.isLoading ? '—' : (tile.value ?? 0)}</p>
              <p className="text-xs text-muted-foreground">{tile.label}</p>
            </div>
          </div>
        ))}
      </div>

      {stats && (stats.pendingDiscountApprovals > 0 || stats.pendingRefundApprovals > 0) && (
        <div className="flex flex-wrap gap-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {approvals
            .filter((a) => (a.value ?? 0) > 0)
            .map((a) => (
              <span key={a.key}>
                {a.value} {a.label.toLowerCase()}
              </span>
            ))}
          <Link href="/dashboard/billing/invoices" className="ml-auto flex items-center gap-1 font-medium underline">
            <ShieldCheck className="h-4 w-4" />
            Review
          </Link>
        </div>
      )}

      <div className="rounded-lg border bg-card p-4">
        <h3 className="mb-3 text-sm font-semibold text-foreground">Collection trend (last 7 days)</h3>
        {statsQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : (
          <div className="flex h-32 gap-2">
            {stats?.collectionTrend.map((day) => (
              <div key={day.date} className="flex h-32 flex-1 flex-col items-center justify-end gap-1">
                <div
                  className="w-full rounded-t bg-primary/80"
                  style={{ height: `${Math.max(4, (Number(day.amount) / maxTrend) * 100)}%` }}
                  title={`₹${day.amount}`}
                />
                <span className="text-[10px] text-muted-foreground">
                  {new Date(day.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
