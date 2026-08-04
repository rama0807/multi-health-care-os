'use client'

import { AdmissionStatus, AdmissionType, type Patient } from '@medicore/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Plus, Search } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { listDoctors } from '@/lib/api/doctors'
import { listDepartments } from '@/lib/api/hospitals'
import { listPatientCoverages } from '@/lib/api/insurance'
import { createAdmission, listAdmissions, listBeds, listRooms, listWards } from '@/lib/api/ipd'
import { listPatients } from '@/lib/api/patients'
import { useAuth } from '@/lib/auth/auth-context'

function getErrorMessage(error: unknown): string {
  const axiosError = error as { response?: { data?: { error?: { message?: string } } } }
  return axiosError?.response?.data?.error?.message ?? 'Something went wrong. Please try again.'
}

function formatEnumLabel(value: string): string {
  return value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, ' ')
}

const ADMISSION_STATUS_BADGE: Record<AdmissionStatus, 'success' | 'secondary' | 'destructive' | 'outline'> = {
  ADMITTED: 'success',
  DISCHARGED: 'secondary',
  ABSCONDED: 'destructive',
  CANCELLED: 'outline',
}

export default function AdmissionsPage() {
  const { hasPermission } = useAuth()
  const canCreate = hasPermission('ipd.admissions.create')

  const [status, setStatus] = useState<string>('all')
  const [wizardOpen, setWizardOpen] = useState(false)

  const wardsQuery = useQuery({ queryKey: ['ipd', 'wards', 'list', 'all'], queryFn: () => listWards({ limit: 100 }) })
  const admissionsQuery = useQuery({
    queryKey: ['ipd', 'admissions', 'list', status],
    queryFn: () =>
      listAdmissions({ limit: 100, status: status === 'all' ? undefined : (status as AdmissionStatus) }),
  })
  const admissions = admissionsQuery.data?.data ?? []

  return (
    <div className="space-y-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Admissions</h1>
          <p className="text-sm text-muted-foreground">In-patient admission queue.</p>
        </div>
        {canCreate && (
          <Button onClick={() => setWizardOpen(true)}>
            <Plus className="h-4 w-4" />
            Admit patient
          </Button>
        )}
      </div>

      <Select value={status} onValueChange={setStatus}>
        <SelectTrigger className="w-56">
          <SelectValue placeholder="Filter by status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          {Object.values(AdmissionStatus).map((s) => (
            <SelectItem key={s} value={s}>
              {formatEnumLabel(s)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Admission #</TableHead>
              <TableHead>Patient</TableHead>
              <TableHead>Attending doctor</TableHead>
              <TableHead>Ward / Bed</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Admitted</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {admissionsQuery.isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                </TableCell>
              </TableRow>
            ) : admissions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  No admissions yet.
                </TableCell>
              </TableRow>
            ) : (
              admissions.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>
                    <Link href={`/dashboard/ipd/${a.id}`} className="font-mono text-xs text-primary hover:underline">
                      {a.admissionNumber}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm">
                    {a.patient.fullName}
                    <span className="ml-1 font-mono text-xs text-muted-foreground">{a.patient.uhid}</span>
                  </TableCell>
                  <TableCell className="text-sm">{a.attendingDoctor.fullName}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {a.ward.name}
                    {a.bed ? ` · Bed ${a.bed.bedNumber}` : ' · Unassigned'}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{formatEnumLabel(a.type)}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(a.admittedAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                  </TableCell>
                  <TableCell>
                    <Badge variant={ADMISSION_STATUS_BADGE[a.status]}>{formatEnumLabel(a.status)}</Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <AdmitPatientWizard open={wizardOpen} onOpenChange={setWizardOpen} wards={wardsQuery.data?.data ?? []} />
    </div>
  )
}

const WIZARD_STEPS = ['Patient & Type', 'Care Team', 'Ward / Bed', 'Details', 'Review'] as const

function AdmitPatientWizard({
  open,
  onOpenChange,
  wards,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  wards: Array<{ id: string; name: string; code: string }>
}) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const router = useRouter()

  const [step, setStep] = useState(0)
  const [patient, setPatient] = useState<Patient | null>(null)
  const [type, setType] = useState<AdmissionType>(AdmissionType.SCHEDULED)
  const [attendingDoctorId, setAttendingDoctorId] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [wardId, setWardId] = useState('')
  const [roomId, setRoomId] = useState('')
  const [bedId, setBedId] = useState('')
  const [patientInsuranceId, setPatientInsuranceId] = useState('')
  const [admissionReason, setAdmissionReason] = useState('')
  const [diagnosis, setDiagnosis] = useState('')
  const [expectedDischargeAt, setExpectedDischargeAt] = useState('')

  function reset() {
    setStep(0)
    setPatient(null)
    setType(AdmissionType.SCHEDULED)
    setAttendingDoctorId('')
    setDepartmentId('')
    setWardId('')
    setRoomId('')
    setBedId('')
    setPatientInsuranceId('')
    setAdmissionReason('')
    setDiagnosis('')
    setExpectedDischargeAt('')
  }

  const doctorsQuery = useQuery({ queryKey: ['doctors', 'list', 'all'], queryFn: () => listDoctors({ limit: 100 }) })
  const departmentsQuery = useQuery({ queryKey: ['departments', 'list'], queryFn: () => listDepartments() })
  const roomsQuery = useQuery({
    queryKey: ['ipd', 'rooms', 'list', wardId],
    queryFn: () => listRooms({ limit: 100, wardId }),
    enabled: Boolean(wardId),
  })
  const bedsQuery = useQuery({
    queryKey: ['ipd', 'beds', 'available', roomId],
    queryFn: () => listBeds({ limit: 100, roomId, status: 'AVAILABLE' as never }),
    enabled: Boolean(roomId),
  })
  const coveragesQuery = useQuery({
    queryKey: ['insurance', 'patient-coverages', patient?.id],
    queryFn: () => listPatientCoverages(patient!.id),
    enabled: Boolean(patient?.id) && type === AdmissionType.INSURANCE,
  })

  const mutation = useMutation({
    mutationFn: () =>
      createAdmission({
        patientId: patient!.id,
        attendingDoctorId,
        departmentId: departmentId || undefined,
        wardId,
        roomId: roomId || undefined,
        bedId: bedId || undefined,
        patientInsuranceId: patientInsuranceId || undefined,
        type,
        admissionReason,
        diagnosis: diagnosis || undefined,
        expectedDischargeAt: expectedDischargeAt ? new Date(expectedDischargeAt) : undefined,
      }),
    onSuccess: (created) => {
      void queryClient.invalidateQueries({ queryKey: ['ipd', 'admissions', 'list'] })
      void queryClient.invalidateQueries({ queryKey: ['ipd', 'beds', 'list'] })
      void queryClient.invalidateQueries({ queryKey: ['ipd', 'wards', 'list'] })
      void queryClient.invalidateQueries({ queryKey: ['ipd', 'dashboard-stats'] })
      toast({ title: `Admitted — ${created.admissionNumber}` })
      onOpenChange(false)
      reset()
      router.push(`/dashboard/ipd/${created.id}`)
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Could not admit patient', description: getErrorMessage(error) }),
  })

  const canProceed = [
    Boolean(patient) && Boolean(type),
    Boolean(attendingDoctorId),
    Boolean(wardId),
    Boolean(admissionReason.trim()),
    true,
  ][step]

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next)
        if (!next) reset()
      }}
    >
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Admit patient</DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-1.5 pb-2">
          {WIZARD_STEPS.map((label, i) => (
            <div key={label} className="flex flex-1 items-center gap-1.5">
              <div
                className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-medium ${
                  i <= step ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                }`}
              >
                {i + 1}
              </div>
              {i < WIZARD_STEPS.length - 1 && (
                <div className={`h-px flex-1 ${i < step ? 'bg-primary' : 'bg-border'}`} />
              )}
            </div>
          ))}
        </div>
        <p className="text-xs font-medium text-muted-foreground">{WIZARD_STEPS[step]}</p>

        <div className="space-y-3">
          {step === 0 && (
            <>
              <PatientPicker selected={patient} onSelect={setPatient} />
              <Select value={type} onValueChange={(v) => setType(v as AdmissionType)}>
                <SelectTrigger>
                  <SelectValue placeholder="Admission type" />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(AdmissionType).map((t) => (
                    <SelectItem key={t} value={t}>
                      {formatEnumLabel(t)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          )}

          {step === 1 && (
            <>
              <Select value={attendingDoctorId} onValueChange={setAttendingDoctorId}>
                <SelectTrigger>
                  <SelectValue placeholder="Attending doctor" />
                </SelectTrigger>
                <SelectContent>
                  {doctorsQuery.data?.data.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.fullName} — {d.specialization}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={departmentId} onValueChange={setDepartmentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Department (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {departmentsQuery.data?.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {type === AdmissionType.INSURANCE && (
                <Select value={patientInsuranceId} onValueChange={setPatientInsuranceId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Insurance coverage" />
                  </SelectTrigger>
                  <SelectContent>
                    {coveragesQuery.data?.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.provider.name} · {c.plan.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </>
          )}

          {step === 2 && (
            <>
              <Select
                value={wardId}
                onValueChange={(v) => {
                  setWardId(v)
                  setRoomId('')
                  setBedId('')
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Ward" />
                </SelectTrigger>
                <SelectContent>
                  {wards.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.name} ({w.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={roomId}
                onValueChange={(v) => {
                  setRoomId(v)
                  setBedId('')
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Room (optional — can allocate later)" />
                </SelectTrigger>
                <SelectContent>
                  {roomsQuery.data?.data.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.roomNumber}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={bedId} onValueChange={setBedId}>
                <SelectTrigger>
                  <SelectValue placeholder="Bed (optional — can allocate later)" />
                </SelectTrigger>
                <SelectContent>
                  {bedsQuery.data?.data.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.bedNumber}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          )}

          {step === 3 && (
            <>
              <Textarea
                placeholder="Admission reason"
                value={admissionReason}
                onChange={(e) => setAdmissionReason(e.target.value)}
              />
              <Input placeholder="Diagnosis (optional)" value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} />
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Expected discharge (optional)</label>
                <Input type="date" value={expectedDischargeAt} onChange={(e) => setExpectedDischargeAt(e.target.value)} />
              </div>
            </>
          )}

          {step === 4 && (
            <div className="space-y-1.5 rounded-md border bg-muted/40 p-3 text-sm">
              <p>
                <span className="text-muted-foreground">Patient:</span> {patient?.fullName}
              </p>
              <p>
                <span className="text-muted-foreground">Type:</span> {formatEnumLabel(type)}
              </p>
              <p>
                <span className="text-muted-foreground">Doctor:</span>{' '}
                {doctorsQuery.data?.data.find((d) => d.id === attendingDoctorId)?.fullName}
              </p>
              <p>
                <span className="text-muted-foreground">Ward:</span> {wards.find((w) => w.id === wardId)?.name}
                {bedId ? ` · Bed ${bedsQuery.data?.data.find((b) => b.id === bedId)?.bedNumber}` : ' · Bed to be allocated later'}
              </p>
              <p>
                <span className="text-muted-foreground">Reason:</span> {admissionReason}
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          {step > 0 && (
            <Button variant="outline" onClick={() => setStep((s) => s - 1)} disabled={mutation.isPending}>
              Back
            </Button>
          )}
          {step < WIZARD_STEPS.length - 1 ? (
            <Button onClick={() => setStep((s) => s + 1)} disabled={!canProceed}>
              Next
            </Button>
          ) : (
            <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Admit patient
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function PatientPicker({ selected, onSelect }: { selected: Patient | null; onSelect: (patient: Patient | null) => void }) {
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
