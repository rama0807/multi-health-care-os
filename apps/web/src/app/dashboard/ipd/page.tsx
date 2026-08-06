'use client'

import { useQuery } from '@tanstack/react-query'
import { Activity, ArrowLeftRight, BedDouble, Building2, ClipboardList, HeartPulse, LogOut, Users } from 'lucide-react'
import Link from 'next/link'

import { PageLayout } from '@/components/layout/page-layout'
import { Button } from '@/components/ui/button'
import { StatCard, StatCardGrid } from '@/components/ui/stat-card'
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
    <PageLayout
      title="IPD & Bed Management"
      description="Wards, rooms, beds, and admissions."
      actions={
        <>
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
        </>
      }
    >
      <StatCardGrid columns={4}>
        {tiles.map((tile) => (
          <StatCard key={tile.key} icon={tile.icon} label={tile.label} value={tile.value} loading={statsQuery.isLoading} />
        ))}
      </StatCardGrid>
    </PageLayout>
  )
}
