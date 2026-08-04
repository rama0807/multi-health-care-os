'use client'

import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, BedDouble, ClipboardList, ListChecks, Users } from 'lucide-react'
import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { getIpdDashboardStats } from '@/lib/api/ipd'
import { listNursingTaskQueue } from '@/lib/api/nursing'

export default function NursingDashboardPage() {
  const statsQuery = useQuery({ queryKey: ['ipd', 'dashboard-stats'], queryFn: getIpdDashboardStats })
  const stats = statsQuery.data

  const urgentTasksQuery = useQuery({
    queryKey: ['ipd', 'nursing-tasks-queue', 'urgent'],
    queryFn: () => listNursingTaskQueue({ priority: 'STAT' as never, status: 'PENDING' as never, limit: 5 }),
  })
  const urgentTasks = urgentTasksQuery.data?.data ?? []

  const tiles = [
    { key: 'inpatients', label: 'Patient census', icon: Users, value: stats?.inpatients },
    { key: 'occupancy', label: 'Bed occupancy', icon: BedDouble, value: stats ? `${stats.occupancyPercent}%` : undefined },
    { key: 'pendingTasks', label: 'Pending nursing tasks', icon: ListChecks, value: stats?.pendingNursingTasks },
    { key: 'pendingDischarge', label: 'Pending discharge', icon: ClipboardList, value: stats?.pendingDischarge },
  ] as const

  return (
    <div className="space-y-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Nursing Dashboard</h1>
          <p className="text-sm text-muted-foreground">Patient census, tasks, and ward operations.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/dashboard/nursing/patients">Assigned patients</Link>
          </Button>
          <Button asChild>
            <Link href="/dashboard/nursing/tasks">Nursing tasks</Link>
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

      <div className="rounded-lg border bg-card p-4">
        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          STAT tasks awaiting action
        </h3>
        {urgentTasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No pending STAT-priority tasks.</p>
        ) : (
          <ul className="space-y-2">
            {urgentTasks.map((t) => (
              <li key={t.id} className="text-sm">
                <Link href={`/dashboard/ipd/${t.admission.id}`} className="text-primary hover:underline">
                  {t.admission.patientName}
                </Link>{' '}
                — {t.title} ({t.admission.wardName})
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
