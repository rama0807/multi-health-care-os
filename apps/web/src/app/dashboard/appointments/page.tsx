'use client'

import {
  AppointmentStatus,
  AppointmentType,
  RecurrenceFrequency,
  type CreateAppointmentDto,
  type CreateRecurringAppointmentDto,
  type Patient,
} from '@medicore/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Calendar,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Loader2,
  MoreHorizontal,
  Repeat,
  Search,
  Stethoscope,
  UserPlus,
} from 'lucide-react'
import { useState } from 'react'

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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import {
  createAppointment,
  createRecurringAppointment,
  createWalkInAppointment,
  getAppointmentAvailableSlots,
  listAppointments,
  updateAppointmentStatus,
} from '@/lib/api/appointments'
import { listDoctors } from '@/lib/api/doctors'
import { listPatients } from '@/lib/api/patients'
import { useAuth } from '@/lib/auth/auth-context'

function getErrorMessage(error: unknown): string {
  const axiosError = error as { response?: { data?: { error?: { message?: string } } } }
  return axiosError?.response?.data?.error?.message ?? 'Something went wrong. Please try again.'
}

function formatEnumLabel(value: string): string {
  return value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, ' ')
}

function todayIso(): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  date.setDate(date.getDate() + days)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/**
 * Only the primary forward transition is surfaced as a one-click button —
 * the state machine (see ADR-0006 / AppointmentsService.ALLOWED_TRANSITIONS)
 * also permits Cancel/No-show from most states, which live in the overflow
 * menu instead of competing for primary-button space.
 */
const FORWARD_TRANSITION: Partial<Record<AppointmentStatus, AppointmentStatus>> = {
  [AppointmentStatus.SCHEDULED]: AppointmentStatus.CONFIRMED,
  [AppointmentStatus.CONFIRMED]: AppointmentStatus.ARRIVED,
  [AppointmentStatus.ARRIVED]: AppointmentStatus.IN_CONSULTATION,
  [AppointmentStatus.IN_CONSULTATION]: AppointmentStatus.COMPLETED,
}

const STATUS_BADGE: Record<AppointmentStatus, 'success' | 'secondary' | 'destructive'> = {
  [AppointmentStatus.SCHEDULED]: 'secondary',
  [AppointmentStatus.CONFIRMED]: 'secondary',
  [AppointmentStatus.ARRIVED]: 'secondary',
  [AppointmentStatus.IN_CONSULTATION]: 'success',
  [AppointmentStatus.COMPLETED]: 'success',
  [AppointmentStatus.CANCELLED]: 'destructive',
  [AppointmentStatus.NO_SHOW]: 'destructive',
}

