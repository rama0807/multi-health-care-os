'use client'

import { NursingTaskPriority, NursingTaskStatus } from '@medicore/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2 } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

import { PageLayout } from '@/components/layout/page-layout'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { TableSkeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/ui/status-badge'
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'
import { listNursingTaskQueue, updateNursingTaskStatus } from '@/lib/api/nursing'
import { useAuth } from '@/lib/auth/auth-context'

function getErrorMessage(error: unknown): string {
  const axiosError = error as { response?: { data?: { error?: { message?: string } } } }
  return axiosError?.response?.data?.error?.message ?? 'Something went wrong. Please try again.'
}

function formatEnumLabel(value: string): string {
  return value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, ' ')
}

function formatDateTime(value: string | Date): string {
  return new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
}

export default function NursingTasksQueuePage() {
  const { hasPermission } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const canManage = hasPermission('ipd.tasks.update')

  const [status, setStatus] = useState<string>('PENDING')
  const [priority, setPriority] = useState<string>('all')

  const tasksQuery = useQuery({
    queryKey: ['ipd', 'nursing-tasks-queue', status, priority],
    queryFn: () =>
      listNursingTaskQueue({
        status: status === 'all' ? undefined : (status as NursingTaskStatus),
        priority: priority === 'all' ? undefined : (priority as NursingTaskPriority),
        limit: 100,
      }),
  })
  const tasks = tasksQuery.data?.data ?? []

  const completeMutation = useMutation({
    mutationFn: (taskId: string) => updateNursingTaskStatus(taskId, { status: 'COMPLETED' as never }),
    onSuccess: () => {
      toast({ title: 'Task completed' })
      void queryClient.invalidateQueries({ queryKey: ['ipd', 'nursing-tasks-queue'] })
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Could not complete task', description: getErrorMessage(error) }),
  })

  return (
    <PageLayout title="Nursing Tasks" description="Org-wide nursing task queue across all wards.">
      <div className="flex flex-wrap gap-2">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {Object.values(NursingTaskStatus).map((s) => (
              <SelectItem key={s} value={s}>
                {formatEnumLabel(s)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={priority} onValueChange={setPriority}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priorities</SelectItem>
            {Object.values(NursingTaskPriority).map((p) => (
              <SelectItem key={p} value={p}>
                {formatEnumLabel(p)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {tasksQuery.isLoading ? (
        <TableSkeleton rows={8} columns={7} />
      ) : tasks.length === 0 ? (
        <EmptyState variant="search" title="No nursing tasks found" description="Try a different status or priority filter." />
      ) : (
        <TableContainer className="max-h-[65vh]">
          <Table density="compact" container={false}>
            <TableHeader>
              <TableRow>
                <TableHead>Patient</TableHead>
                <TableHead>Ward</TableHead>
                <TableHead>Task</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Due</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-28" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="text-sm">
                    <Link href={`/dashboard/ipd/${t.admission.id}`} className="text-primary hover:underline">
                      {t.admission.patientName}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm">{t.admission.wardName}</TableCell>
                  <TableCell className="text-sm">{t.title}</TableCell>
                  <TableCell>
                    <StatusBadge status={t.priority} />
                  </TableCell>
                  <TableCell className="text-sm">{t.dueAt ? formatDateTime(t.dueAt) : '—'}</TableCell>
                  <TableCell>
                    <StatusBadge status={t.status} />
                  </TableCell>
                  <TableCell>
                    {canManage && t.status !== NursingTaskStatus.COMPLETED && t.status !== NursingTaskStatus.CANCELLED && (
                      <Button size="sm" variant="ghost" disabled={completeMutation.isPending} onClick={() => completeMutation.mutate(t.id)}>
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Complete
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </PageLayout>
  )
}
