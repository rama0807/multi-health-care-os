'use client'

import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, BedDouble, ClipboardList, ListChecks, Users } from 'lucide-react'
import Link from 'next/link'

import { PageLayout } from '@/components/layout/page-layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { StatCard, StatCardGrid } from '@/components/ui/stat-card'
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
    <PageLayout
      title="Nursing Dashboard"
      description="Patient census, tasks, and ward operations."
      actions={
        <>
          <Button asChild variant="outline">
            <Link href="/dashboard/nursing/patients">Assigned patients</Link>
          </Button>
          <Button asChild>
            <Link href="/dashboard/nursing/tasks">Nursing tasks</Link>
          </Button>
        </>
      }
    >
      <StatCardGrid columns={4}>
        {tiles.map((tile) => (
          <StatCard key={tile.key} icon={tile.icon} label={tile.label} value={tile.value} loading={statsQuery.isLoading} />
        ))}
      </StatCardGrid>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-danger" />
            STAT tasks awaiting action
          </CardTitle>
        </CardHeader>
        <CardContent>
          {urgentTasks.length === 0 ? (
            <EmptyState compact title="No pending STAT-priority tasks" />
          ) : (
            <ul className="space-y-2">
              {urgentTasks.map((t) => (
                <li key={t.id} className="text-sm">
                  <Link href={`/dashboard/ipd/${t.admission.id}`} className="text-primary hover:underline">
                    {t.admission.patientName}
                  </Link>{' '}
                  - {t.title} ({t.admission.wardName})
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </PageLayout>
  )
}