export default function AppointmentsPage() {
  const { hasPermission } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [date, setDate] = useState(todayIso())
  const [doctorId, setDoctorId] = useState<string>('all')
  const [status, setStatus] = useState<string>('all')
  const [booking, setBooking] = useState(false)
  const [walkingIn, setWalkingIn] = useState(false)

  const canCreate = hasPermission('appointments.create')
  const canUpdate = hasPermission('appointments.update')

  const doctorsQuery = useQuery({ queryKey: ['doctors', 'list', 'all'], queryFn: () => listDoctors({ limit: 100 }) })

  const appointmentsQuery = useQuery({
    queryKey: ['appointments', 'list', { date, doctorId, status }],
    queryFn: () =>
      listAppointments({
        date,
        doctorId: doctorId === 'all' ? undefined : doctorId,
        status: status === 'all' ? undefined : (status as AppointmentStatus),
        limit: 100,
      }),
  })

  const statusMutation = useMutation({
    mutationFn: ({ id, next }: { id: string; next: AppointmentStatus }) =>
      updateAppointmentStatus(id, { status: next }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['appointments', 'list'] })
      toast({ title: 'Appointment updated' })
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Update failed', description: getErrorMessage(error) })
    },
  })

  const appointments = appointmentsQuery.data?.data ?? []

  return (
    <div className="space-y-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Appointments</h1>
          <p className="text-sm text-muted-foreground">
            {appointmentsQuery.data
              ? `${appointmentsQuery.data.pagination.total} appointment${appointmentsQuery.data.pagination.total === 1 ? '' : 's'} on ${new Date(date).toLocaleDateString('en-IN', { dateStyle: 'medium' })}`
              : 'Loading...'}
          </p>
        </div>
        {canCreate && (
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setWalkingIn(true)}>
              <UserPlus />
              Walk-in
            </Button>
            <Button onClick={() => setBooking(true)}>
              <CalendarPlus />
              Book appointment
            </Button>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="flex items-center gap-1 rounded-md border bg-card p-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDate((d) => addDays(d, -1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-8 w-40 border-0 text-center shadow-none"
          />
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDate((d) => addDays(d, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <Button variant="outline" size="sm" onClick={() => setDate(todayIso())}>
          <Calendar className="h-3.5 w-3.5" />
          Today
        </Button>
        <Select value={doctorId} onValueChange={setDoctorId}>
          <SelectTrigger className="sm:w-56">
            <SelectValue placeholder="Doctor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All doctors</SelectItem>
            {doctorsQuery.data?.data.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                Dr. {d.fullName} — {d.specialization}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="sm:w-44">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {Object.values(AppointmentStatus).map((s) => (
              <SelectItem key={s} value={s}>
                {formatEnumLabel(s)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Time</TableHead>
              <TableHead>Patient</TableHead>
              <TableHead>Doctor</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-32" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {appointmentsQuery.isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                </TableCell>
              </TableRow>
            ) : appointmentsQuery.isError ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  Couldn&apos;t load appointments. {getErrorMessage(appointmentsQuery.error)}
                </TableCell>
              </TableRow>
            ) : appointments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  No appointments on this date.
                </TableCell>
              </TableRow>
            ) : (
              appointments.map((appt) => {
                const forward = FORWARD_TRANSITION[appt.status]
                return (
                  <TableRow key={appt.id}>
                    <TableCell className="font-medium">
                      {new Date(appt.scheduledAt).toLocaleTimeString('en-IN', { timeStyle: 'short' })}
                    </TableCell>
                    <TableCell>
                      <div>{appt.patient.fullName}</div>
                      <div className="font-mono text-xs text-muted-foreground">{appt.patient.uhid}</div>
                    </TableCell>
                    <TableCell>Dr. {appt.doctor.fullName}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        {formatEnumLabel(appt.type)}
                        {appt.isWalkIn && (
                          <Badge variant="secondary" className="gap-1">
                            <UserPlus className="h-3 w-3" />
                            Walk-in
                          </Badge>
                        )}
                        {appt.recurrenceGroupId && (
                          <Badge variant="secondary" className="gap-1">
                            <Repeat className="h-3 w-3" />
                            Recurring
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_BADGE[appt.status]}>{formatEnumLabel(appt.status)}</Badge>
                    </TableCell>
                    <TableCell>
                      {canUpdate && (
                        <div className="flex items-center justify-end gap-1">
                          {forward && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={statusMutation.isPending}
                              onClick={() => statusMutation.mutate({ id: appt.id, next: forward })}
                            >
                              {formatEnumLabel(forward)}
                            </Button>
                          )}
                          {!['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(appt.status) && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() =>
                                    statusMutation.mutate({ id: appt.id, next: AppointmentStatus.CANCELLED })
                                  }
                                >
                                  Cancel
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() =>
                                    statusMutation.mutate({ id: appt.id, next: AppointmentStatus.NO_SHOW })
                                  }
                                >
                                  Mark no-show
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {canCreate && (
        <>
          <BookAppointmentDialog
            open={booking}
            onOpenChange={setBooking}
            defaultDate={date}
            onBooked={() => void queryClient.invalidateQueries({ queryKey: ['appointments', 'list'] })}
          />
          <WalkInDialog
            open={walkingIn}
            onOpenChange={setWalkingIn}
            onBooked={() => void queryClient.invalidateQueries({ queryKey: ['appointments', 'list'] })}
          />
        </>
      )}
    </div>
  )
}

function PatientPicker({
  selected,
  onSelect,
}: {
  selected: Patient | null
  onSelect: (patient: Patient | null) => void
}) {
  const [query, setQuery] = useState('')

  const searchQuery = useQuery({
    queryKey: ['patients', 'search', query],
    queryFn: () => listPatients({ q: query, limit: 8 }),
    enabled: query.trim().length >= 2,
  })

  if (selected) {
    return (
      <div className="flex items-center justify-between rounded-md border p-2">
        <div>
          <p className="text-sm font-medium">{selected.fullName}</p>
          <p className="font-mono text-xs text-muted-foreground">
            {selected.uhid} · {selected.phone}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => onSelect(null)}>
          Change
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-8"
          placeholder="Search by name, phone, or UHID..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      {query.trim().length >= 2 && (
        <div className="max-h-40 overflow-y-auto rounded-md border">
          {searchQuery.isLoading ? (
            <p className="p-2 text-xs text-muted-foreground">Searching...</p>
          ) : searchQuery.data?.data.length ? (
            searchQuery.data.data.map((p) => (
              <button
                type="button"
                key={p.id}
                onClick={() => onSelect(p)}
                className="flex w-full flex-col items-start p-2 text-left text-sm hover:bg-muted"
              >
                <span className="font-medium">{p.fullName}</span>
                <span className="font-mono text-xs text-muted-foreground">
                  {p.uhid} · {p.phone}
                </span>
              </button>
            ))
          ) : (
            <p className="p-2 text-xs text-muted-foreground">No patients found.</p>
          )}
        </div>
      )}
    </div>
  )
}

function WalkInDialog({
  open,
  onOpenChange,
  onBooked,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onBooked: () => void
}) {
  const { toast } = useToast()
  const [patient, setPatient] = useState<Patient | null>(null)
  const [doctorId, setDoctorId] = useState('')
  const [type, setType] = useState<string>(AppointmentType.OPD)
  const [chiefComplaint, setChiefComplaint] = useState('')

  const doctorsQuery = useQuery({ queryKey: ['doctors', 'list', 'all'], queryFn: () => listDoctors({ limit: 100 }) })

  const walkInMutation = useMutation({
    mutationFn: () =>
      createWalkInAppointment({
        patientId: patient!.id,
        doctorId,
        durationMinutes: 15,
        type: type as AppointmentType,
        chiefComplaint: chiefComplaint || undefined,
      }),
    onSuccess: (appointment) => {
      toast({
        title: 'Walk-in booked',
        description: `Slotted in at ${new Date(appointment.scheduledAt).toLocaleTimeString('en-IN', { timeStyle: 'short' })}`,
      })
      onBooked()
      onOpenChange(false)
      reset()
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Walk-in booking failed', description: getErrorMessage(error) })
    },
  })

  function reset() {
    setPatient(null)
    setDoctorId('')
    setType(AppointmentType.OPD)
    setChiefComplaint('')
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next)
        if (!next) reset()
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Walk-in patient</DialogTitle>
          <DialogDescription>
            Slots the patient into the doctor&apos;s next available opening today — no need to pick a time.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Patient</label>
            <PatientPicker selected={patient} onSelect={setPatient} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Doctor</label>
              <Select value={doctorId} onValueChange={setDoctorId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select doctor" />
                </SelectTrigger>
                <SelectContent>
                  {doctorsQuery.data?.data.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      <Stethoscope className="mr-1 inline h-3.5 w-3.5" />
                      Dr. {d.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Type</label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(AppointmentType).map((t) => (
                    <SelectItem key={t} value={t}>
                      {formatEnumLabel(t)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Chief complaint (optional)</label>
            <Textarea rows={2} value={chiefComplaint} onChange={(e) => setChiefComplaint(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!patient || !doctorId || walkInMutation.isPending}
            onClick={() => walkInMutation.mutate()}
          >
            {walkInMutation.isPending && <Loader2 className="animate-spin" />}
            Add walk-in
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function BookAppointmentDialog({
  open,
  onOpenChange,
  defaultDate,
  onBooked,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultDate: string
  onBooked: () => void
}) {
  const { toast } = useToast()
  const [patient, setPatient] = useState<Patient | null>(null)
  const [doctorId, setDoctorId] = useState('')
  const [date, setDate] = useState(defaultDate)
  const [duration, setDuration] = useState(15)
  const [type, setType] = useState<string>(AppointmentType.OPD)
  const [chiefComplaint, setChiefComplaint] = useState('')
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)
  const [isRecurring, setIsRecurring] = useState(false)
  const [time, setTime] = useState('09:00')
  const [frequency, setFrequency] = useState<string>(RecurrenceFrequency.WEEKLY)
  const [occurrences, setOccurrences] = useState(4)

  const doctorsQuery = useQuery({ queryKey: ['doctors', 'list', 'all'], queryFn: () => listDoctors({ limit: 100 }) })
  const slotsQuery = useQuery({
    queryKey: ['appointments', 'available-slots', doctorId, date, duration],
    queryFn: () => getAppointmentAvailableSlots(doctorId, date, duration),
    enabled: Boolean(doctorId) && Boolean(date) && !isRecurring,
  })

  const bookMutation = useMutation({
    mutationFn: (dto: CreateAppointmentDto) => createAppointment(dto),
    onSuccess: () => {
      toast({ title: 'Appointment booked' })
      onBooked()
      onOpenChange(false)
      reset()
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Booking failed', description: getErrorMessage(error) })
    },
  })

  const recurringMutation = useMutation({
    mutationFn: (dto: CreateRecurringAppointmentDto) => createRecurringAppointment(dto),
    onSuccess: (result) => {
      const total = result.booked.length + result.failed.length
      toast({
        title: `Booked ${result.booked.length}/${total} occurrences`,
        description: result.failed.length
          ? `${result.failed.length} conflicted with an existing booking and were skipped.`
          : undefined,
        variant: result.failed.length ? 'destructive' : 'default',
      })
      onBooked()
      onOpenChange(false)
      reset()
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Recurring booking failed', description: getErrorMessage(error) })
    },
  })

  function reset() {
    setPatient(null)
    setDoctorId('')
    setDate(defaultDate)
    setDuration(15)
    setType(AppointmentType.OPD)
    setChiefComplaint('')
    setSelectedSlot(null)
    setIsRecurring(false)
    setTime('09:00')
    setFrequency(RecurrenceFrequency.WEEKLY)
    setOccurrences(4)
  }

  function handleSubmit() {
    if (!patient || !doctorId) return
    if (isRecurring) {
      recurringMutation.mutate({
        patientId: patient.id,
        doctorId,
        startDate: date,
        time,
        frequency: frequency as RecurrenceFrequency,
        occurrences,
        durationMinutes: duration,
        type: type as AppointmentType,
        chiefComplaint: chiefComplaint || undefined,
      })
      return
    }
    if (!selectedSlot) return
    bookMutation.mutate({
      patientId: patient.id,
      doctorId,
      scheduledAt: new Date(selectedSlot).toISOString(),
      durationMinutes: duration,
      type: type as AppointmentType,
      chiefComplaint: chiefComplaint || undefined,
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next)
        if (!next) reset()
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Book appointment</DialogTitle>
          <DialogDescription>Pick a patient, doctor, and an available slot.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Patient</label>
            <PatientPicker selected={patient} onSelect={setPatient} />
          </div>

          <label className="flex items-center gap-2">
            <Checkbox
              checked={isRecurring}
              onCheckedChange={(checked) => {
                setIsRecurring(checked === true)
                setSelectedSlot(null)
              }}
            />
            <span className="flex items-center gap-1 text-sm font-medium">
              <Repeat className="h-3.5 w-3.5" />
              Recurring booking
            </span>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Doctor</label>
              <Select
                value={doctorId}
                onValueChange={(v) => {
                  setDoctorId(v)
                  setSelectedSlot(null)
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select doctor" />
                </SelectTrigger>
                <SelectContent>
                  {doctorsQuery.data?.data.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      <Stethoscope className="mr-1 inline h-3.5 w-3.5" />
                      Dr. {d.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Type</label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(AppointmentType).map((t) => (
                    <SelectItem key={t} value={t}>
                      {formatEnumLabel(t)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {isRecurring ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Start date</label>
                  <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Time</label>
                  <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Frequency</label>
                  <Select value={frequency} onValueChange={setFrequency}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.values(RecurrenceFrequency).map((f) => (
                        <SelectItem key={f} value={f}>
                          {formatEnumLabel(f)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Occurrences</label>
                  <Input
                    type="number"
                    min={2}
                    max={52}
                    value={occurrences}
                    onChange={(e) => setOccurrences(Number(e.target.value))}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Duration (min)</label>
                  <Input
                    type="number"
                    min={5}
                    max={240}
                    value={duration}
                    onChange={(e) => setDuration(Number(e.target.value))}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Each occurrence is booked independently — one that conflicts with an existing appointment is
                skipped and reported, not silently dropped.
              </p>
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Date</label>
                  <Input
                    type="date"
                    value={date}
                    onChange={(e) => {
                      setDate(e.target.value)
                      setSelectedSlot(null)
                    }}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Duration (min)</label>
                  <Input
                    type="number"
                    min={5}
                    max={240}
                    value={duration}
                    onChange={(e) => {
                      setDuration(Number(e.target.value))
                      setSelectedSlot(null)
                    }}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Available slots</label>
                {!doctorId ? (
                  <p className="text-xs text-muted-foreground">Select a doctor to see available slots.</p>
                ) : slotsQuery.isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : slotsQuery.data?.length ? (
                  <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto">
                    {slotsQuery.data.map((slot, i) => (
                      <button
                        type="button"
                        key={i}
                        onClick={() => setSelectedSlot(slot.start)}
                        className={`rounded-full border px-2.5 py-1 text-xs ${
                          selectedSlot === slot.start
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'hover:bg-muted'
                        }`}
                      >
                        {new Date(slot.start).toLocaleTimeString('en-IN', { timeStyle: 'short' })}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No slots available for this doctor on this date.</p>
                )}
              </div>
            </>
          )}

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Chief complaint (optional)</label>
            <Textarea rows={2} value={chiefComplaint} onChange={(e) => setChiefComplaint(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={
              !patient ||
              !doctorId ||
              (isRecurring ? !time || occurrences < 2 : !selectedSlot) ||
              bookMutation.isPending ||
              recurringMutation.isPending
            }
            onClick={handleSubmit}
          >
            {(bookMutation.isPending || recurringMutation.isPending) && <Loader2 className="animate-spin" />}
            {isRecurring ? 'Book recurring appointments' : 'Book appointment'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
