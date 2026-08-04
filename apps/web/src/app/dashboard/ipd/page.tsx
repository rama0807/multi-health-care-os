'use client'

import { useQuery } from '@tanstack/react-query'
import { Activity, ArrowLeftRight, BedDouble, Building2, ClipboardList, HeartPulse, LogOut, Users } from 'lucide-react'
import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { getIpdDashboardStats } from '@/lib/api/ipd'

export default function IpdDashboardPage() {
  const statsQuery = useQuery({ queryKey: ['ipd', 'dashboard-stats'], queryFn: getIpdDashboardStats })
  const stats = statsQuery.data

  const tiles = [
    { key: 'inpatients', label: 'Inpatients', icon: Users, value: stats?.inpatients },
    {
      key: 'occupancy',
      label: 'Bed occupancy',
      icon: BedDouble,
      value: stats ? `${stats.occupiedBeds}/${stats.totalBeds} (${stats.occupancyPercent}%)` : undefined,
    },
    {
      key: 'icuOccupancy',
      label: 'ICU occupancy',
      icon: HeartPulse,
      value: stats ? `${stats.icuOccupiedBeds}/${stats.icuTotalBeds} (${stats.icuOccupancyPercent}%)` : undefined,
    },
    { key: 'admissionsToday', label: 'Admissions today', icon: Activity, value: stats?.admissionsToday },
    { key: 'dischargesToday', label: "Today's discharges", icon: LogOut, value: stats?.dischargesToday },
    { key: 'transfersToday', label: 'Transfers today', icon: ArrowLeftRight, value: stats?.transfersToday },
    { key: 'pendingDischarge', label: 'Pending discharge', icon: ClipboardList, value: stats?.pendingDischarge },
    { key: 'pendingNursingTasks', label: 'Pending nursing tasks', icon: ClipboardList, value: stats?.pendingNursingTasks },
  ] as const

  return (
    <div className="space-y-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-semibold text-foreground">IPD & Bed Management</h1>
          <p className="text-sm text-muted-foreground">Wards, rooms, beds, and admissions.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/dashboard/ipd/wards">
              <Building2 className="h-3.5 w-3.5" />
              Wards
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/dashboard/ipd/rooms">Rooms</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/dashboard/ipd/beds">
              <BedDouble className="h-3.5 w-3.5" />
              Bed grid
            </Link>
          </Button>
          <Button asChild>
            <Link href="/dashboard/ipd/admissions">Admissions</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/dashboard/ipd/discharges">Discharges</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/dashboard/nursing">Nursing</Link>
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
    </div>
  )
}
