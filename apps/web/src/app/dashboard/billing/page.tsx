'use client'

import { useQuery } from '@tanstack/react-query'
import { AlertCircle, IndianRupee, ReceiptText, RefreshCcw, ShieldCheck, Wallet } from 'lucide-react'
import Link from 'next/link'
import { Bar, BarChart, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis } from 'recharts'

import { PageLayout } from '@/components/layout/page-layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { StatCard, StatCardGrid } from '@/components/ui/stat-card'
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

  const trend = (stats?.collectionTrend ?? []).map((d) => ({
    date: new Date(d.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
    amount: Number(d.amount),
  }))

  return (
    <PageLayout
      title="Billing"
      description="Invoices, payments, and refunds."
      actions={
        <>
          <Button asChild variant="outline">
            <Link href="/dashboard/billing/invoices">Invoices</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/dashboard/billing/payments">Payments</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/dashboard/billing/refunds">Refunds</Link>
          </Button>
        </>
      }
    >
      <StatCardGrid columns={4}>
        {tiles.map((tile) => (
          <StatCard key={tile.key} icon={tile.icon} label={tile.label} value={tile.value} loading={statsQuery.isLoading} />
        ))}
      </StatCardGrid>

      {stats && (stats.pendingDiscountApprovals > 0 || stats.pendingRefundApprovals > 0) && (
        <div className="flex flex-wrap items-center gap-4 rounded-lg border border-warning-border bg-warning-subtle p-3 text-sm text-warning-subtle-foreground">
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

      <Card>
        <CardHeader>
          <CardTitle>Collection trend (last 7 days)</CardTitle>
        </CardHeader>
        <CardContent>
          {statsQuery.isLoading ? (
            <div className="h-40 animate-pulse rounded-md bg-surface-secondary" />
          ) : trend.length === 0 ? (
            <EmptyState compact title="No collections in the last 7 days" />
          ) : (
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trend}>
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} width={40} />
                  <RechartsTooltip formatter={(value: number) => [`₹${value}`, 'Collected']} />
                  <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </PageLayout>
  )
}
