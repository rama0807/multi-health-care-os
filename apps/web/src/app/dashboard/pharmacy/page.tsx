'use client'

import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Boxes, CalendarClock, ClipboardList, PackageCheck, PackageSearch, Pill } from 'lucide-react'
import Link from 'next/link'

import { PageLayout } from '@/components/layout/page-layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { SkeletonText } from '@/components/ui/skeleton'
import { StatCard, StatCardGrid } from '@/components/ui/stat-card'
import { StatusBadge } from '@/components/ui/status-badge'
import { getPharmacyDashboardStats, listDispenseOrders } from '@/lib/api/pharmacy'
import { useAuth } from '@/lib/auth/auth-context'

function getErrorMessage(error: unknown): string {
  const axiosError = error as { response?: { data?: { error?: { message?: string } } } }
  return axiosError?.response?.data?.error?.message ?? 'Something went wrong. Please try again.'
}

export default function PharmacyDashboardPage() {
  const { hasPermission } = useAuth()
  const canManageCatalog = hasPermission('pharmacy.create')

  const statsQuery = useQuery({ queryKey: ['pharmacy', 'dashboard-stats'], queryFn: getPharmacyDashboardStats })
  const pendingQuery = useQuery({
    queryKey: ['pharmacy', 'dispense', 'list', 'pending-preview'],
    queryFn: () => listDispenseOrders({ status: 'PENDING' as never, limit: 5, sortBy: 'createdAt', sortOrder: 'desc' }),
  })

  const tiles = [
    { key: 'pending', label: 'Pending prescriptions', icon: ClipboardList, value: statsQuery.data?.pending },
    { key: 'ready', label: 'Ready', icon: PackageCheck, value: statsQuery.data?.ready },
    { key: 'dispensedToday', label: 'Dispensed today', icon: Boxes, value: statsQuery.data?.dispensedToday },
    { key: 'lowStock', label: 'Low stock', icon: AlertTriangle, value: statsQuery.data?.lowStock },
    { key: 'expiringSoon', label: 'Expiring medicines', icon: CalendarClock, value: statsQuery.data?.expiringSoon },
  ] as const

  return (
    <PageLayout
      title="Pharmacy"
      description="Drug catalog, dispensing, and stock management."
      actions={
        <>
          <Button asChild variant="outline">
            <Link href="/dashboard/pharmacy/dispense">
              <Pill className="h-4 w-4" />
              Dispense queue
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/dashboard/pharmacy/stock">
              <PackageSearch className="h-4 w-4" />
              Stock
            </Link>
          </Button>
          {canManageCatalog && (
            <Button asChild variant="outline">
              <Link href="/dashboard/pharmacy/catalog">Catalog</Link>
            </Button>
          )}
        </>
      }
    >
      <StatCardGrid columns={5}>
        {tiles.map((tile) => (
          <StatCard key={tile.key} icon={tile.icon} label={tile.label} value={tile.value} loading={statsQuery.isLoading} />
        ))}
      </StatCardGrid>

      <Card>
        <CardHeader>
          <CardTitle>Pending prescriptions</CardTitle>
        </CardHeader>
        <CardContent>
          {pendingQuery.isLoading ? (
            <SkeletonText lines={4} />
          ) : pendingQuery.isError ? (
            <EmptyState compact variant="error" title="Couldn't load dispense orders" description={getErrorMessage(pendingQuery.error)} />
          ) : pendingQuery.data?.data.length ? (
            <ul className="divide-y">
              {pendingQuery.data.data.map((order) => (
                <li key={order.id} className="py-2 first:pt-0 last:pb-0">
                  <Link
                    href={`/dashboard/pharmacy/${order.id}`}
                    className="flex flex-wrap items-center gap-2 text-sm hover:underline"
                  >
                    <Pill className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="font-mono text-xs text-muted-foreground">{order.dispenseNumber}</span>
                    <StatusBadge status={order.status} />
                    <span>{order.patient.fullName}</span>
                    <span className="text-xs text-muted-foreground">{order.prescription.prescriptionNumber}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState compact title="No pending prescriptions right now" />
          )}
        </CardContent>
      </Card>
    </PageLayout>
  )
}
