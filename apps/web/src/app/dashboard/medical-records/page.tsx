'use client'

import {
  EncounterStatus,
  EncounterType,
  PrescriptionStatus,
  type CreateEncounterDto,
  type Patient,
} from '@medicore/types'
import { useMutation, useQuery } from '@tanstack/react-query'
import { ClipboardPlus, Loader2, Pill, Search, Stethoscope } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { listDoctors } from '@/lib/api/doctors'
import { createEncounter, listEncounters, listPatientVitals } from '@/lib/api/medical-records'
import { listPatients } from '@/lib/api/patients'
import { listPrescriptions } from '@/lib/api/prescriptions'
import { useAuth } from '@/lib/auth/auth-context'

function getErrorMessage(error: unknown): string {
  const axiosError = error as { response?: { data?: { error?: { message?: string } } } }
  return axiosError?.response?.data?.error?.message ?? 'Something went wrong. Please try again.'
}

function formatEnumLabel(value: string): string {
  return value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, ' ')
}

const STATUS_BADGE: Record<EncounterStatus, 'success' | 'secondary' | 'destructive'> = {
  [EncounterStatus.IN_PROGRESS]: 'secondary',
  [EncounterStatus.COMPLETED]: 'success',
  [EncounterStatus.AMENDED]: 'destructive',
}

const PRESCRIPTION_STATUS_BADGE: Record<PrescriptionStatus, 'secondary' | 'success' | 'destructive'> = {
  [PrescriptionStatus.ACTIVE]: 'secondary',
  [PrescriptionStatus.COMPLETED]: 'success',
  [PrescriptionStatus.DISCONTINUED]: 'destructive',
}

