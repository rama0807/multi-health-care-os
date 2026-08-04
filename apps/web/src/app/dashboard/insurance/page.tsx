'use client'

import { useQuery } from '@tanstack/react-query'
import { AlertCircle, CheckCircle2, ClipboardList, IndianRupee, Wallet, XCircle } from 'lucide-react'
import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { getInsuranceDashboardStats } from '@/lib/api/insurance'

export default function InsuranceDashboardPage() {
  const statsQuery = useQuery({ queryKey: ['insurance', 'dashboard-stats'], queryFn: getInsuranceDashboardStats })
  const stats = statsQuery.data

  const tiles = [
    { key: 'todaysClaims', label: "Today's claims", icon: ClipboardList, value: stats?.todaysClaims },
    { key: 'pendingApproval', label: 'Pending approval', icon: AlertCircle, value: stats?.pendingApproval },
    { key: 'rejectedClaims', label: 'Rejected claims', icon: XCircle, value: stats?.rejectedClaims },
    { key: 'settledClaims', label: 'Settled claims', icon: CheckCircle2, value: stats?.settledClaims },
    { key: 'insuranceRevenue', label: 'Insurance revenue', icon: IndianRupee, value: stats ? `₹${stats.insuranceRevenue}` : undefined },
    { key: 'outstandingClaims', label: 'Outstanding claims', icon: Wallet, value: stats ? `₹${stats.outstandingClaims}` : undefined },
  ] as const

  const breakdown = [
    { key: 'pendingApproval', label: 'Pending approval', value: stats?.pendingApproval ?? 0, colorClass: 'bg-warning' },
    { key: 'rejectedClaims', label: 'Rejected', value: stats?.rejectedClaims ?? 0, colorClass: 'bg-destructive' },
    { key: 'settledClaims', label: 'Settled', value: stats?.settledClaims ?? 0, colorClass: 'bg-success' },
  ] as const
  const maxBreakdown = Math.max(1, ...breakdown.map((b) => b.value))

  return (
    <div className="space-y-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Insurance</h1>
          <p className="text-sm text-muted-foreground">Providers, plans, pre-authorizations, and claims.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/dashboard/insurance/providers">Providers</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/dashboard/insurance/plans">Plans</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/dashboard/insurance/preauth">Pre-Authorizations</Link>
          </Button>
          <Button asChild>
            <Link href="/dashboard/insurance/claims">Claims</Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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

      <div className="rounded-lg border bg-card p-4">
        <h3 className="mb-3 text-sm font-semibold text-foreground">Claim status breakdown</h3>
        {statsQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : (
          <div className="space-y-3">
            {breakdown.map((b) => (
              <div key={b.key} className="flex items-center gap-3">
                <span className="w-32 flex-shrink-0 text-sm text-muted-foreground">{b.label}</span>
                <div className="h-2.5 flex-1 rounded-full bg-muted">
                  <div
                    className={`h-2.5 rounded-full ${b.colorClass}`}
                    style={{ width: `${Math.max(2, (b.value / maxBreakdown) * 100)}%` }}
                  />
                </div>
                <span className="w-10 flex-shrink-0 text-right text-sm font-medium text-foreground">{b.value}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
