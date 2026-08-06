'use client'

import { useQuery } from '@tanstack/react-query'
import { AlertCircle, CheckCircle2, ClipboardList, IndianRupee, Wallet, XCircle } from 'lucide-react'
import Link from 'next/link'

import { PageLayout } from '@/components/layout/page-layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { SkeletonText } from '@/components/ui/skeleton'
import { StatCard, StatCardGrid } from '@/components/ui/stat-card'
import { getInsuranceDashboardStats } from '@/lib/api/insurance'

export default function InsuranceDashboardPage() {
  const statsQuery = useQuery({ queryKey: ['insurance', 'dashboard-stats'], queryFn: getInsuranceDashboardStats })
  const stats = statsQuery.data

  const tiles = [
    { key: 'todaysClaims', label: "Today's claims", icon: ClipboardList, value: stats?.todaysClaims, tone: 'default' as const },
    { key: 'pendingApproval', label: 'Pending approval', icon: AlertCircle, value: stats?.pendingApproval, tone: 'warning' as const },
    { key: 'rejectedClaims', label: 'Rejected claims', icon: XCircle, value: stats?.rejectedClaims, tone: 'danger' as const },
    { key: 'settledClaims', label: 'Settled claims', icon: CheckCircle2, value: stats?.settledClaims, tone: 'success' as const },
    { key: 'insuranceRevenue', label: 'Insurance revenue', icon: IndianRupee, value: stats ? `₹${stats.insuranceRevenue}` : undefined, tone: 'default' as const },
    { key: 'outstandingClaims', label: 'Outstanding claims', icon: Wallet, value: stats ? `₹${stats.outstandingClaims}` : undefined, tone: 'default' as const },
  ] as const

  const breakdown = [
    { key: 'pendingApproval', label: 'Pending approval', value: stats?.pendingApproval ?? 0, tone: 'warning' as const },
    { key: 'rejectedClaims', label: 'Rejected', value: stats?.rejectedClaims ?? 0, tone: 'danger' as const },
    { key: 'settledClaims', label: 'Settled', value: stats?.settledClaims ?? 0, tone: 'success' as const },
  ] as const
  const maxBreakdown = Math.max(1, ...breakdown.map((b) => b.value))

  return (
    <PageLayout
      title="Insurance"
      description="Providers, plans, pre-authorizations, and claims."
      actions={
        <>
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
        </>
      }
    >
      <StatCardGrid columns={3}>
        {tiles.map((tile) => (
          <StatCard
            key={tile.key}
            icon={tile.icon}
            label={tile.label}
            value={tile.value}
            loading={statsQuery.isLoading}
            tone={tile.tone}
          />
        ))}
      </StatCardGrid>

      <Card>
        <CardHeader>
          <CardTitle>Claim status breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          {statsQuery.isLoading ? (
            <SkeletonText lines={3} />
          ) : (
            <div className="space-y-3">
              {breakdown.map((b) => (
                <div key={b.key} className="flex items-center gap-3">
                  <span className="w-32 flex-shrink-0 text-sm text-muted-foreground">{b.label}</span>
                  <Progress value={b.value} max={maxBreakdown} tone={b.tone} className="flex-1" label={b.label} />
                  <span className="w-10 flex-shrink-0 text-right text-sm font-medium tabular-nums text-foreground">{b.value}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </PageLayout>
  )
}