export default function MedicalRecordsPage() {
  const { hasPermission } = useAuth()
  const router = useRouter()
  const [patientFilter, setPatientFilter] = useState<Patient | null>(null)
  const [doctorId, setDoctorId] = useState<string>('all')
  const [status, setStatus] = useState<string>('all')
  const [creating, setCreating] = useState(false)

  const canCreate = hasPermission('medical_records.create')

  const doctorsQuery = useQuery({ queryKey: ['doctors', 'list', 'all'], queryFn: () => listDoctors({ limit: 100 }) })

  const encountersQuery = useQuery({
    queryKey: ['encounters', 'list', { patientId: patientFilter?.id, doctorId, status }],
    queryFn: () =>
      listEncounters({
        patientId: patientFilter?.id,
        doctorId: doctorId === 'all' ? undefined : doctorId,
        status: status === 'all' ? undefined : (status as EncounterStatus),
        limit: 50,
      }),
  })

  const vitalsQuery = useQuery({
    queryKey: ['vitals', 'patient', patientFilter?.id],
    queryFn: () => listPatientVitals(patientFilter!.id),
    enabled: Boolean(patientFilter),
  })

  const prescriptionsQuery = useQuery({
    queryKey: ['prescriptions', 'patient', patientFilter?.id],
    queryFn: () => listPrescriptions({ patientId: patientFilter!.id, limit: 5 }),
    enabled: Boolean(patientFilter),
  })

  const encounters = encountersQuery.data?.data ?? []

  const weightSeries = (vitalsQuery.data ?? [])
    .filter((v) => v.weightKg != null)
    .map((v) => ({ date: new Date(v.recordedAt).toLocaleDateString('en-IN', { dateStyle: 'short' }), weight: v.weightKg }))

  return (
    <div className="space-y-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Medical Records</h1>
          <p className="text-sm text-muted-foreground">
            {encountersQuery.data
              ? `${encountersQuery.data.pagination.total} encounter${encountersQuery.data.pagination.total === 1 ? '' : 's'}`
              : 'Loading...'}
          </p>
        </div>
        {canCreate && (
          <Button onClick={() => setCreating(true)}>
            <ClipboardPlus />
            New encounter
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="sm:max-w-xs sm:flex-1">
          <PatientFilterPicker selected={patientFilter} onSelect={setPatientFilter} />
        </div>
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
            {Object.values(EncounterStatus).map((s) => (
              <SelectItem key={s} value={s}>
                {formatEnumLabel(s)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {patientFilter && (weightSeries.length > 1 || prescriptionsQuery.data?.data.length) && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {weightSeries.length > 1 && (
            <div className="rounded-lg border bg-card p-4">
              <h3 className="mb-3 text-sm font-semibold text-foreground">
                Weight trend — {patientFilter.fullName}
              </h3>
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={weightSeries}>
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} width={32} />
                    <RechartsTooltip />
                    <Line type="monotone" dataKey="weight" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {Boolean(prescriptionsQuery.data?.data.length) && (
            <div className="rounded-lg border bg-card p-4">
              <h3 className="mb-3 text-sm font-semibold text-foreground">
                Recent prescriptions — {patientFilter.fullName}
              </h3>
              <ul className="space-y-2">
                {prescriptionsQuery.data?.data.map((rx) => (
                  <li key={rx.id}>
                    <Link
                      href={rx.encounterId ? `/dashboard/medical-records/${rx.encounterId}` : '#'}
                      className="flex items-center gap-2 text-sm hover:underline"
                    >
                      <Pill className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="font-mono text-xs text-muted-foreground">{rx.prescriptionNumber}</span>
                      <Badge variant={PRESCRIPTION_STATUS_BADGE[rx.status]}>{formatEnumLabel(rx.status)}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {rx.items.map((i) => i.medicationName).join(', ')}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Patient</TableHead>
              <TableHead>Doctor</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {encountersQuery.isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                </TableCell>
              </TableRow>
            ) : encountersQuery.isError ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  Couldn&apos;t load encounters. {getErrorMessage(encountersQuery.error)}
                </TableCell>
              </TableRow>
            ) : encounters.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  No encounters found.
                </TableCell>
              </TableRow>
            ) : (
              encounters.map((enc) => (
                <TableRow key={enc.id} className="cursor-pointer" onClick={() => router.push(`/dashboard/medical-records/${enc.id}`)}>
                  <TableCell className="font-medium">
                    {new Date(enc.encounterDate).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/dashboard/medical-records/${enc.id}`}
                      className="hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {enc.patient.fullName}
                    </Link>
                    <div className="font-mono text-xs text-muted-foreground">{enc.patient.uhid}</div>
                  </TableCell>
                  <TableCell>Dr. {enc.doctor.fullName}</TableCell>
                  <TableCell>{formatEnumLabel(enc.type)}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_BADGE[enc.status]}>{formatEnumLabel(enc.status)}</Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {canCreate && (
        <NewEncounterDialog
          open={creating}
          onOpenChange={setCreating}
          defaultPatient={patientFilter}
          onCreated={(encounterId) => router.push(`/dashboard/medical-records/${encounterId}`)}
        />
      )}
    </div>
  )
}

function PatientFilterPicker({
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
      <div className="flex items-center justify-between rounded-md border bg-card p-2">
        <div className="text-sm">
          <span className="font-medium">{selected.fullName}</span>{' '}
          <span className="font-mono text-xs text-muted-foreground">{selected.uhid}</span>
        </div>
        <Button variant="ghost" size="sm" onClick={() => onSelect(null)}>
          Clear
        </Button>
      </div>
    )
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-8"
          placeholder="Filter by patient..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      {query.trim().length >= 2 && (
        <div className="absolute z-10 mt-1 max-h-40 w-full overflow-y-auto rounded-md border bg-popover shadow-md">
          {searchQuery.isLoading ? (
            <p className="p-2 text-xs text-muted-foreground">Searching...</p>
          ) : searchQuery.data?.data.length ? (
            searchQuery.data.data.map((p) => (
              <button
                type="button"
                key={p.id}
                onClick={() => {
                  onSelect(p)
                  setQuery('')
                }}
                className="flex w-full flex-col items-start p-2 text-left text-sm hover:bg-muted"
              >
                <span className="font-medium">{p.fullName}</span>
                <span className="font-mono text-xs text-muted-foreground">{p.uhid}</span>
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

function NewEncounterDialog({
  open,
  onOpenChange,
  defaultPatient,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultPatient: Patient | null
  onCreated: (encounterId: string) => void
}) {
  const { toast } = useToast()
  const [patient, setPatient] = useState<Patient | null>(defaultPatient)
  const [doctorId, setDoctorId] = useState('')
  const [type, setType] = useState<string>(EncounterType.OPD)
  const [notes, setNotes] = useState('')

  const doctorsQuery = useQuery({ queryKey: ['doctors', 'list', 'all'], queryFn: () => listDoctors({ limit: 100 }) })

  const createMutation = useMutation({
    mutationFn: (dto: CreateEncounterDto) => createEncounter(dto),
    onSuccess: (encounter) => {
      toast({ title: 'Encounter started' })
      onOpenChange(false)
      onCreated(encounter.id)
      setPatient(null)
      setDoctorId('')
      setType(EncounterType.OPD)
      setNotes('')
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Could not create encounter', description: getErrorMessage(error) })
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New encounter</DialogTitle>
          <DialogDescription>Starts a new consultation record for a patient.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Patient</label>
            <PatientFilterPicker selected={patient} onSelect={setPatient} />
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
                  {Object.values(EncounterType).map((t) => (
                    <SelectItem key={t} value={t}>
                      {formatEnumLabel(t)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Notes (optional)</label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!patient || !doctorId || createMutation.isPending}
            onClick={() =>
              patient &&
              createMutation.mutate({
                patientId: patient.id,
                doctorId,
                type: type as EncounterType,
                notes: notes || undefined,
              })
            }
          >
            {createMutation.isPending && <Loader2 className="animate-spin" />}
            Start encounter
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
