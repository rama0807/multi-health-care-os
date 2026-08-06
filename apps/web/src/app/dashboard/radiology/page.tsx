'use client'

import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, CalendarClock, CheckCircle2, ClipboardList, FileClock, Scan, Settings, XCircle } from 'lucide-react'
import Link from 'next/link'

import { PageLayout } from '@/components/layout/page-layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { SkeletonText } from '@/components/ui/skeleton'
import { StatCard, StatCardGrid } from '@/components/ui/stat-card'
import { StatusBadge } from '@/components/ui/status-badge'
import { getRadiologyDashboardStats, listRadiologyOrders } from '@/lib/api/radiology'
import { useAuth } from '@/lib/auth/auth-context'

function getErrorMessage(error: unknown): string {
  const axiosError = error as { response?: { data?: { error?: { message?: string } } } }
  return axiosError?.response?.data?.error?.message ?? 'Something went wrong. Please try again.'
}

export default function RadiologyDashboardPage() {
  const { hasPermission } = useAuth()
  const canManageCatalog = hasPermission('radiology.create')

  const statsQuery = useQuery({ queryKey: ['radiology', 'dashboard-stats'], queryFn: getRadiologyDashboardStats })
  const urgentQuery = useQuery({
    queryKey: ['radiology', 'list', 'urgent-preview'],
    queryFn: () => listRadiologyOrders({ priority: 'STAT' as never, limit: 5, sortBy: 'createdAt', sortOrder: 'desc' }),
  })

  const tiles = [
    { key: 'todaysStudies', label: "Today's studies", icon: CalendarClock, value: statsQuery.data?.todaysStudies },
    { key: 'pendingReporting', label: 'Pending reporting', icon: FileClock, value: statsQuery.data?.pendingReporting },
    { key: 'completedStudies', label: 'Completed studies', icon: CheckCircle2, value: statsQuery.data?.completedStudies },
    { key: 'cancelled', label: 'Cancelled', icon: XCircle, value: statsQuery.data?.cancelled },
    { key: 'urgent', label: 'Urgent / STAT', icon: AlertTriangle, value: statsQuery.data?.urgent },
  ] as const

  return (
    <PageLayout
      title="Radiology"
      description="Imaging orders, scheduling, and reporting."
      actions={
        <>
          <Button asChild variant="outline">
            <Link href="/dashboard/radiology/orders">
              <ClipboardList className="h-4 w-4" />
              Orders queue
            </Link>
          </Button>
          {canManageCatalog && (
            <Button asChild variant="outline">
              <Link href="/dashboard/radiology/catalog">
                <Settings className="h-4 w-4" />
                Catalog
              </Link>
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
          <CardTitle>Recent urgent / STAT studies</CardTitle>
        </CardHeader>
        <CardContent>
          {urgentQuery.isLoading ? (
            <SkeletonText lines={4} />
          ) : urgentQuery.isError ? (
            <EmptyState compact variant="error" title="Couldn't load studies" description={getErrorMessage(urgentQuery.error)} />
          ) : urgentQuery.data?.data.length ? (
            <ul className="divide-y">
              {urgentQuery.data.data.map((order) => (
                <li key={order.id} className="py-2 first:pt-0 last:pb-0">
                  <Link
                    href={`/dashboard/radiology/${order.id}`}
                    className="flex flex-wrap items-center gap-2 text-sm hover:underline"
                  >
                    <Scan className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="font-mono text-xs text-muted-foreground">{order.orderNumber}</span>
                    <StatusBadge status={order.status} />
                    <span>{order.patient.fullName}</span>
                    <span className="text-xs text-muted-foreground">
                      {order.modality} — {order.bodyPart}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState compact title="No urgent or STAT studies right now" />
          )}
        </CardContent>
      </Card>
    </PageLayout>
  )
}
