'use client'

import { AttendanceStatus, type Attendance } from '@medicore/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Pagination } from '@/components/ui/pagination'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
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

const STATUS_BADGE: Record<AttendanceStatus, 'success' | 'secondary' | 'destructive' | 'outline'> = {
  PRESENT: 'success',
  LATE: 'outline',
  HALF_DAY: 'outline',
  ABSENT: 'destructive',
  ON_LEAVE: 'secondary',
  HOLIDAY: 'secondary',
  WEEK_OFF: 'secondary',
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

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Attendance</h1>
        <p className="text-sm text-muted-foreground">Daily attendance across all staff, with corrections.</p>
      </div>

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

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Staff</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Clock in</TableHead>
              <TableHead>Clock out</TableHead>
              <TableHead>Worked (mins)</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {attendanceQuery.isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  No attendance records found.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.staff?.fullName ?? row.staffId}</TableCell>
                  <TableCell>{row.date}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_BADGE[row.status]}>{formatEnumLabel(row.status)}</Badge>
                    {row.isCorrected && <Badge variant="outline" className="ml-1">Corrected</Badge>}
                  </TableCell>
                  <TableCell>{row.clockInAt ? new Date(row.clockInAt).toLocaleTimeString('en-IN') : '—'}</TableCell>
                  <TableCell>{row.clockOutAt ? new Date(row.clockOutAt).toLocaleTimeString('en-IN') : '—'}</TableCell>
                  <TableCell>{row.workedMinutes ?? '—'}</TableCell>
                  <TableCell>
                    {canCorrect && (
                      <Button variant="ghost" size="sm" onClick={() => setCorrecting(row)}>
                        Correct
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {pagination && pagination.totalPages > 1 && (
        <Pagination page={pagination.page} totalPages={pagination.totalPages} onPageChange={setPage} />
      )}

      {correcting && <CorrectDialog attendance={correcting} onOpenChange={(open) => !open && setCorrecting(null)} />}
    </div>
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
          <DialogTitle>Correct attendance — {attendance.date}</DialogTitle>
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
