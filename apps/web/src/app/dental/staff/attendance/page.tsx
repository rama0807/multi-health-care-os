'use client'

import { AttendanceStatus, type Attendance } from '@medicore/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useState } from 'react'

import { PageLayout } from '@/components/layout/page-layout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Pagination } from '@/components/ui/pagination'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { TableSkeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/ui/status-badge'
import { Table, TableBody, TableCell, TableContainer, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { correctAttendance, listAttendance } from '@/lib/api/attendance'
import { useAuth } from '@/lib/auth/auth-context'

function getErrorMessage(error: unknown): string {
  const axiosError = error as { response?: { data?: { error?: { message?: string } } } }
  return axiosError?.response?.data?.error?.message ?? 'Something went wrong. Please try again.'
}

function formatEnumLabel(value: string): string {
  return value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, ' ')
}

export default function AttendancePage() {
  const { hasPermission } = useAuth()
  const canCorrect = hasPermission('attendance.update')

  const [status, setStatus] = useState<AttendanceStatus | 'ALL'>('ALL')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)
  const [correcting, setCorrecting] = useState<Attendance | null>(null)

  const attendanceQuery = useQuery({
    queryKey: ['attendance', 'list', { status, from, to, page }],
    queryFn: () =>
      listAttendance({
        status: status === 'ALL' ? undefined : status,
        from: from || undefined,
        to: to || undefined,
        page,
        limit: 20,
      }),
  })

  const rows = attendanceQuery.data?.data ?? []
  const pagination = attendanceQuery.data?.pagination

  const hasFilters = status !== 'ALL' || Boolean(from) || Boolean(to)

  return (
    <PageLayout title="Attendance" description="Daily attendance across all staff, with corrections.">
      <div className="flex flex-wrap gap-2">
        <Select value={status} onValueChange={(v) => { setStatus(v as AttendanceStatus | 'ALL'); setPage(1) }}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            {Object.values(AttendanceStatus).map((s) => (
              <SelectItem key={s} value={s}>
                {formatEnumLabel(s)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1) }} className="w-40" />
        <Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1) }} className="w-40" />
      </div>

      {attendanceQuery.isLoading ? (
        <TableSkeleton rows={8} columns={7} />
      ) : rows.length === 0 ? (
        <EmptyState variant={hasFilters ? 'search' : 'empty'} title="No attendance records found" />
      ) : (
        <TableContainer className="max-h-[65vh]">
          <Table density="compact" container={false}>
            <TableHeader>
              <TableRow>
                <TableHead>Staff</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Clock in</TableHead>
                <TableHead>Clock out</TableHead>
                <TableHead align="right">Worked (mins)</TableHead>
                {canCorrect && <TableHead />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.staff?.fullName ?? row.staffId}</TableCell>
                  <TableCell>{row.date}</TableCell>
                  <TableCell>
                    <StatusBadge status={row.status} />
                    {row.isCorrected && <Badge variant="outline" className="ml-1">Corrected</Badge>}
                  </TableCell>
                  <TableCell>{row.clockInAt ? new Date(row.clockInAt).toLocaleTimeString('en-IN') : '-'}</TableCell>
                  <TableCell>{row.clockOutAt ? new Date(row.clockOutAt).toLocaleTimeString('en-IN') : '-'}</TableCell>
                  <TableCell align="right">{row.workedMinutes ?? '-'}</TableCell>
                  {canCorrect && (
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => setCorrecting(row)}>
                        Correct
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {pagination && pagination.totalPages > 1 && (
        <Pagination page={pagination.page} totalPages={pagination.totalPages} onPageChange={setPage} />
      )}

      {correcting && <CorrectDialog attendance={correcting} onOpenChange={(open) => !open && setCorrecting(null)} />}
    </PageLayout>
  )
}

function CorrectDialog({
  attendance,
  onOpenChange,
}: {
  attendance: Attendance
  onOpenChange: (open: boolean) => void
}) {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [status, setStatus] = useState<AttendanceStatus>(attendance.status)
  const [clockInAt, setClockInAt] = useState(attendance.clockInAt ? new Date(attendance.clockInAt).toISOString().slice(0, 16) : '')
  const [clockOutAt, setClockOutAt] = useState(attendance.clockOutAt ? new Date(attendance.clockOutAt).toISOString().slice(0, 16) : '')
  const [reason, setReason] = useState('')

  const mutation = useMutation({
    mutationFn: () =>
      correctAttendance(attendance.id, {
        status,
        clockInAt: clockInAt ? new Date(clockInAt).toISOString() : undefined,
        clockOutAt: clockOutAt ? new Date(clockOutAt).toISOString() : undefined,
        correctionReason: reason,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['attendance'] })
      toast({ title: 'Attendance corrected' })
      onOpenChange(false)
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Could not correct attendance', description: getErrorMessage(error) }),
  })

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Correct attendance - {attendance.date}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Select value={status} onValueChange={(v) => setStatus(v as AttendanceStatus)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.values(AttendanceStatus).map((s) => (
                <SelectItem key={s} value={s}>
                  {formatEnumLabel(s)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Clock in</label>
              <Input type="datetime-local" value={clockInAt} onChange={(e) => setClockInAt(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Clock out</label>
              <Input type="datetime-local" value={clockOutAt} onChange={(e) => setClockOutAt(e.target.value)} />
            </div>
          </div>
          <Textarea placeholder="Reason for correction" value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={!reason.trim() || mutation.isPending}>
            {mutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
