'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import {
  CreateDoctorScheduleSchema,
  DoctorAvailabilityStatus,
  DoctorDocumentType,
  LeaveStatus,
  LeaveType,
  UpdateDoctorSchema,
  WEEKDAY_ORDER,
  Weekday,
  type ApplyLeaveDto,
  type CreateDoctorScheduleDto,
  type DoctorLeaveWithDoctor,
  type ScheduleDay,
  type UpdateDoctorDto,
} from '@medicore/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Activity,
  CalendarClock,
  CalendarOff,
  FileText,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { useParams } from 'next/navigation'
import { useState } from 'react'
import { useForm } from 'react-hook-form'

import { PageLayout } from '@/components/layout/page-layout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { PageHeaderMeta } from '@/components/ui/page-header'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { StatusBadge } from '@/components/ui/status-badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { deactivateDoctor, getDoctor, restoreDoctor, updateDoctor } from '@/lib/api/doctors'
import { listDepartments, listHospitals } from '@/lib/api/hospitals'
import {
  applyDoctorLeave,
  approveDoctorLeave,
  cancelDoctorLeave,
  createDoctorSchedule,
  deleteDoctorDocument,
  getDoctorAuditTimeline,
  getDoctorAvailableSlots,
  getDoctorSchedule,
  getDoctorTodayStatus,
  listDoctorDocuments,
  listDoctorLeaves,
  listDoctorScheduleVersions,
  rejectDoctorLeave,
  setDoctorScheduleVersionActive,
  uploadDoctorDocument,
} from '@/lib/api/scheduling'
import { useAuth } from '@/lib/auth/auth-context'

function getErrorMessage(error: unknown): string {
  const axiosError = error as { response?: { data?: { error?: { message?: string } } } }
  return axiosError?.response?.data?.error?.message ?? 'Something went wrong. Please try again.'
}

function formatEnumLabel(value: string): string {
  return value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, ' ')
}

export default function DoctorDetailPage() {
  const params = useParams<{ id: string }>()
  const doctorId = params.id
  const { hasPermission } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [confirmDeactivate, setConfirmDeactivate] = useState(false)

  const canUpdate = hasPermission('doctors.update')
  const canDelete = hasPermission('doctors.delete')

  const doctorQuery = useQuery({
    queryKey: ['doctors', 'detail', doctorId],
    queryFn: () => getDoctor(doctorId),
  })

  const deactivateMutation = useMutation({
    mutationFn: () => deactivateDoctor(doctorId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['doctors'] })
      toast({ title: 'Doctor deactivated' })
      setConfirmDeactivate(false)
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Could not deactivate doctor', description: getErrorMessage(error) })
    },
  })

  const restoreMutation = useMutation({
    mutationFn: () => restoreDoctor(doctorId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['doctors'] })
      toast({ title: 'Doctor restored' })
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Could not restore doctor', description: getErrorMessage(error) })
    },
  })

  if (doctorQuery.isLoading) {
    return (
      <PageLayout
        breadcrumbs={[{ label: 'Doctors', href: '/dashboard/doctors' }, { label: '…' }]}
        title="…"
        loading
      >
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </PageLayout>
    )
  }

  if (doctorQuery.isError || !doctorQuery.data) {
    return (
      <PageLayout breadcrumbs={[{ label: 'Doctors', href: '/dashboard/doctors' }, { label: 'Not found' }]} title="Doctor not found">
        <EmptyState
          variant="error"
          title="Doctor not found"
          description={getErrorMessage(doctorQuery.error)}
          action={{ label: 'Back to doctors', href: '/dashboard/doctors' }}
        />
      </PageLayout>
    )
  }

  const doctor = doctorQuery.data

  return (
    <Tabs defaultValue="profile">
      <PageLayout
        breadcrumbs={[{ label: 'Doctors', href: '/dashboard/doctors' }, { label: `Dr. ${doctor.fullName}` }]}
        title={`Dr. ${doctor.fullName}`}
        badge={
          <>
            <StatusBadge status={doctor.isActive ? 'ACTIVE' : 'INACTIVE'} label={doctor.isActive ? 'Active' : 'Deactivated'} />
            <StatusBadge status={doctor.availabilityStatus} />
          </>
        }
        meta={
          <>
            <PageHeaderMeta label="Specialization">
              {doctor.specialization}
              {doctor.subSpecialization ? ` · ${doctor.subSpecialization}` : ''}
            </PageHeaderMeta>
            <PageHeaderMeta label="Experience">{doctor.experienceYears} yrs</PageHeaderMeta>
            <PageHeaderMeta label="Reg. no.">{doctor.registrationNumber}</PageHeaderMeta>
          </>
        }
        actions={
          <>
            {doctor.isActive && canDelete && (
              <Button variant="destructive" size="sm" onClick={() => setConfirmDeactivate(true)}>
                <Trash2 />
                Deactivate
              </Button>
            )}
            {!doctor.isActive && canUpdate && (
              <Button size="sm" onClick={() => restoreMutation.mutate()} disabled={restoreMutation.isPending}>
                {restoreMutation.isPending ? <Loader2 className="animate-spin" /> : <RotateCcw />}
                Restore
              </Button>
            )}
          </>
        }
        toolbar={
          <TabsList className="flex-wrap">
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="statistics">Statistics</TabsTrigger>
            <TabsTrigger value="schedule">Schedule</TabsTrigger>
            <TabsTrigger value="leave">Leave</TabsTrigger>
            <TabsTrigger value="availability">Availability</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
            <TabsTrigger value="audit">Audit</TabsTrigger>
          </TabsList>
        }
      >
        <TabsContent value="profile">
          <ProfileTab doctor={doctor} canUpdate={canUpdate} />
        </TabsContent>
        <TabsContent value="statistics">
          <StatGrid
            items={[
              ['Appointments', doctor.summary.appointments],
              ['Patients', doctor.summary.patients],
              ['Prescriptions', doctor.summary.prescriptions],
              ['Lab Tests', doctor.summary.labTests],
              ['Radiology Orders', doctor.summary.radiologyOrders],
            ]}
            note="Full clinical detail is available once the Appointments module ships - these are live counts from this doctor's linked records."
          />
        </TabsContent>
        <TabsContent value="schedule">
          <ScheduleTab doctorId={doctorId} />
        </TabsContent>
        <TabsContent value="leave">
          <LeaveTab doctorId={doctorId} />
        </TabsContent>
        <TabsContent value="availability">
          <AvailabilityTab doctorId={doctorId} />
        </TabsContent>
        <TabsContent value="documents">
          <DocumentsTab doctorId={doctorId} />
        </TabsContent>
        <TabsContent value="audit">
          <AuditTab doctorId={doctorId} />
        </TabsContent>

        <Dialog open={confirmDeactivate} onOpenChange={setConfirmDeactivate}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Deactivate Dr. {doctor.fullName}?</DialogTitle>
              <DialogDescription>
                This deactivates the doctor&apos;s profile. It can be restored later from the doctors list.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmDeactivate(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => deactivateMutation.mutate()}
                disabled={deactivateMutation.isPending}
              >
                {deactivateMutation.isPending && <Loader2 className="animate-spin" />}
                Deactivate
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PageLayout>
    </Tabs>
  )
}

