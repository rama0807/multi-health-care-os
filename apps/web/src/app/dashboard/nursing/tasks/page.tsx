'use client'

import { NursingTaskPriority, NursingTaskStatus } from '@medicore/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
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

const TASK_STATUS_BADGE: Record<string, 'success' | 'secondary' | 'destructive' | 'outline'> = {
  PENDING: 'outline',
  IN_PROGRESS: 'secondary',
  COMPLETED: 'success',
  MISSED: 'destructive',
  CANCELLED: 'destructive',
}

const TASK_PRIORITY_BADGE: Record<string, 'destructive' | 'secondary' | 'outline'> = {
  STAT: 'destructive',
  URGENT: 'secondary',
  ROUTINE: 'outline',
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
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Nursing Tasks</h1>
        <p className="text-sm text-muted-foreground">Org-wide nursing task queue across all wards.</p>
      </div>

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

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Patient</TableHead>
              <TableHead>Ward</TableHead>
              <TableHead>Task</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Due</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {tasksQuery.isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                </TableCell>
              </TableRow>
            ) : tasks.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  No nursing tasks found.
                </TableCell>
              </TableRow>
            ) : (
              tasks.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="text-sm">
                    <Link href={`/dashboard/ipd/${t.admission.id}`} className="text-primary hover:underline">
                      {t.admission.patientName}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm">{t.admission.wardName}</TableCell>
                  <TableCell className="text-sm">{t.title}</TableCell>
                  <TableCell>
                    <Badge variant={TASK_PRIORITY_BADGE[t.priority]}>{formatEnumLabel(t.priority)}</Badge>
                  </TableCell>
                  <TableCell className="text-sm">{t.dueAt ? formatDateTime(t.dueAt) : '—'}</TableCell>
                  <TableCell>
                    <Badge variant={TASK_STATUS_BADGE[t.status]}>{formatEnumLabel(t.status)}</Badge>
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
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
