'use client'

import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, CalendarClock, CheckCircle2, ClipboardList, FileClock, Scan, Settings, XCircle } from 'lucide-react'
import Link from 'next/link'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { getRadiologyDashboardStats, listRadiologyOrders } from '@/lib/api/radiology'
import { useAuth } from '@/lib/auth/auth-context'

function getErrorMessage(error: unknown): string {
  const axiosError = error as { response?: { data?: { error?: { message?: string } } } }
  return axiosError?.response?.data?.error?.message ?? 'Something went wrong. Please try again.'
}

function formatEnumLabel(value: string): string {
  return value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, ' ')
}

const STATUS_BADGE: Record<string, 'secondary' | 'success' | 'destructive' | 'outline'> = {
  ORDERED: 'secondary',
  SCHEDULED: 'outline',
  IN_PROGRESS: 'outline',
  COMPLETED: 'success',
  REPORTED: 'success',
  CANCELLED: 'destructive',
  REJECTED: 'destructive',
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
    <div className="space-y-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Radiology</h1>
          <p className="text-sm text-muted-foreground">Imaging orders, scheduling, and reporting.</p>
        </div>
        <div className="flex flex-wrap gap-2">
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
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-5">
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

      <div className="rounded-lg border bg-card">
        <div className="border-b p-3">
          <h3 className="text-sm font-semibold text-foreground">Recent urgent / STAT studies</h3>
        </div>
        {urgentQuery.isLoading ? (
          <p className="p-4 text-sm text-muted-foreground">Loading...</p>
        ) : urgentQuery.isError ? (
          <p className="p-4 text-sm text-muted-foreground">Couldn&apos;t load studies. {getErrorMessage(urgentQuery.error)}</p>
        ) : urgentQuery.data?.data.length ? (
          <ul className="divide-y">
            {urgentQuery.data.data.map((order) => (
              <li key={order.id} className="p-3">
                <Link
                  href={`/dashboard/radiology/${order.id}`}
                  className="flex flex-wrap items-center gap-2 text-sm hover:underline"
                >
                  <Scan className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-mono text-xs text-muted-foreground">{order.orderNumber}</span>
                  <Badge variant={STATUS_BADGE[order.status]}>{formatEnumLabel(order.status)}</Badge>
                  <span>{order.patient.fullName}</span>
                  <span className="text-xs text-muted-foreground">
                    {order.modality} — {order.bodyPart}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="p-4 text-sm text-muted-foreground">No urgent or STAT studies right now.</p>
        )}
      </div>
    </div>
  )
}