function StatGrid({ items, note }: { items: Array<[string, number]>; note: string }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {items.map(([label, value]) => (
          <div key={label} className="rounded-lg border bg-card p-4">
            <p className="text-2xl font-semibold text-foreground">{value}</p>
            <p className="text-sm text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{note}</p>
    </div>
  )
}

interface ProfileTabProps {
  doctor: NonNullable<ReturnType<typeof useQuery<Awaited<ReturnType<typeof getDoctor>>>>['data']>
  canUpdate: boolean
}

function ProfileTab({ doctor, canUpdate }: ProfileTabProps) {
  const [editing, setEditing] = useState(false)
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const form = useForm<UpdateDoctorDto>({
    resolver: zodResolver(UpdateDoctorSchema),
    defaultValues: {
      registrationNumber: doctor.registrationNumber,
      specialization: doctor.specialization,
      subSpecialization: doctor.subSpecialization ?? undefined,
      qualification: doctor.qualification,
      experienceYears: doctor.experienceYears,
      languagesSpoken: doctor.languagesSpoken,
      bio: doctor.bio ?? undefined,
      consultationFee: doctor.consultationFee,
      availabilityStatus: doctor.availabilityStatus,
      joiningDate: new Date(doctor.joiningDate).toISOString().slice(0, 10),
      hospitalId: doctor.hospitalId,
      departmentId: doctor.departmentId ?? undefined,
    },
  })

  const hospitalId = form.watch('hospitalId')
  const hospitalsQuery = useQuery({ queryKey: ['hospitals'], queryFn: listHospitals, enabled: editing })
  const departmentsQuery = useQuery({
    queryKey: ['departments', hospitalId],
    queryFn: () => listDepartments(hospitalId),
    enabled: editing && Boolean(hospitalId),
  })

  const updateMutation = useMutation({
    mutationFn: (dto: UpdateDoctorDto) => updateDoctor(doctor.id, dto),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['doctors', 'detail', doctor.id] })
      void queryClient.invalidateQueries({ queryKey: ['doctors', 'list'] })
      toast({ title: 'Profile updated' })
      setEditing(false)
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Update failed', description: getErrorMessage(error) })
    },
  })

  if (!editing) {
    const rows: Array<[string, string]> = [
      ['Registration number', doctor.registrationNumber],
      ['Specialization', doctor.specialization],
      ['Sub-specialization', doctor.subSpecialization ?? '-'],
      ['Qualification', doctor.qualification],
      ['Experience', `${doctor.experienceYears} years`],
      ['Languages spoken', doctor.languagesSpoken.join(', ') || '-'],
      ['Consultation fee', `₹${doctor.consultationFee}`],
      ['Joining date', new Date(doctor.joiningDate).toLocaleDateString('en-IN', { dateStyle: 'medium' })],
      ['Hospital', doctor.hospital?.name ?? '-'],
      ['Department', doctor.department?.name ?? '-'],
      ['Email', doctor.email],
      ['Phone', doctor.phone ?? '-'],
      ['Biography', doctor.bio ?? '-'],
    ]

    return (
      <div className="space-y-4 rounded-lg border bg-card p-4">
        <div className="flex justify-end">
          {canUpdate && (
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              <Pencil />
              Edit
            </Button>
          )}
        </div>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
          {rows.map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
              <dd className="text-sm font-medium text-foreground">{value}</dd>
            </div>
          ))}
        </dl>
      </div>
    )
  }

  return (
    <Form {...form}>
      <form
        onSubmit={(e) => void form.handleSubmit((values) => updateMutation.mutate(values))(e)}
        className="space-y-4 rounded-lg border bg-card p-4"
      >
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="hospitalId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Hospital</FormLabel>
                <Select
                  value={field.value}
                  onValueChange={(v) => {
                    field.onChange(v)
                    form.setValue('departmentId', undefined)
                  }}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {hospitalsQuery.data?.map((h) => (
                      <SelectItem key={h.id} value={h.id}>
                        {h.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="departmentId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Department</FormLabel>
                <Select value={field.value ?? ''} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {departmentsQuery.data?.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="registrationNumber"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Registration number</FormLabel>
              <FormControl>
                <Input {...field} value={field.value ?? ''} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="specialization"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Specialization</FormLabel>
                <FormControl>
                  <Input {...field} value={field.value ?? ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="subSpecialization"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Sub-specialization</FormLabel>
                <FormControl>
                  <Input {...field} value={field.value ?? ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="qualification"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Qualification</FormLabel>
              <FormControl>
                <Input {...field} value={field.value ?? ''} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="experienceYears"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Experience (years)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={0}
                    max={70}
                    {...field}
                    value={field.value ?? 0}
                    onChange={(e) => field.onChange(Number(e.target.value))}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="consultationFee"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Consultation fee (₹)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    {...field}
                    value={field.value ?? 0}
                    onChange={(e) => field.onChange(Number(e.target.value))}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="joiningDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Joining date</FormLabel>
                <FormControl>
                  <Input type="date" {...field} value={field.value ?? ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="availabilityStatus"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Availability status</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {Object.values(DoctorAvailabilityStatus).map((s) => (
                      <SelectItem key={s} value={s}>
                        {formatEnumLabel(s)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="languagesSpoken"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Languages spoken (comma-separated)</FormLabel>
              <FormControl>
                <Input
                  value={(field.value ?? []).join(', ')}
                  onChange={(e) =>
                    field.onChange(
                      e.target.value
                        .split(',')
                        .map((s) => s.trim())
                        .filter(Boolean),
                    )
                  }
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="bio"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Biography</FormLabel>
              <FormControl>
                <Textarea rows={4} {...field} value={field.value ?? ''} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex justify-end gap-2 border-t pt-4">
          <Button type="button" variant="outline" onClick={() => setEditing(false)}>
            Cancel
          </Button>
          <Button type="submit" disabled={updateMutation.isPending}>
            {updateMutation.isPending && <Loader2 className="animate-spin" />}
            Save changes
          </Button>
        </div>
      </form>
    </Form>
  )
}

function PermissionNotice() {
  return (
    <p className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
      You don&apos;t have permission to view this.
    </p>
  )
}

function TabSpinner() {
  return (
    <div className="flex h-24 items-center justify-center">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  )
}

interface ShiftFormState {
  startTime: string
  endTime: string
  slotDurationMinutes: number
  breaks: Array<{ startTime: string; endTime: string }>
}

interface DayFormState {
  dayOfWeek: Weekday
  isWorkingDay: boolean
  shifts: ShiftFormState[]
}

function defaultShift(): ShiftFormState {
  return { startTime: '09:00', endTime: '17:00', slotDurationMinutes: 30, breaks: [] }
}

function buildDefaultDays(): DayFormState[] {
  return WEEKDAY_ORDER.map((dayOfWeek) => ({ dayOfWeek, isWorkingDay: false, shifts: [] }))
}

function ScheduleTab({ doctorId }: { doctorId: string }) {
  const { hasPermission } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [creating, setCreating] = useState(false)

  const canRead = hasPermission('doctors.schedule.read')
  const canManage = hasPermission('doctors.schedule.update')

  const effectiveQuery = useQuery({
    queryKey: ['doctors', 'schedule', 'effective', doctorId],
    queryFn: () => getDoctorSchedule(doctorId),
    enabled: canRead,
  })
  const versionsQuery = useQuery({
    queryKey: ['doctors', 'schedule', 'versions', doctorId],
    queryFn: () => listDoctorScheduleVersions(doctorId),
    enabled: canRead,
  })

  const toggleActiveMutation = useMutation({
    mutationFn: ({ scheduleId, isActive }: { scheduleId: string; isActive: boolean }) =>
      setDoctorScheduleVersionActive(doctorId, scheduleId, isActive),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['doctors', 'schedule', 'versions', doctorId] })
      void queryClient.invalidateQueries({ queryKey: ['doctors', 'schedule', 'effective', doctorId] })
      toast({ title: 'Schedule version updated' })
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Update failed', description: getErrorMessage(error) })
    },
  })

  if (!canRead) return <PermissionNotice />
  if (effectiveQuery.isLoading || versionsQuery.isLoading) return <TabSpinner />

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Current schedule</h3>
          {canManage && (
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus />
              New version
            </Button>
          )}
        </div>
        {effectiveQuery.data ? (
          <EffectiveScheduleGrid days={effectiveQuery.data.days} />
        ) : (
          <p className="text-sm text-muted-foreground">No schedule is currently in effect for this doctor.</p>
        )}
      </div>

      <div className="rounded-lg border bg-card">
        <div className="border-b p-4">
          <h3 className="text-sm font-semibold text-foreground">Version history</h3>
        </div>
        {versionsQuery.data?.length ? (
          <ul className="divide-y">
            {versionsQuery.data.map((version) => (
              <li key={version.id} className="flex items-center justify-between gap-3 p-4">
                <div className="flex items-center gap-3">
                  <CalendarClock className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      Effective from{' '}
                      {new Date(version.effectiveFrom).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {version.days.filter((d) => d.isWorkingDay).length} working days
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={version.isActive ? 'success' : 'secondary'}>
                    {version.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                  {canManage && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={toggleActiveMutation.isPending}
                      onClick={() =>
                        toggleActiveMutation.mutate({ scheduleId: version.id, isActive: !version.isActive })
                      }
                    >
                      {version.isActive ? 'Deactivate' : 'Activate'}
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="p-4 text-sm text-muted-foreground">No schedule versions yet.</p>
        )}
      </div>

      {canManage && (
        <NewScheduleDialog
          doctorId={doctorId}
          open={creating}
          onOpenChange={setCreating}
          onCreated={() => {
            void queryClient.invalidateQueries({ queryKey: ['doctors', 'schedule', 'versions', doctorId] })
            void queryClient.invalidateQueries({ queryKey: ['doctors', 'schedule', 'effective', doctorId] })
          }}
        />
      )}
    </div>
  )
}

function EffectiveScheduleGrid({ days }: { days: ScheduleDay[] }) {
  const byDay = new Map(days.map((d) => [d.dayOfWeek, d]))

  return (
    <ul className="divide-y">
      {WEEKDAY_ORDER.map((dayOfWeek) => {
        const day = byDay.get(dayOfWeek)
        return (
          <li key={dayOfWeek} className="flex items-center justify-between gap-3 py-2 text-sm">
            <span className="w-24 font-medium text-foreground">{formatEnumLabel(dayOfWeek)}</span>
            {day?.isWorkingDay ? (
              <div className="flex flex-1 flex-wrap justify-end gap-1.5">
                {day.shifts.map((shift, i) => (
                  <Badge key={i} variant="secondary">
                    {shift.startTime}–{shift.endTime} · {shift.slotDurationMinutes}m slots
                  </Badge>
                ))}
              </div>
            ) : (
              <span className="text-muted-foreground">Off</span>
            )}
          </li>
        )
      })}
    </ul>
  )
}

function NewScheduleDialog({
  doctorId,
  open,
  onOpenChange,
  onCreated,
}: {
  doctorId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => void
}) {
  const { toast } = useToast()
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().slice(0, 10))
  const [days, setDays] = useState<DayFormState[]>(buildDefaultDays())

  const createMutation = useMutation({
    mutationFn: (dto: CreateDoctorScheduleDto) => createDoctorSchedule(doctorId, dto),
    onSuccess: () => {
      toast({ title: 'Schedule version created' })
      onCreated()
      onOpenChange(false)
      setDays(buildDefaultDays())
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Could not create schedule', description: getErrorMessage(error) })
    },
  })

  function toggleWorkingDay(dayOfWeek: Weekday, isWorkingDay: boolean) {
    setDays((prev) =>
      prev.map((d) =>
        d.dayOfWeek === dayOfWeek
          ? { ...d, isWorkingDay, shifts: isWorkingDay ? (d.shifts.length ? d.shifts : [defaultShift()]) : [] }
          : d,
      ),
    )
  }

  function updateShift(dayOfWeek: Weekday, index: number, patch: Partial<ShiftFormState>) {
    setDays((prev) =>
      prev.map((d) =>
        d.dayOfWeek === dayOfWeek
          ? { ...d, shifts: d.shifts.map((s, i) => (i === index ? { ...s, ...patch } : s)) }
          : d,
      ),
    )
  }

  function addShift(dayOfWeek: Weekday) {
    setDays((prev) =>
      prev.map((d) => (d.dayOfWeek === dayOfWeek ? { ...d, shifts: [...d.shifts, defaultShift()] } : d)),
    )
  }

  function removeShift(dayOfWeek: Weekday, index: number) {
    setDays((prev) =>
      prev.map((d) => (d.dayOfWeek === dayOfWeek ? { ...d, shifts: d.shifts.filter((_, i) => i !== index) } : d)),
    )
  }

  function toggleBreak(dayOfWeek: Weekday, shiftIndex: number, hasBreak: boolean) {
    setDays((prev) =>
      prev.map((d) =>
        d.dayOfWeek === dayOfWeek
          ? {
              ...d,
              shifts: d.shifts.map((s, i) =>
                i === shiftIndex ? { ...s, breaks: hasBreak ? [{ startTime: '13:00', endTime: '13:30' }] : [] } : s,
              ),
            }
          : d,
      ),
    )
  }

  function updateBreak(dayOfWeek: Weekday, shiftIndex: number, patch: Partial<{ startTime: string; endTime: string }>) {
    setDays((prev) =>
      prev.map((d) =>
        d.dayOfWeek === dayOfWeek
          ? {
              ...d,
              shifts: d.shifts.map((s, i) =>
                i === shiftIndex ? { ...s, breaks: s.breaks.map((b) => ({ ...b, ...patch })) } : s,
              ),
            }
          : d,
      ),
    )
  }

  function handleSubmit() {
    const dto = { effectiveFrom, days }
    const parsed = CreateDoctorScheduleSchema.safeParse(dto)
    if (!parsed.success) {
      toast({
        variant: 'destructive',
        title: 'Invalid schedule',
        description: parsed.error.issues[0]?.message ?? 'Check the day/shift values.',
      })
      return
    }
    createMutation.mutate(parsed.data)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>New schedule version</DialogTitle>
          <DialogDescription>
            Define a full week (Sunday–Saturday). Working days need at least one shift.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Effective from</label>
          <Input type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} />
        </div>

        <div className="space-y-3">
          {days.map((day) => (
            <div key={day.dayOfWeek} className="rounded-md border p-3">
              <label className="flex items-center gap-2">
                <Checkbox
                  checked={day.isWorkingDay}
                  onCheckedChange={(checked) => toggleWorkingDay(day.dayOfWeek, checked === true)}
                />
                <span className="text-sm font-medium">{formatEnumLabel(day.dayOfWeek)}</span>
              </label>

              {day.isWorkingDay && (
                <div className="mt-3 space-y-3 pl-6">
                  {day.shifts.map((shift, shiftIndex) => (
                    <div key={shiftIndex} className="space-y-2 rounded border border-dashed p-2">
                      <div className="flex items-end gap-2">
                        <div className="flex-1 space-y-1">
                          <label className="text-xs text-muted-foreground">Start</label>
                          <Input
                            type="time"
                            value={shift.startTime}
                            onChange={(e) => updateShift(day.dayOfWeek, shiftIndex, { startTime: e.target.value })}
                          />
                        </div>
                        <div className="flex-1 space-y-1">
                          <label className="text-xs text-muted-foreground">End</label>
                          <Input
                            type="time"
                            value={shift.endTime}
                            onChange={(e) => updateShift(day.dayOfWeek, shiftIndex, { endTime: e.target.value })}
                          />
                        </div>
                        <div className="w-28 space-y-1">
                          <label className="text-xs text-muted-foreground">Slot (min)</label>
                          <Input
                            type="number"
                            min={5}
                            max={240}
                            value={shift.slotDurationMinutes}
                            onChange={(e) =>
                              updateShift(day.dayOfWeek, shiftIndex, {
                                slotDurationMinutes: Number(e.target.value),
                              })
                            }
                          />
                        </div>
                        {day.shifts.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 text-destructive"
                            onClick={() => removeShift(day.dayOfWeek, shiftIndex)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>

                      <label className="flex items-center gap-2">
                        <Checkbox
                          checked={shift.breaks.length > 0}
                          onCheckedChange={(checked) => toggleBreak(day.dayOfWeek, shiftIndex, checked === true)}
                        />
                        <span className="text-xs text-muted-foreground">Add a break</span>
                      </label>

                      {shift.breaks.length > 0 && (
                        <div className="flex items-end gap-2 pl-6">
                          <div className="flex-1 space-y-1">
                            <label className="text-xs text-muted-foreground">Break start</label>
                            <Input
                              type="time"
                              value={shift.breaks[0].startTime}
                              onChange={(e) =>
                                updateBreak(day.dayOfWeek, shiftIndex, { startTime: e.target.value })
                              }
                            />
                          </div>
                          <div className="flex-1 space-y-1">
                            <label className="text-xs text-muted-foreground">Break end</label>
                            <Input
                              type="time"
                              value={shift.breaks[0].endTime}
                              onChange={(e) => updateBreak(day.dayOfWeek, shiftIndex, { endTime: e.target.value })}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" onClick={() => addShift(day.dayOfWeek)}>
                    <Plus className="h-3.5 w-3.5" />
                    Add shift
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={createMutation.isPending}>
            {createMutation.isPending && <Loader2 className="animate-spin" />}
            Create version
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function LeaveTab({ doctorId }: { doctorId: string }) {
  const { hasPermission } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [applying, setApplying] = useState(false)
  const [decision, setDecision] = useState<{ leaveId: string; kind: 'approve' | 'reject' } | null>(null)
  const [decisionNote, setDecisionNote] = useState('')

  const canRead = hasPermission('doctors.leave.read')
  const canManage = hasPermission('doctors.leave.manage')
  const canApprove = hasPermission('doctors.leave.approve')

  const leavesQuery = useQuery({
    queryKey: ['doctors', 'leaves', doctorId],
    queryFn: () => listDoctorLeaves({ doctorId, limit: 50 }),
    enabled: canRead,
  })

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ['doctors', 'leaves', doctorId] })
  }

  const approveMutation = useMutation({
    mutationFn: ({ leaveId, note }: { leaveId: string; note?: string }) => approveDoctorLeave(leaveId, note),
    onSuccess: () => {
      invalidate()
      toast({ title: 'Leave approved' })
      setDecision(null)
      setDecisionNote('')
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Approval failed', description: getErrorMessage(error) }),
  })

  const rejectMutation = useMutation({
    mutationFn: ({ leaveId, note }: { leaveId: string; note?: string }) => rejectDoctorLeave(leaveId, note),
    onSuccess: () => {
      invalidate()
      toast({ title: 'Leave rejected' })
      setDecision(null)
      setDecisionNote('')
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Rejection failed', description: getErrorMessage(error) }),
  })

  const cancelMutation = useMutation({
    mutationFn: (leaveId: string) => cancelDoctorLeave(leaveId),
    onSuccess: () => {
      invalidate()
      toast({ title: 'Leave cancelled' })
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Cancel failed', description: getErrorMessage(error) }),
  })

  if (!canRead) return <PermissionNotice />

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setApplying(true)}>
            <Plus />
            Apply for leave
          </Button>
        </div>
      )}

      <div className="rounded-lg border bg-card">
        {leavesQuery.isLoading ? (
          <TabSpinner />
        ) : leavesQuery.data?.data.length ? (
          <ul className="divide-y">
            {leavesQuery.data.data.map((leave: DoctorLeaveWithDoctor) => (
              <li key={leave.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <CalendarOff className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {formatEnumLabel(leave.leaveType)} ·{' '}
                      {new Date(leave.startDate).toLocaleDateString('en-IN', { dateStyle: 'medium' })} –{' '}
                      {new Date(leave.endDate).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                    </p>
                    {leave.reason && <p className="text-xs text-muted-foreground">{leave.reason}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={leave.status} />
                  {leave.status === LeaveStatus.PENDING && canApprove && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setDecision({ leaveId: leave.id, kind: 'approve' })}
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setDecision({ leaveId: leave.id, kind: 'reject' })}
                      >
                        Reject
                      </Button>
                    </>
                  )}
                  {(leave.status === LeaveStatus.PENDING || leave.status === LeaveStatus.APPROVED) && canManage && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      disabled={cancelMutation.isPending}
                      onClick={() => cancelMutation.mutate(leave.id)}
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="p-4 text-sm text-muted-foreground">No leave requests yet.</p>
        )}
      </div>

      {canManage && (
        <ApplyLeaveDialog
          doctorId={doctorId}
          open={applying}
          onOpenChange={setApplying}
          onApplied={invalidate}
        />
      )}

      <Dialog open={decision !== null} onOpenChange={(open) => !open && setDecision(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{decision?.kind === 'approve' ? 'Approve' : 'Reject'} leave request</DialogTitle>
            <DialogDescription>Optionally add a note explaining this decision.</DialogDescription>
          </DialogHeader>
          <Textarea
            rows={3}
            placeholder="Decision note (optional)"
            value={decisionNote}
            onChange={(e) => setDecisionNote(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDecision(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!decision) return
                const note = decisionNote || undefined
                if (decision.kind === 'approve') approveMutation.mutate({ leaveId: decision.leaveId, note })
                else rejectMutation.mutate({ leaveId: decision.leaveId, note })
              }}
              disabled={approveMutation.isPending || rejectMutation.isPending}
            >
              {(approveMutation.isPending || rejectMutation.isPending) && <Loader2 className="animate-spin" />}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ApplyLeaveDialog({
  doctorId,
  open,
  onOpenChange,
  onApplied,
}: {
  doctorId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onApplied: () => void
}) {
  const { toast } = useToast()
  const [leaveType, setLeaveType] = useState<string>(LeaveType.CASUAL)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [reason, setReason] = useState('')

  const applyMutation = useMutation({
    mutationFn: (dto: ApplyLeaveDto) => applyDoctorLeave(dto),
    onSuccess: () => {
      toast({ title: 'Leave request submitted' })
      onApplied()
      onOpenChange(false)
      setStartDate('')
      setEndDate('')
      setReason('')
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Could not apply for leave', description: getErrorMessage(error) })
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Apply for leave</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Leave type</label>
            <Select value={leaveType} onValueChange={setLeaveType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.values(LeaveType).map((lt) => (
                  <SelectItem key={lt} value={lt}>
                    {formatEnumLabel(lt)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Start date</label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">End date</label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Reason (optional)</label>
            <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!startDate || !endDate || applyMutation.isPending}
            onClick={() =>
              applyMutation.mutate({
                doctorId,
                leaveType: leaveType as LeaveType,
                startDate,
                endDate,
                reason: reason || undefined,
              })
            }
          >
            {applyMutation.isPending && <Loader2 className="animate-spin" />}
            Submit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function AvailabilityTab({ doctorId }: { doctorId: string }) {
  const { hasPermission } = useAuth()
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [duration, setDuration] = useState('')

  const canRead = hasPermission('doctors.schedule.read')

  const todayQuery = useQuery({
    queryKey: ['doctors', 'availability', 'today', doctorId],
    queryFn: () => getDoctorTodayStatus(doctorId),
    enabled: canRead,
  })
  const slotsQuery = useQuery({
    queryKey: ['doctors', 'availability', 'slots', doctorId, date, duration],
    queryFn: () => getDoctorAvailableSlots(doctorId, date, duration ? Number(duration) : undefined),
    enabled: canRead && Boolean(date),
  })

  if (!canRead) return <PermissionNotice />

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card p-4">
        <h3 className="mb-2 text-sm font-semibold text-foreground">Today</h3>
        {todayQuery.isLoading ? (
          <TabSpinner />
        ) : todayQuery.data ? (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {todayQuery.data.onLeave ? (
              <Badge variant="secondary">On leave{todayQuery.data.leaveType ? ` · ${formatEnumLabel(todayQuery.data.leaveType)}` : ''}</Badge>
            ) : !todayQuery.data.isWorkingDay ? (
              <Badge variant="secondary">Off duty today</Badge>
            ) : (
              <>
                <Badge variant={todayQuery.data.withinShiftNow ? 'success' : 'secondary'}>
                  {todayQuery.data.withinShiftNow ? 'In shift now' : 'Not currently in shift'}
                </Badge>
                {todayQuery.data.nextShiftStart && (
                  <span className="text-muted-foreground">
                    Next shift:{' '}
                    {new Date(todayQuery.data.nextShiftStart).toLocaleTimeString('en-IN', { timeStyle: 'short' })}
                  </span>
                )}
              </>
            )}
          </div>
        ) : null}
      </div>

      <div className="rounded-lg border bg-card p-4">
        <h3 className="mb-3 text-sm font-semibold text-foreground">Bookable slots</h3>
        <div className="mb-3 flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Date</label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="w-32 space-y-1.5">
            <label className="text-sm font-medium">Duration override (min)</label>
            <Input type="number" min={5} max={240} value={duration} onChange={(e) => setDuration(e.target.value)} />
          </div>
        </div>

        {slotsQuery.isLoading ? (
          <TabSpinner />
        ) : slotsQuery.data?.onLeave ? (
          <p className="text-sm text-muted-foreground">
            On leave{slotsQuery.data.leaveType ? ` (${formatEnumLabel(slotsQuery.data.leaveType)})` : ''} on this date.
          </p>
        ) : !slotsQuery.data?.isWorkingDay ? (
          <p className="text-sm text-muted-foreground">Not a working day.</p>
        ) : slotsQuery.data.slots.length ? (
          <div className="flex flex-wrap gap-1.5">
            {slotsQuery.data.slots.map((slot, i) => (
              <Badge key={i} variant="secondary">
                {new Date(slot.start).toLocaleTimeString('en-IN', { timeStyle: 'short' })}–
                {new Date(slot.end).toLocaleTimeString('en-IN', { timeStyle: 'short' })}
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No slots available on this date.</p>
        )}
      </div>
    </div>
  )
}

function DocumentsTab({ doctorId }: { doctorId: string }) {
  const { hasPermission } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [documentType, setDocumentType] = useState<string>(DoctorDocumentType.OTHER)
  const [file, setFile] = useState<File | null>(null)

  const canRead = hasPermission('doctors.documents.read')
  const canManage = hasPermission('doctors.documents.manage')

  const documentsQuery = useQuery({
    queryKey: ['doctors', 'documents', doctorId],
    queryFn: () => listDoctorDocuments(doctorId),
    enabled: canRead,
  })

  const uploadMutation = useMutation({
    mutationFn: () => {
      if (!file) throw new Error('Choose a file first')
      return uploadDoctorDocument(doctorId, file, documentType as DoctorDocumentType)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['doctors', 'documents', doctorId] })
      toast({ title: 'Document uploaded' })
      setFile(null)
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Upload failed', description: getErrorMessage(error) })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (documentId: string) => deleteDoctorDocument(doctorId, documentId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['doctors', 'documents', doctorId] })
      toast({ title: 'Document deleted' })
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Delete failed', description: getErrorMessage(error) })
    },
  })

  if (!canRead) return <PermissionNotice />

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex flex-col gap-3 rounded-lg border bg-card p-4 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1.5">
            <label className="text-sm font-medium">Document type</label>
            <Select value={documentType} onValueChange={setDocumentType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.values(DoctorDocumentType).map((dt) => (
                  <SelectItem key={dt} value={dt}>
                    {formatEnumLabel(dt)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 space-y-1.5">
            <label className="text-sm font-medium">File (PDF, PNG, JPEG, WEBP - max 10MB)</label>
            <Input
              type="file"
              accept="application/pdf,image/png,image/jpeg,image/webp"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <Button onClick={() => uploadMutation.mutate()} disabled={!file || uploadMutation.isPending}>
            {uploadMutation.isPending ? <Loader2 className="animate-spin" /> : <Upload />}
            Upload
          </Button>
        </div>
      )}

      <div className="rounded-lg border bg-card">
        {documentsQuery.isLoading ? (
          <TabSpinner />
        ) : documentsQuery.data?.length ? (
          <ul className="divide-y">
            {documentsQuery.data.map((doc) => (
              <li key={doc.id} className="flex items-center justify-between gap-3 p-4">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <a
                      href={doc.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm font-medium hover:underline"
                    >
                      {doc.fileName}
                    </a>
                    <p className="text-xs text-muted-foreground">
                      {formatEnumLabel(doc.documentType)} · {(doc.fileSizeBytes / 1024).toFixed(0)} KB ·{' '}
                      {new Date(doc.uploadedAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                    </p>
                  </div>
                </div>
                {canManage && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() => deleteMutation.mutate(doc.id)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="p-4 text-sm text-muted-foreground">No documents uploaded yet.</p>
        )}
      </div>
    </div>
  )
}

function AuditTab({ doctorId }: { doctorId: string }) {
  const { hasPermission } = useAuth()
  const canRead = hasPermission('doctors.read')

  const timelineQuery = useQuery({
    queryKey: ['doctors', 'audit-timeline', doctorId],
    queryFn: () => getDoctorAuditTimeline(doctorId),
    enabled: canRead,
  })

  if (!canRead) return <PermissionNotice />
  if (timelineQuery.isLoading) return <TabSpinner />

  if (!timelineQuery.data?.length) {
    return (
      <p className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">No audit events recorded yet.</p>
    )
  }

  return (
    <ol className="space-y-4 rounded-lg border bg-card p-4">
      {timelineQuery.data.map((entry) => (
        <li key={entry.id} className="flex gap-3">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Activity className="h-4 w-4" />
          </div>
          <div className="flex-1 space-y-0.5">
            <p className="text-sm font-medium capitalize text-foreground">{entry.title}</p>
            <p className="text-xs text-muted-foreground">{entry.resource}</p>
            <p className="text-xs text-muted-foreground">
              {new Date(entry.occurredAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
            </p>
          </div>
        </li>
      ))}
    </ol>
  )
}
