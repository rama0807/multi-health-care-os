'use client'

import { EmploymentStatus, StaffDocumentType, type ApplyStaffLeaveDto, LeaveType } from '@medicore/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Trash2, Upload } from 'lucide-react'
import { useParams } from 'next/navigation'
import { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { getAttendanceCalendar } from '@/lib/api/attendance'
import { applyStaffLeave, getLeaveBalance, listStaffLeave } from '@/lib/api/leave'
import { deleteStaffDocument, getStaff, listStaffDocuments, setStaffEmploymentStatus, uploadStaffDocument } from '@/lib/api/staff'
import { useAuth } from '@/lib/auth/auth-context'

function getErrorMessage(error: unknown): string {
  const axiosError = error as { response?: { data?: { error?: { message?: string } } } }
  return axiosError?.response?.data?.error?.message ?? 'Something went wrong. Please try again.'
}

function formatEnumLabel(value: string): string {
  return value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, ' ')
}

const STATUS_BADGE: Record<EmploymentStatus, 'success' | 'secondary' | 'destructive' | 'outline'> = {
  ACTIVE: 'success',
  ON_LEAVE: 'outline',
  SUSPENDED: 'destructive',
  TERMINATED: 'secondary',
  RESIGNED: 'secondary',
}

export default function StaffProfilePage() {
  const params = useParams<{ staffId: string }>()
  const staffId = params.staffId
  const { hasPermission } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const canUpdate = hasPermission('staff.update')

  const staffQuery = useQuery({ queryKey: ['staff', staffId], queryFn: () => getStaff(staffId) })
  const staff = staffQuery.data

  const statusMutation = useMutation({
    mutationFn: (status: EmploymentStatus) => setStaffEmploymentStatus(staffId, status),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['staff', staffId] })
      toast({ title: 'Employment status updated' })
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Could not update status', description: getErrorMessage(error) }),
  })

  if (staffQuery.isLoading || !staff) {
    return (
      <div className="flex h-48 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{staff.fullName}</h1>
          <p className="text-sm text-muted-foreground">
            {staff.designation} · {staff.employeeId} · {staff.department?.name ?? 'No department'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={STATUS_BADGE[staff.employmentStatus]}>{formatEnumLabel(staff.employmentStatus)}</Badge>
          {canUpdate && (
            <Select
              value={staff.employmentStatus}
              onValueChange={(v) => statusMutation.mutate(v as EmploymentStatus)}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.values(EmploymentStatus).map((s) => (
                  <SelectItem key={s} value={s}>
                    {formatEnumLabel(s)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="flex-wrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="leave">Leave</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="rounded-lg border bg-card p-4">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <div className="contents">
                <dt className="text-muted-foreground">Email</dt>
                <dd className="font-medium text-foreground">{staff.email}</dd>
              </div>
              <div className="contents">
                <dt className="text-muted-foreground">Phone</dt>
                <dd className="font-medium text-foreground">{staff.phone ?? '—'}</dd>
              </div>
              <div className="contents">
                <dt className="text-muted-foreground">Hospital</dt>
                <dd className="font-medium text-foreground">{staff.hospital?.name ?? '—'}</dd>
              </div>
              <div className="contents">
                <dt className="text-muted-foreground">Department</dt>
                <dd className="font-medium text-foreground">{staff.department?.name ?? '—'}</dd>
              </div>
              <div className="contents">
                <dt className="text-muted-foreground">Employment type</dt>
                <dd className="font-medium text-foreground">{formatEnumLabel(staff.employmentType)}</dd>
              </div>
              <div className="contents">
                <dt className="text-muted-foreground">Reports to</dt>
                <dd className="font-medium text-foreground">
                  {staff.reportsTo ? `${staff.reportsTo.fullName} (${staff.reportsTo.designation})` : '—'}
                </dd>
              </div>
              <div className="contents">
                <dt className="text-muted-foreground">Joining date</dt>
                <dd className="font-medium text-foreground">{new Date(staff.joiningDate).toLocaleDateString('en-IN')}</dd>
              </div>
              <div className="contents">
                <dt className="text-muted-foreground">Date of leaving</dt>
                <dd className="font-medium text-foreground">
                  {staff.dateOfLeaving ? new Date(staff.dateOfLeaving).toLocaleDateString('en-IN') : '—'}
                </dd>
              </div>
              <div className="contents">
                <dt className="text-muted-foreground">Monthly salary</dt>
                <dd className="font-medium text-foreground">
                  {staff.monthlySalary ? `₹${staff.monthlySalary.toLocaleString('en-IN')}` : '—'}
                </dd>
              </div>
            </dl>
          </div>
        </TabsContent>

        <TabsContent value="documents">
          <DocumentsTab staffId={staffId} />
        </TabsContent>

        <TabsContent value="attendance">
          <AttendanceTab staffId={staffId} />
        </TabsContent>

        <TabsContent value="leave">
          <LeaveTab staffId={staffId} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function DocumentsTab({ staffId }: { staffId: string }) {
  const { hasPermission } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const canManage = hasPermission('staff.documents.manage')

  const [documentType, setDocumentType] = useState<StaffDocumentType>(StaffDocumentType.ID_PROOF)
  const [file, setFile] = useState<File | null>(null)

  const documentsQuery = useQuery({ queryKey: ['staff', staffId, 'documents'], queryFn: () => listStaffDocuments(staffId) })

  const uploadMutation = useMutation({
    mutationFn: () => uploadStaffDocument(staffId, documentType, file!),
    onSuccess: () => {
      setFile(null)
      void queryClient.invalidateQueries({ queryKey: ['staff', staffId, 'documents'] })
      toast({ title: 'Document uploaded' })
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Upload failed', description: getErrorMessage(error) }),
  })

  const deleteMutation = useMutation({
    mutationFn: (documentId: string) => deleteStaffDocument(staffId, documentId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['staff', staffId, 'documents'] }),
    onError: (error) => toast({ variant: 'destructive', title: 'Could not delete document', description: getErrorMessage(error) }),
  })

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex flex-wrap items-end gap-2 rounded-lg border bg-card p-4">
          <Select value={documentType} onValueChange={(v) => setDocumentType(v as StaffDocumentType)}>
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.values(StaffDocumentType).map((t) => (
                <SelectItem key={t} value={t}>
                  {formatEnumLabel(t)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="max-w-xs" />
          <Button onClick={() => uploadMutation.mutate()} disabled={!file || uploadMutation.isPending}>
            {uploadMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            Upload
          </Button>
        </div>
      )}

      <div className="divide-y rounded-lg border bg-card">
        {documentsQuery.isLoading ? (
          <div className="flex h-16 items-center justify-center">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : documentsQuery.data?.length ? (
          documentsQuery.data.map((doc) => (
            <div key={doc.id} className="flex items-center justify-between gap-2 p-3 text-sm">
              <div>
                <a href={doc.fileUrl} target="_blank" rel="noreferrer" className="font-medium hover:underline">
                  {doc.fileName}
                </a>
                <span className="ml-2 text-xs text-muted-foreground">{formatEnumLabel(doc.documentType)}</span>
              </div>
              {canManage && (
                <Button variant="ghost" size="sm" onClick={() => deleteMutation.mutate(doc.id)} disabled={deleteMutation.isPending}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          ))
        ) : (
          <p className="p-4 text-sm text-muted-foreground">No documents uploaded yet.</p>
        )}
      </div>
    </div>
  )
}

function AttendanceTab({ staffId }: { staffId: string }) {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7))

  const calendarQuery = useQuery({
    queryKey: ['attendance', 'calendar', staffId, month],
    queryFn: () => getAttendanceCalendar(staffId, month),
  })

  return (
    <div className="space-y-4">
      <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-44" />
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Clock in</TableHead>
              <TableHead>Clock out</TableHead>
              <TableHead>Worked (mins)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {calendarQuery.isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                </TableCell>
              </TableRow>
            ) : calendarQuery.data?.length ? (
              calendarQuery.data.map((day) => (
                <TableRow key={day.date}>
                  <TableCell>{day.date}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{formatEnumLabel(day.status)}</Badge>
                  </TableCell>
                  <TableCell>{day.clockInAt ? new Date(day.clockInAt).toLocaleTimeString('en-IN') : '—'}</TableCell>
                  <TableCell>{day.clockOutAt ? new Date(day.clockOutAt).toLocaleTimeString('en-IN') : '—'}</TableCell>
                  <TableCell>{day.workedMinutes ?? '—'}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  No attendance recorded this month.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

function LeaveTab({ staffId }: { staffId: string }) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const year = new Date().getFullYear()

  const [leaveType, setLeaveType] = useState<LeaveType>(LeaveType.CASUAL)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [reason, setReason] = useState('')

  const leaveQuery = useQuery({ queryKey: ['leave', 'list', staffId], queryFn: () => listStaffLeave({ staffId }) })
  const balanceQuery = useQuery({ queryKey: ['leave', 'balance', staffId, year], queryFn: () => getLeaveBalance(staffId, year) })

  const applyMutation = useMutation({
    mutationFn: (dto: ApplyStaffLeaveDto & { staffId: string }) => applyStaffLeave(dto),
    onSuccess: () => {
      setStartDate('')
      setEndDate('')
      setReason('')
      void queryClient.invalidateQueries({ queryKey: ['leave'] })
      toast({ title: 'Leave applied' })
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Could not apply leave', description: getErrorMessage(error) }),
  })

  return (
    <div className="space-y-4">
      {balanceQuery.data && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {balanceQuery.data.map((b) => (
            <div key={b.leaveType} className="rounded-lg border bg-card p-3">
              <p className="text-xs text-muted-foreground">{formatEnumLabel(b.leaveType)}</p>
              <p className="text-lg font-semibold text-foreground">
                {b.remainingDays} / {b.annualDays}
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-end gap-2 rounded-lg border bg-card p-4">
        <Select value={leaveType} onValueChange={(v) => setLeaveType(v as LeaveType)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.values(LeaveType).map((t) => (
              <SelectItem key={t} value={t}>
                {formatEnumLabel(t)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-40" />
        <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-40" />
        <Textarea placeholder="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} className="max-w-xs" rows={1} />
        <Button
          onClick={() => applyMutation.mutate({ staffId, leaveType, startDate, endDate, reason: reason || undefined })}
          disabled={!startDate || !endDate || applyMutation.isPending}
        >
          {applyMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Apply leave
        </Button>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Dates</TableHead>
              <TableHead>Days</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leaveQuery.isLoading ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                </TableCell>
              </TableRow>
            ) : leaveQuery.data?.data.length ? (
              leaveQuery.data.data.map((leave) => (
                <TableRow key={leave.id}>
                  <TableCell>{formatEnumLabel(leave.leaveType)}</TableCell>
                  <TableCell>
                    {leave.startDate} → {leave.endDate}
                  </TableCell>
                  <TableCell>{leave.days}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{formatEnumLabel(leave.status)}</Badge>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                  No leave requests yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
