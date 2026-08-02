'use client'

import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Boxes, CalendarClock, ClipboardList, PackageCheck, PackageSearch, Pill } from 'lucide-react'
import Link from 'next/link'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { getPharmacyDashboardStats, listDispenseOrders } from '@/lib/api/pharmacy'
import { useAuth } from '@/lib/auth/auth-context'

function getErrorMessage(error: unknown): string {
  const axiosError = error as { response?: { data?: { error?: { message?: string } } } }
  return axiosError?.response?.data?.error?.message ?? 'Something went wrong. Please try again.'
}

function formatEnumLabel(value: string): string {
  return value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, ' ')
}

const STATUS_BADGE: Record<string, 'secondary' | 'success' | 'destructive' | 'outline'> = {
  PENDING: 'secondary',
  PREPARING: 'outline',
  READY: 'outline',
  DISPENSED: 'success',
  CANCELLED: 'destructive',
  RETURNED: 'destructive',
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
    <div className="space-y-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Pharmacy</h1>
          <p className="text-sm text-muted-foreground">Drug catalog, dispensing, and stock management.</p>
        </div>
        <div className="flex flex-wrap gap-2">
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
          <h3 className="text-sm font-semibold text-foreground">Pending prescriptions</h3>
        </div>
        {pendingQuery.isLoading ? (
          <p className="p-4 text-sm text-muted-foreground">Loading...</p>
        ) : pendingQuery.isError ? (
          <p className="p-4 text-sm text-muted-foreground">Couldn&apos;t load dispense orders. {getErrorMessage(pendingQuery.error)}</p>
        ) : pendingQuery.data?.data.length ? (
          <ul className="divide-y">
            {pendingQuery.data.data.map((order) => (
              <li key={order.id} className="p-3">
                <Link
                  href={`/dashboard/pharmacy/${order.id}`}
                  className="flex flex-wrap items-center gap-2 text-sm hover:underline"
                >
                  <Pill className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-mono text-xs text-muted-foreground">{order.dispenseNumber}</span>
                  <Badge variant={STATUS_BADGE[order.status]}>{formatEnumLabel(order.status)}</Badge>
                  <span>{order.patient.fullName}</span>
                  <span className="text-xs text-muted-foreground">{order.prescription.prescriptionNumber}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="p-4 text-sm text-muted-foreground">No pending prescriptions right now.</p>
        )}
      </div>
    </div>
  )
}
