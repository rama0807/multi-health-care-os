'use client'

import {
  DiagnosisType,
  EncounterAttachmentType,
  EncounterStatus,
  LabTestStatus,
  MedicationRoute,
  Priority,
  PrescriptionStatus,
  type CreateClinicalNoteDto,
  type CreatePrescriptionItemDto,
  type LabTestCatalogItem,
  type RadiologyCatalogItem,
} from '@medicore/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Activity,
  AlertTriangle,
  Check,
  ClipboardList,
  Download,
  FileText,
  FlaskConical,
  History,
  Loader2,
  Pill,
  Plus,
  Scan,
  TestTube,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { AiAssistButton } from '@/components/ai/ai-assist-button'
import { PageLayout } from '@/components/layout/page-layout'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { PageHeaderMeta } from '@/components/ui/page-header'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { StatusBadge } from '@/components/ui/status-badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import {
  createInsuranceClaim,
  createPreAuthorization,
  listInsuranceClaims,
  listPatientCoverages,
  listPreAuthorizations,
} from '@/lib/api/insurance'
import {
  collectLabSample,
  createLabOrder,
  downloadLabReportPdf,
  enterLabResults,
  listLabCatalog,
  listLabOrders,
  updateLabTestStatus,
  uploadLabReportFile,
} from '@/lib/api/laboratory'
import {
  createClinicalNoteVersion,
  createDiagnosis,
  createProcedure,
  deleteEncounterAttachment,
  getCurrentClinicalNote,
  getEncounter,
  listClinicalNotes,
  listDiagnoses,
  listEncounterAttachments,
  listEncounterVitals,
  listPatientVitals,
  listProcedures,
  recordVital,
  updateEncounterStatus,
  uploadEncounterAttachment,
} from '@/lib/api/medical-records'
import { createDispenseOrder } from '@/lib/api/pharmacy'
import {
  createPrescription,
  downloadPrescriptionPdf,
  listPrescriptions,
  updatePrescriptionStatus,
} from '@/lib/api/prescriptions'
import { createRadiologyOrder, listRadiologyCatalog, listRadiologyOrders } from '@/lib/api/radiology'
import { useAuth } from '@/lib/auth/auth-context'

function getErrorMessage(error: unknown): string {
  const axiosError = error as { response?: { data?: { error?: { message?: string } } } }
  return axiosError?.response?.data?.error?.message ?? 'Something went wrong. Please try again.'
}

function formatEnumLabel(value: string): string {
  return value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, ' ')
}

const FORWARD_TRANSITION: Partial<Record<EncounterStatus, EncounterStatus>> = {
  [EncounterStatus.IN_PROGRESS]: EncounterStatus.COMPLETED,
  [EncounterStatus.COMPLETED]: EncounterStatus.AMENDED,
  [EncounterStatus.AMENDED]: EncounterStatus.COMPLETED,
}

export default function EncounterDetailPage() {
  const params = useParams<{ encounterId: string }>()
  const encounterId = params.encounterId
  const { hasPermission } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const canUpdate = hasPermission('medical_records.update')
  const canPrescribe = hasPermission('prescriptions.create')
  const canOrderLab = hasPermission('laboratory.create')
  const canUpdateLab = hasPermission('laboratory.update')
  const canOrderRadiology = hasPermission('radiology.create')
  const canDispense = hasPermission('pharmacy.create')
  const canRequestPreAuth = hasPermission('insurance.preauth.create')

  const encounterQuery = useQuery({
    queryKey: ['encounters', 'detail', encounterId],
    queryFn: () => getEncounter(encounterId),
  })

  const statusMutation = useMutation({
    mutationFn: (status: EncounterStatus) => updateEncounterStatus(encounterId, { status }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['encounters', 'detail', encounterId] })
      toast({ title: 'Encounter updated' })
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Update failed', description: getErrorMessage(error) })
    },
  })

  if (encounterQuery.isLoading) {
    return (
      <PageLayout
        breadcrumbs={[{ label: 'Medical Records', href: '/dashboard/medical-records' }, { label: '…' }]}
        title="…"
        loading
      >
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </PageLayout>
    )
  }

  if (encounterQuery.isError || !encounterQuery.data) {
    return (
      <PageLayout
        breadcrumbs={[{ label: 'Medical Records', href: '/dashboard/medical-records' }, { label: 'Not found' }]}
        title="Encounter not found"
      >
        <EmptyState
          variant="error"
          title="Encounter not found"
          description={getErrorMessage(encounterQuery.error)}
          action={{ label: 'Back to medical records', href: '/dashboard/medical-records' }}
        />
      </PageLayout>
    )
  }

  const encounter = encounterQuery.data
  const forward = FORWARD_TRANSITION[encounter.status]

  return (
    <Tabs defaultValue="subjective">
      <PageLayout
        breadcrumbs={[
          { label: 'Medical Records', href: '/dashboard/medical-records' },
          { label: encounter.patient.fullName },
        ]}
        title={encounter.patient.fullName}
        badge={
          <>
            <StatusBadge status={encounter.status} />
            <Badge variant="outline">{formatEnumLabel(encounter.type)}</Badge>
          </>
        }
        meta={
          <>
            <PageHeaderMeta label="UHID">{encounter.patient.uhid}</PageHeaderMeta>
            <PageHeaderMeta label="Doctor">
              Dr. {encounter.doctor.fullName} ({encounter.doctor.specialization})
            </PageHeaderMeta>
            <PageHeaderMeta label="Date">
              {new Date(encounter.encounterDate).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
            </PageHeaderMeta>
          </>
        }
        actions={
          <>
            {/* Drafts only - the dialog hands text back for review, it never writes to the chart. */}
            <AiAssistButton feature="SOAP_NOTE" contextRefs={{ encounterId }} label="AI SOAP note" />
            <AiAssistButton
              feature="CLINICAL_NOTE_SUMMARY"
              contextRefs={{ encounterId }}
              label="AI summary"
              variant="ghost"
            />
            {canUpdate && forward && (
              <Button
                size="sm"
                onClick={() => statusMutation.mutate(forward)}
                disabled={statusMutation.isPending}
              >
                {statusMutation.isPending ? <Loader2 className="animate-spin" /> : <Check />}
                Mark {formatEnumLabel(forward)}
              </Button>
            )}
          </>
        }
        toolbar={
          <TabsList className="flex-wrap">
            <TabsTrigger value="subjective">Subjective</TabsTrigger>
            <TabsTrigger value="objective">Objective</TabsTrigger>
            <TabsTrigger value="assessment">Assessment</TabsTrigger>
            <TabsTrigger value="plan">Plan</TabsTrigger>
            <TabsTrigger value="prescriptions">Prescriptions</TabsTrigger>
            <TabsTrigger value="lab-orders">Lab Orders</TabsTrigger>
            <TabsTrigger value="radiology">Radiology</TabsTrigger>
            <TabsTrigger value="attachments">Attachments</TabsTrigger>
            <TabsTrigger value="insurance">Insurance</TabsTrigger>
          </TabsList>
        }
      >
        <TabsContent value="subjective">
          <ClinicalNotesTab encounterId={encounterId} canUpdate={canUpdate} />
        </TabsContent>
        <TabsContent value="objective">
          <VitalsTab encounterId={encounterId} patientId={encounter.patientId} canUpdate={canUpdate} />
        </TabsContent>
        <TabsContent value="assessment">
          <DiagnosesTab encounterId={encounterId} canUpdate={canUpdate} />
        </TabsContent>
        <TabsContent value="plan">
          <PlanTab encounterId={encounterId} canUpdate={canUpdate} notes={encounter.notes} />
        </TabsContent>
        <TabsContent value="prescriptions">
          <PrescriptionsTab encounterId={encounterId} canPrescribe={canPrescribe} canUpdate={canUpdate} canDispense={canDispense} />
        </TabsContent>
        <TabsContent value="lab-orders">
          <LabOrdersTab encounterId={encounterId} canOrder={canOrderLab} canUpdate={canUpdateLab} />
        </TabsContent>
        <TabsContent value="radiology">
          <RadiologyTab encounterId={encounterId} canOrder={canOrderRadiology} />
        </TabsContent>
        <TabsContent value="attachments">
          <AttachmentsTab encounterId={encounterId} canUpdate={canUpdate} />
        </TabsContent>
        <TabsContent value="insurance">
          <EncounterInsuranceTab encounterId={encounterId} patientId={encounter.patientId} canCreate={canRequestPreAuth} />
        </TabsContent>
      </PageLayout>
    </Tabs>
  )
}

const NOTE_FIELDS: Array<{ key: keyof CreateClinicalNoteDto; label: string }> = [
  { key: 'chiefComplaint', label: 'Chief Complaint' },
  { key: 'historyOfPresentIllness', label: 'History of Present Illness' },
  { key: 'pastMedicalHistory', label: 'Past Medical History' },
  { key: 'familyHistory', label: 'Family History' },
  { key: 'surgicalHistory', label: 'Surgical History' },
  { key: 'socialHistory', label: 'Social History' },
  { key: 'allergies', label: 'Allergies' },
  { key: 'currentMedications', label: 'Current Medications' },
]

function ClinicalNotesTab({ encounterId, canUpdate }: { encounterId: string; canUpdate: boolean }) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [form, setForm] = useState<CreateClinicalNoteDto>({})
  const [showHistory, setShowHistory] = useState(false)
  const [saveState, setSaveState] = useState<'idle' | 'pending' | 'saved'>('idle')
  const hydrated = useRef(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const currentQuery = useQuery({
    queryKey: ['clinical-notes', 'current', encounterId],
    queryFn: () => getCurrentClinicalNote(encounterId),
  })
  const historyQuery = useQuery({
    queryKey: ['clinical-notes', 'history', encounterId],
    queryFn: () => listClinicalNotes(encounterId),
    enabled: showHistory,
  })

  const saveMutation = useMutation({
    mutationFn: (dto: CreateClinicalNoteDto) => createClinicalNoteVersion(encounterId, dto),
    onSuccess: () => {
      setSaveState('saved')
      void queryClient.invalidateQueries({ queryKey: ['clinical-notes', 'current', encounterId] })
      void queryClient.invalidateQueries({ queryKey: ['clinical-notes', 'history', encounterId] })
    },
    onError: (error) => {
      setSaveState('idle')
      toast({ variant: 'destructive', title: 'Autosave failed', description: getErrorMessage(error) })
    },
  })

  useEffect(() => {
    if (currentQuery.data && !hydrated.current) {
      setForm({
        chiefComplaint: currentQuery.data.chiefComplaint ?? undefined,
        historyOfPresentIllness: currentQuery.data.historyOfPresentIllness ?? undefined,
        pastMedicalHistory: currentQuery.data.pastMedicalHistory ?? undefined,
        familyHistory: currentQuery.data.familyHistory ?? undefined,
        surgicalHistory: currentQuery.data.surgicalHistory ?? undefined,
        socialHistory: currentQuery.data.socialHistory ?? undefined,
        allergies: currentQuery.data.allergies ?? undefined,
        currentMedications: currentQuery.data.currentMedications ?? undefined,
      })
      hydrated.current = true
    }
  }, [currentQuery.data])

  function updateField(key: keyof CreateClinicalNoteDto, value: string) {
    const next = { ...form, [key]: value }
    setForm(next)
    setSaveState('pending')
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      saveMutation.mutate(next)
    }, 2000)
  }

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  if (currentQuery.isLoading) {
    return (
      <div className="flex h-24 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-lg border bg-card p-3">
        <p className="text-xs text-muted-foreground">
          {saveState === 'pending' && (
            <>
              <Loader2 className="mr-1 inline h-3 w-3 animate-spin" /> Saving...
            </>
          )}
          {saveState === 'saved' && (
            <>
              <Check className="mr-1 inline h-3 w-3 text-success" /> Saved as new version
            </>
          )}
          {saveState === 'idle' && !currentQuery.data && 'No notes yet - start typing to create version 1.'}
          {saveState === 'idle' && currentQuery.data && `Current version: v${currentQuery.data.version}`}
        </p>
        <Button variant="outline" size="sm" onClick={() => setShowHistory(true)}>
          <History className="h-3.5 w-3.5" />
          Version history
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 rounded-lg border bg-card p-4 sm:grid-cols-2">
        {NOTE_FIELDS.map(({ key, label }) => (
          <div key={key} className="space-y-1.5">
            <label className="text-sm font-medium">{label}</label>
            <Textarea
              rows={key === 'chiefComplaint' || key === 'allergies' ? 2 : 3}
              value={(form[key] as string) ?? ''}
              disabled={!canUpdate}
              onChange={(e) => updateField(key, e.target.value)}
            />
          </div>
        ))}
      </div>

      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Clinical note version history</DialogTitle>
            <DialogDescription>
              Every save creates a new version - nothing is ever overwritten.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {historyQuery.isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : (
              historyQuery.data?.map((note) => (
                <div key={note.id} className="rounded-md border p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-semibold">Version {note.version}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(note.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                    </span>
                  </div>
                  <dl className="grid grid-cols-2 gap-2 text-xs">
                    {NOTE_FIELDS.filter(({ key }) => note[key]).map(({ key, label }) => (
                      <div key={key}>
                        <dt className="text-muted-foreground">{label}</dt>
                        <dd>{note[key]}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function VitalsTab({
  encounterId,
  patientId,
  canUpdate,
}: {
  encounterId: string
  patientId: string
  canUpdate: boolean
}) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [heightCm, setHeightCm] = useState('')
  const [weightKg, setWeightKg] = useState('')
  const [systolic, setSystolic] = useState('')
  const [diastolic, setDiastolic] = useState('')
  const [pulse, setPulse] = useState('')
  const [temperature, setTemperature] = useState('')
  const [respiratoryRate, setRespiratoryRate] = useState('')
  const [spo2, setSpo2] = useState('')

  const vitalsQuery = useQuery({
    queryKey: ['vitals', 'encounter', encounterId],
    queryFn: () => listEncounterVitals(encounterId),
  })
  const trendQuery = useQuery({
    queryKey: ['vitals', 'patient', patientId],
    queryFn: () => listPatientVitals(patientId),
  })

  const recordMutation = useMutation({
    mutationFn: () =>
      recordVital(encounterId, {
        heightCm: heightCm ? Number(heightCm) : undefined,
        weightKg: weightKg ? Number(weightKg) : undefined,
        bloodPressureSystolic: systolic ? Number(systolic) : undefined,
        bloodPressureDiastolic: diastolic ? Number(diastolic) : undefined,
        pulse: pulse ? Number(pulse) : undefined,
        temperatureCelsius: temperature ? Number(temperature) : undefined,
        respiratoryRate: respiratoryRate ? Number(respiratoryRate) : undefined,
        spo2: spo2 ? Number(spo2) : undefined,
      }),
    onSuccess: () => {
      toast({ title: 'Vitals recorded' })
      void queryClient.invalidateQueries({ queryKey: ['vitals', 'encounter', encounterId] })
      void queryClient.invalidateQueries({ queryKey: ['vitals', 'patient', patientId] })
      setHeightCm('')
      setWeightKg('')
      setSystolic('')
      setDiastolic('')
      setPulse('')
      setTemperature('')
      setRespiratoryRate('')
      setSpo2('')
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Could not record vitals', description: getErrorMessage(error) })
    },
  })

  const bmiPreview =
    heightCm && weightKg
      ? (Number(weightKg) / (Number(heightCm) / 100) ** 2).toFixed(1)
      : null

  const bmiSeries = (trendQuery.data ?? [])
    .filter((v) => v.bmi != null)
    .map((v) => ({ date: new Date(v.recordedAt).toLocaleDateString('en-IN', { dateStyle: 'short' }), bmi: v.bmi }))

  return (
    <div className="space-y-4">
      {canUpdate && (
        <div className="rounded-lg border bg-card p-4">
          <h3 className="mb-3 text-sm font-semibold text-foreground">Record vitals</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label="Height (cm)" value={heightCm} onChange={setHeightCm} />
            <Field label="Weight (kg)" value={weightKg} onChange={setWeightKg} />
            <Field label="BP systolic" value={systolic} onChange={setSystolic} />
            <Field label="BP diastolic" value={diastolic} onChange={setDiastolic} />
            <Field label="Pulse" value={pulse} onChange={setPulse} />
            <Field label="Temp (°C)" value={temperature} onChange={setTemperature} />
            <Field label="Resp. rate" value={respiratoryRate} onChange={setRespiratoryRate} />
            <Field label="SpO2 (%)" value={spo2} onChange={setSpo2} />
          </div>
          <div className="mt-3 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">{bmiPreview ? `BMI preview: ${bmiPreview}` : ''}</p>
            <Button size="sm" onClick={() => recordMutation.mutate()} disabled={recordMutation.isPending}>
              {recordMutation.isPending && <Loader2 className="animate-spin" />}
              Save vitals
            </Button>
          </div>
        </div>
      )}

      {bmiSeries.length > 1 && (
        <div className="rounded-lg border bg-card p-4">
          <h3 className="mb-3 text-sm font-semibold text-foreground">BMI trend (across all encounters)</h3>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={bmiSeries}>
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} width={32} />
                <RechartsTooltip />
                <Line type="monotone" dataKey="bmi" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="rounded-lg border bg-card">
        <div className="border-b p-3">
          <h3 className="text-sm font-semibold text-foreground">History (this encounter)</h3>
        </div>
        {vitalsQuery.isLoading ? (
          <div className="flex h-16 items-center justify-center">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : vitalsQuery.data?.length ? (
          <ul className="divide-y">
            {vitalsQuery.data.map((v) => (
              <li key={v.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
                <Activity className="h-4 w-4 text-muted-foreground" />
                {v.bmi != null && <span>BMI {v.bmi}</span>}
                {v.bloodPressureSystolic != null && (
                  <span>
                    BP {v.bloodPressureSystolic}/{v.bloodPressureDiastolic}
                  </span>
                )}
                {v.pulse != null && <span>Pulse {v.pulse}</span>}
                {v.temperatureCelsius != null && <span>{v.temperatureCelsius}°C</span>}
                {v.spo2 != null && <span>SpO2 {v.spo2}%</span>}
                <span className="ml-auto text-xs text-muted-foreground">
                  {new Date(v.recordedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="p-4 text-sm text-muted-foreground">No vitals recorded yet.</p>
        )}
      </div>
    </div>
  )
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <Input type="number" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  )
}

function DiagnosesTab({ encounterId, canUpdate }: { encounterId: string; canUpdate: boolean }) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [type, setType] = useState<string>(DiagnosisType.PRIMARY)
  const [description, setDescription] = useState('')
  const [icdCode, setIcdCode] = useState('')

  const diagnosesQuery = useQuery({
    queryKey: ['diagnoses', encounterId],
    queryFn: () => listDiagnoses(encounterId),
  })

  const createMutation = useMutation({
    mutationFn: () =>
      createDiagnosis(encounterId, {
        type: type as DiagnosisType,
        description,
        icdCode: icdCode || undefined,
      }),
    onSuccess: () => {
      toast({ title: 'Diagnosis added' })
      void queryClient.invalidateQueries({ queryKey: ['diagnoses', encounterId] })
      setDescription('')
      setIcdCode('')
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Could not add diagnosis', description: getErrorMessage(error) })
    },
  })

  return (
    <div className="space-y-4">
      {canUpdate && (
        <div className="flex flex-col gap-3 rounded-lg border bg-card p-4 sm:flex-row sm:items-end">
          <div className="space-y-1.5 sm:w-40">
            <label className="text-sm font-medium">Type</label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.values(DiagnosisType).map((t) => (
                  <SelectItem key={t} value={t}>
                    {formatEnumLabel(t)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 space-y-1.5">
            <label className="text-sm font-medium">Description</label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="space-y-1.5 sm:w-32">
            <label className="text-sm font-medium">ICD-10 (placeholder)</label>
            <Input value={icdCode} onChange={(e) => setIcdCode(e.target.value)} placeholder="e.g. J06.9" />
          </div>
          <Button onClick={() => createMutation.mutate()} disabled={!description || createMutation.isPending}>
            {createMutation.isPending && <Loader2 className="animate-spin" />}
            Add
          </Button>
        </div>
      )}

      <div className="rounded-lg border bg-card">
        {diagnosesQuery.isLoading ? (
          <div className="flex h-16 items-center justify-center">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : diagnosesQuery.data?.length ? (
          <ul className="divide-y">
            {diagnosesQuery.data.map((d) => (
              <li key={d.id} className="flex items-center gap-3 p-3">
                <Badge
                  variant={
                    d.type === DiagnosisType.PRIMARY
                      ? 'success'
                      : d.type === DiagnosisType.SECONDARY
                        ? 'secondary'
                        : 'outline'
                  }
                >
                  {formatEnumLabel(d.type)}
                </Badge>
                <span className="text-sm">{d.description}</span>
                {d.icdCode && <span className="font-mono text-xs text-muted-foreground">{d.icdCode}</span>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="p-4 text-sm text-muted-foreground">No diagnoses recorded yet.</p>
        )}
      </div>
    </div>
  )
}

function PlanTab({
  encounterId,
  canUpdate,
  notes,
}: {
  encounterId: string
  canUpdate: boolean
  notes: string | null
}) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [procNotes, setProcNotes] = useState('')

  const proceduresQuery = useQuery({
    queryKey: ['procedures', encounterId],
    queryFn: () => listProcedures(encounterId),
  })

  const createMutation = useMutation({
    mutationFn: () => createProcedure(encounterId, { name, notes: procNotes || undefined }),
    onSuccess: () => {
      toast({ title: 'Procedure added' })
      void queryClient.invalidateQueries({ queryKey: ['procedures', encounterId] })
      setName('')
      setProcNotes('')
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Could not add procedure', description: getErrorMessage(error) })
    },
  })

  return (
    <div className="space-y-4">
      {notes && (
        <div className="rounded-lg border bg-card p-4">
          <h3 className="mb-1 text-sm font-semibold text-foreground">Encounter notes / follow-up</h3>
          <p className="text-sm text-muted-foreground">{notes}</p>
        </div>
      )}

      {canUpdate && (
        <div className="flex flex-col gap-3 rounded-lg border bg-card p-4 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1.5">
            <label className="text-sm font-medium">Procedure</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. IV cannulation" />
          </div>
          <div className="flex-1 space-y-1.5">
            <label className="text-sm font-medium">Notes (optional)</label>
            <Input value={procNotes} onChange={(e) => setProcNotes(e.target.value)} />
          </div>
          <Button onClick={() => createMutation.mutate()} disabled={!name || createMutation.isPending}>
            {createMutation.isPending && <Loader2 className="animate-spin" />}
            Add
          </Button>
        </div>
      )}

      <div className="rounded-lg border bg-card">
        <div className="border-b p-3">
          <h3 className="text-sm font-semibold text-foreground">Procedures performed</h3>
        </div>
        {proceduresQuery.isLoading ? (
          <div className="flex h-16 items-center justify-center">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : proceduresQuery.data?.length ? (
          <ul className="divide-y">
            {proceduresQuery.data.map((p) => (
              <li key={p.id} className="flex items-start gap-3 p-3">
                <ClipboardList className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{p.name}</p>
                  {p.notes && <p className="text-xs text-muted-foreground">{p.notes}</p>}
                  <p className="text-xs text-muted-foreground">
                    {new Date(p.performedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="p-4 text-sm text-muted-foreground">No procedures recorded yet.</p>
        )}
      </div>
    </div>
  )
}

function AttachmentsTab({ encounterId, canUpdate }: { encounterId: string; canUpdate: boolean }) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [documentType, setDocumentType] = useState<string>(EncounterAttachmentType.OTHER)
  const [file, setFile] = useState<File | null>(null)

  const attachmentsQuery = useQuery({
    queryKey: ['encounter-attachments', encounterId],
    queryFn: () => listEncounterAttachments(encounterId),
  })

  const uploadMutation = useMutation({
    mutationFn: () => {
      if (!file) throw new Error('Choose a file first')
      return uploadEncounterAttachment(encounterId, file, documentType as EncounterAttachmentType)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['encounter-attachments', encounterId] })
      toast({ title: 'Attachment uploaded' })
      setFile(null)
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Upload failed', description: getErrorMessage(error) })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (attachmentId: string) => deleteEncounterAttachment(encounterId, attachmentId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['encounter-attachments', encounterId] })
      toast({ title: 'Attachment deleted' })
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Delete failed', description: getErrorMessage(error) })
    },
  })

  return (
    <div className="space-y-4">
      {canUpdate && (
        <div className="flex flex-col gap-3 rounded-lg border bg-card p-4 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1.5">
            <label className="text-sm font-medium">Document type</label>
            <Select value={documentType} onValueChange={setDocumentType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.values(EncounterAttachmentType).map((dt) => (
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
        {attachmentsQuery.isLoading ? (
          <div className="flex h-24 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : attachmentsQuery.data?.length ? (
          <ul className="divide-y">
            {attachmentsQuery.data.map((doc) => (
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
                {canUpdate && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() => deleteMutation.mutate(doc.id)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                    <span className="sr-only">Delete</span>
                  </Button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="p-4 text-sm text-muted-foreground">No attachments uploaded yet.</p>
        )}
      </div>
    </div>
  )
}

function EncounterInsuranceTab({
  encounterId,
  patientId,
  canCreate,
}: {
  encounterId: string
  patientId: string
  canCreate: boolean
}) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [preAuthDialogOpen, setPreAuthDialogOpen] = useState(false)
  const [claimDialogOpen, setClaimDialogOpen] = useState(false)

  const coveragesQuery = useQuery({
    queryKey: ['insurance', 'patient-coverages', patientId],
    queryFn: () => listPatientCoverages(patientId),
  })
  const preAuthQuery = useQuery({
    queryKey: ['insurance', 'preauth', 'list', 'encounter', encounterId],
    queryFn: () => listPreAuthorizations({ encounterId, limit: 50 }),
  })
  const claimsQuery = useQuery({
    queryKey: ['insurance', 'claims', 'list', 'encounter', encounterId],
    queryFn: () => listInsuranceClaims({ encounterId, limit: 50 }),
  })

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ['insurance', 'preauth', 'list', 'encounter', encounterId] })
    void queryClient.invalidateQueries({ queryKey: ['insurance', 'claims', 'list', 'encounter', encounterId] })
  }

  const preAuths = preAuthQuery.data?.data ?? []
  const claims = claimsQuery.data?.data ?? []
  const coverages = coveragesQuery.data ?? []

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card">
        <div className="flex items-center justify-between border-b p-3">
          <h3 className="text-sm font-semibold text-foreground">Pre-Authorizations</h3>
          {canCreate && coverages.length > 0 && (
            <Button size="sm" variant="outline" onClick={() => setPreAuthDialogOpen(true)}>
              <Plus className="h-3.5 w-3.5" />
              Request pre-auth
            </Button>
          )}
        </div>
        {preAuths.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">
            {coverages.length === 0 ? 'This patient has no insurance coverage on file yet.' : 'No pre-authorizations for this encounter.'}
          </p>
        ) : (
          <ul className="divide-y">
            {preAuths.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                <span className="font-mono text-xs text-muted-foreground">{p.authNumber}</span>
                <span>₹{p.requestedAmount}</span>
                <StatusBadge status={p.status} />
                <Link href="/dashboard/insurance/preauth" className="text-xs text-primary hover:underline">
                  View queue
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-lg border bg-card">
        <div className="flex items-center justify-between border-b p-3">
          <h3 className="text-sm font-semibold text-foreground">Insurance Claims</h3>
          {canCreate && coverages.length > 0 && (
            <Button size="sm" variant="outline" onClick={() => setClaimDialogOpen(true)}>
              <Plus className="h-3.5 w-3.5" />
              File claim
            </Button>
          )}
        </div>
        {claims.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">
            {coverages.length === 0 ? 'This patient has no insurance coverage on file yet.' : 'No insurance claims for this encounter.'}
          </p>
        ) : (
          <ul className="divide-y">
            {claims.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                <Link href={`/dashboard/insurance/${c.id}`} className="font-mono text-xs hover:underline">
                  {c.claimNumber}
                </Link>
                <span>₹{c.claimedAmount}</span>
                <StatusBadge status={c.status} />
              </li>
            ))}
          </ul>
        )}
      </div>

      <RequestPreAuthDialog
        open={preAuthDialogOpen}
        onOpenChange={setPreAuthDialogOpen}
        encounterId={encounterId}
        coverages={coverages}
        onCreated={() => {
          invalidate()
          toast({ title: 'Pre-authorization requested' })
        }}
      />
      <FileClaimDialog
        open={claimDialogOpen}
        onOpenChange={setClaimDialogOpen}
        encounterId={encounterId}
        coverages={coverages}
        onCreated={() => {
          invalidate()
          toast({ title: 'Claim filed' })
        }}
      />
    </div>
  )
}

function RequestPreAuthDialog({
  open,
  onOpenChange,
  encounterId,
  coverages,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  encounterId: string
  coverages: Array<{ id: string; provider: { name: string } }>
  onCreated: () => void
}) {
  const { toast } = useToast()
  const [patientInsuranceId, setPatientInsuranceId] = useState('')
  const [requestedAmount, setRequestedAmount] = useState('')
  const [clinicalNotes, setClinicalNotes] = useState('')

  const mutation = useMutation({
    mutationFn: () =>
      createPreAuthorization({
        encounterId,
        patientInsuranceId,
        requestedAmount: Number(requestedAmount),
        clinicalNotes: clinicalNotes || undefined,
      }),
    onSuccess: () => {
      setRequestedAmount('')
      setClinicalNotes('')
      onOpenChange(false)
      onCreated()
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Could not request pre-authorization', description: getErrorMessage(error) }),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request pre-authorization</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Select value={patientInsuranceId} onValueChange={setPatientInsuranceId}>
            <SelectTrigger>
              <SelectValue placeholder="Coverage" />
            </SelectTrigger>
            <SelectContent>
              {coverages.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.provider.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="number"
            placeholder="Requested amount ₹"
            value={requestedAmount}
            onChange={(e) => setRequestedAmount(e.target.value)}
          />
          <Textarea placeholder="Clinical notes (optional)" value={clinicalNotes} onChange={(e) => setClinicalNotes(e.target.value)} />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={!patientInsuranceId || !requestedAmount || mutation.isPending}>
            {mutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Submit request
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function FileClaimDialog({
  open,
  onOpenChange,
  encounterId,
  coverages,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  encounterId: string
  coverages: Array<{ id: string; provider: { name: string } }>
  onCreated: () => void
}) {
  const { toast } = useToast()
  const [patientInsuranceId, setPatientInsuranceId] = useState('')
  const [invoiceId, setInvoiceId] = useState('')
  const [claimedAmount, setClaimedAmount] = useState('')

  const mutation = useMutation({
    mutationFn: () => createInsuranceClaim({ encounterId, patientInsuranceId, invoiceId, claimedAmount: Number(claimedAmount) }),
    onSuccess: () => {
      setInvoiceId('')
      setClaimedAmount('')
      onOpenChange(false)
      onCreated()
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Could not file claim', description: getErrorMessage(error) }),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>File insurance claim</DialogTitle>
          <DialogDescription>The invoice ID is available on this encounter&apos;s invoice in Billing.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Select value={patientInsuranceId} onValueChange={setPatientInsuranceId}>
            <SelectTrigger>
              <SelectValue placeholder="Coverage" />
            </SelectTrigger>
            <SelectContent>
              {coverages.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.provider.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input placeholder="Invoice ID" value={invoiceId} onChange={(e) => setInvoiceId(e.target.value)} />
          <Input type="number" placeholder="Claimed amount ₹" value={claimedAmount} onChange={(e) => setClaimedAmount(e.target.value)} />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={!patientInsuranceId || !invoiceId.trim() || !claimedAmount || mutation.isPending}
          >
            {mutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            File claim
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

interface ItemDraft {
  medicationName: string
  genericName: string
  strength: string
  dosage: string
  frequency: string
  duration: string
  route: MedicationRoute
  instructions: string
  quantity: string
}

function blankItemDraft(): ItemDraft {
  return {
    medicationName: '',
    genericName: '',
    strength: '',
    dosage: '',
    frequency: '',
    duration: '',
    route: MedicationRoute.ORAL,
    instructions: '',
    quantity: '1',
  }
}

function PrescriptionsTab({
  encounterId,
  canPrescribe,
  canUpdate,
  canDispense,
}: {
  encounterId: string
  canPrescribe: boolean
  canUpdate: boolean
  canDispense: boolean
}) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const router = useRouter()
  const [items, setItems] = useState<ItemDraft[]>([blankItemDraft()])
  const [notes, setNotes] = useState('')
  const [lastWarnings, setLastWarnings] = useState<
    Array<{ medicationA: string; medicationB: string; severity: 'moderate' | 'severe'; description: string }>
  >([])

  const prescriptionsQuery = useQuery({
    queryKey: ['prescriptions', 'encounter', encounterId],
    queryFn: () => listPrescriptions({ encounterId, limit: 50 }),
  })

  const createMutation = useMutation({
    mutationFn: () =>
      createPrescription({
        encounterId,
        notes: notes || undefined,
        items: items.map((item) => ({
          medicationName: item.medicationName,
          genericName: item.genericName || undefined,
          strength: item.strength || undefined,
          dosage: item.dosage,
          frequency: item.frequency,
          duration: item.duration,
          route: item.route,
          instructions: item.instructions || undefined,
          quantity: Number(item.quantity) || 1,
        })) as CreatePrescriptionItemDto[],
      }),
    onSuccess: (result) => {
      toast({ title: 'Prescription created' })
      setLastWarnings(result.warnings)
      setItems([blankItemDraft()])
      setNotes('')
      void queryClient.invalidateQueries({ queryKey: ['prescriptions', 'encounter', encounterId] })
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Could not create prescription', description: getErrorMessage(error) })
    },
  })

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: PrescriptionStatus }) => updatePrescriptionStatus(id, { status }),
    onSuccess: () => {
      toast({ title: 'Prescription updated' })
      void queryClient.invalidateQueries({ queryKey: ['prescriptions', 'encounter', encounterId] })
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Update failed', description: getErrorMessage(error) })
    },
  })

  const dispenseMutation = useMutation({
    mutationFn: (prescriptionId: string) => createDispenseOrder({ prescriptionId }),
    onSuccess: (order) => {
      toast({ title: 'Dispense order created' })
      router.push(`/dashboard/pharmacy/${order.id}`)
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Could not create dispense order', description: getErrorMessage(error) })
    },
  })

  function updateItem(index: number, patch: Partial<ItemDraft>) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)))
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  const canSubmit = items.every((item) => item.medicationName && item.dosage && item.frequency && item.duration)

  return (
    <div className="space-y-4">
      {canPrescribe && (
        <div className="space-y-3 rounded-lg border bg-card p-4">
          <h3 className="text-sm font-semibold text-foreground">New prescription</h3>
          {items.map((item, index) => (
            <div key={index} className="space-y-2 rounded-md border p-3">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Input
                  placeholder="Medication *"
                  value={item.medicationName}
                  onChange={(e) => updateItem(index, { medicationName: e.target.value })}
                />
                <Input
                  placeholder="Generic name"
                  value={item.genericName}
                  onChange={(e) => updateItem(index, { genericName: e.target.value })}
                />
                <Input
                  placeholder="Strength (e.g. 500mg)"
                  value={item.strength}
                  onChange={(e) => updateItem(index, { strength: e.target.value })}
                />
                <Select value={item.route} onValueChange={(v) => updateItem(index, { route: v as MedicationRoute })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(MedicationRoute).map((r) => (
                      <SelectItem key={r} value={r}>
                        {formatEnumLabel(r)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Input
                  placeholder="Dosage * (e.g. 1 tablet)"
                  value={item.dosage}
                  onChange={(e) => updateItem(index, { dosage: e.target.value })}
                />
                <Input
                  placeholder="Frequency * (e.g. BD)"
                  value={item.frequency}
                  onChange={(e) => updateItem(index, { frequency: e.target.value })}
                />
                <Input
                  placeholder="Duration * (e.g. 5 days)"
                  value={item.duration}
                  onChange={(e) => updateItem(index, { duration: e.target.value })}
                />
                <Input
                  type="number"
                  min={1}
                  placeholder="Quantity"
                  value={item.quantity}
                  onChange={(e) => updateItem(index, { quantity: e.target.value })}
                />
              </div>
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Instructions (e.g. after food)"
                  value={item.instructions}
                  onChange={(e) => updateItem(index, { instructions: e.target.value })}
                />
                {items.length > 1 && (
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeItem(index)}>
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}

          <div className="flex items-center justify-between">
            <Button variant="outline" size="sm" onClick={() => setItems((prev) => [...prev, blankItemDraft()])}>
              <Plus className="h-3.5 w-3.5" />
              Add medication
            </Button>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Notes (optional)</label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <Button onClick={() => createMutation.mutate()} disabled={!canSubmit || createMutation.isPending}>
            {createMutation.isPending && <Loader2 className="animate-spin" />}
            Save prescription
          </Button>

          {lastWarnings.length > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Basic drug interaction warning (non-exhaustive)</AlertTitle>
              <AlertDescription>
                <ul className="list-disc space-y-1 pl-4">
                  {lastWarnings.map((w, i) => (
                    <li key={i}>
                      <span className="font-medium">
                        {w.medicationA} + {w.medicationB}
                      </span>{' '}
                      ({w.severity}): {w.description}
                    </li>
                  ))}
                </ul>
                <p className="mt-1 text-xs">
                  This is a basic, non-exhaustive check - always use clinical judgment.
                </p>
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}

      <div className="rounded-lg border bg-card">
        <div className="border-b p-3">
          <h3 className="text-sm font-semibold text-foreground">Prescriptions for this encounter</h3>
        </div>
        {prescriptionsQuery.isLoading ? (
          <div className="flex h-16 items-center justify-center">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : prescriptionsQuery.data?.data.length ? (
          <ul className="divide-y">
            {prescriptionsQuery.data.data.map((rx) => (
              <li key={rx.id} className="space-y-2 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Pill className="h-4 w-4 text-muted-foreground" />
                    <span className="font-mono text-xs text-muted-foreground">{rx.prescriptionNumber}</span>
                    <StatusBadge status={rx.status} />
                    <span className="text-xs text-muted-foreground">
                      {new Date(rx.prescribedAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void downloadPrescriptionPdf(rx.id, rx.prescriptionNumber)}
                    >
                      <Download className="h-3.5 w-3.5" />
                      PDF
                    </Button>
                    {canDispense && rx.status === PrescriptionStatus.ACTIVE && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => dispenseMutation.mutate(rx.id)}
                        disabled={dispenseMutation.isPending}
                      >
                        <Pill className="h-3.5 w-3.5" />
                        Dispense
                      </Button>
                    )}
                    {canUpdate && rx.status === PrescriptionStatus.ACTIVE && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => statusMutation.mutate({ id: rx.id, status: PrescriptionStatus.COMPLETED })}
                          disabled={statusMutation.isPending}
                        >
                          Mark completed
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive"
                          onClick={() =>
                            statusMutation.mutate({ id: rx.id, status: PrescriptionStatus.DISCONTINUED })
                          }
                          disabled={statusMutation.isPending}
                        >
                          Discontinue
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                <ul className="space-y-1 pl-6 text-sm">
                  {rx.items.map((item) => (
                    <li key={item.id}>
                      {item.medicationName}
                      {item.strength ? ` ${item.strength}` : ''} - {item.dosage} · {item.frequency} · {item.duration}
                      {item.instructions ? ` (${item.instructions})` : ''}
                    </li>
                  ))}
                </ul>
                {rx.notes && <p className="pl-6 text-xs text-muted-foreground">{rx.notes}</p>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="p-4 text-sm text-muted-foreground">No prescriptions for this encounter yet.</p>
        )}
      </div>
    </div>
  )
}

interface LabItemDraft {
  catalogItemId: string
  testName: string
  testCode: string
  category: string
  referenceRange: string
}

function blankLabItemDraft(): LabItemDraft {
  return { catalogItemId: '', testName: '', testCode: '', category: '', referenceRange: '' }
}

function LabOrdersTab({
  encounterId,
  canOrder,
  canUpdate,
}: {
  encounterId: string
  canOrder: boolean
  canUpdate: boolean
}) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [items, setItems] = useState<LabItemDraft[]>([blankLabItemDraft()])
  const [priority, setPriority] = useState<Priority>(Priority.ROUTINE)
  const [notes, setNotes] = useState('')
  const [resultsOrderId, setResultsOrderId] = useState<string | null>(null)
  const [resultDrafts, setResultDrafts] = useState<Record<string, { result: string; isAbnormalOverride: boolean }>>({})

  const catalogQuery = useQuery({
    queryKey: ['laboratory', 'catalog', 'active'],
    queryFn: () => listLabCatalog({ isActive: true }),
  })

  const ordersQuery = useQuery({
    queryKey: ['laboratory', 'encounter', encounterId],
    queryFn: () => listLabOrders({ encounterId, limit: 50 }),
  })

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ['laboratory', 'encounter', encounterId] })
  }

  const createMutation = useMutation({
    mutationFn: () =>
      createLabOrder({
        encounterId,
        priority,
        notes: notes || undefined,
        items: items.map((item) =>
          item.catalogItemId
            ? { catalogItemId: item.catalogItemId }
            : {
                testName: item.testName,
                testCode: item.testCode || undefined,
                category: item.category || undefined,
                referenceRange: item.referenceRange || undefined,
              },
        ),
      }),
    onSuccess: () => {
      toast({ title: 'Lab order created' })
      setItems([blankLabItemDraft()])
      setNotes('')
      invalidate()
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Could not create lab order', description: getErrorMessage(error) })
    },
  })

  const collectMutation = useMutation({
    mutationFn: (id: string) => collectLabSample(id, {}),
    onSuccess: () => {
      toast({ title: 'Sample collected' })
      invalidate()
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Could not record sample collection', description: getErrorMessage(error) })
    },
  })

  const resultsMutation = useMutation({
    mutationFn: ({ id, drafts }: { id: string; drafts: Record<string, { result: string; isAbnormalOverride: boolean }> }) =>
      enterLabResults(id, {
        items: Object.entries(drafts)
          .filter(([, v]) => v.result.trim() !== '')
          .map(([itemId, v]) => ({ itemId, result: v.result, isAbnormalOverride: v.isAbnormalOverride })),
      }),
    onSuccess: () => {
      toast({ title: 'Results saved' })
      setResultsOrderId(null)
      setResultDrafts({})
      invalidate()
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Could not save results', description: getErrorMessage(error) })
    },
  })

  const statusMutation = useMutation({
    mutationFn: (id: string) => updateLabTestStatus(id, { status: LabTestStatus.CANCELLED }),
    onSuccess: () => {
      toast({ title: 'Lab order cancelled' })
      invalidate()
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Could not cancel lab order', description: getErrorMessage(error) })
    },
  })

  const uploadReportMutation = useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) => uploadLabReportFile(id, file),
    onSuccess: () => {
      toast({ title: 'Report uploaded' })
      invalidate()
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Upload failed', description: getErrorMessage(error) })
    },
  })

  function updateItem(index: number, patch: Partial<LabItemDraft>) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)))
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  function openResultsFor(order: { id: string; items: Array<{ id: string; result: string | null }> }) {
    setResultsOrderId(order.id)
    setResultDrafts(
      Object.fromEntries(
        order.items.map((item) => [item.id, { result: item.result ?? '', isAbnormalOverride: false }]),
      ),
    )
  }

  const canSubmit = items.every((item) => item.catalogItemId || item.testName)

  return (
    <div className="space-y-4">
      {canOrder && (
        <div className="space-y-3 rounded-lg border bg-card p-4">
          <h3 className="text-sm font-semibold text-foreground">New lab order</h3>
          {items.map((item, index) => (
            <div key={index} className="space-y-2 rounded-md border p-3">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Select
                  value={item.catalogItemId || '__adhoc__'}
                  onValueChange={(v) => updateItem(index, { catalogItemId: v === '__adhoc__' ? '' : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a test" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__adhoc__">Ad hoc (enter manually)</SelectItem>
                    {catalogQuery.data?.map((c: LabTestCatalogItem) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.testName} ({c.testCode}) - {c.category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {items.length > 1 && (
                  <Button variant="ghost" size="sm" className="justify-self-start" onClick={() => removeItem(index)}>
                    <X className="h-3.5 w-3.5" />
                    Remove
                  </Button>
                )}
              </div>
              {!item.catalogItemId && (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <Input
                    placeholder="Test name *"
                    value={item.testName}
                    onChange={(e) => updateItem(index, { testName: e.target.value })}
                  />
                  <Input
                    placeholder="Test code"
                    value={item.testCode}
                    onChange={(e) => updateItem(index, { testCode: e.target.value })}
                  />
                  <Input
                    placeholder="Category"
                    value={item.category}
                    onChange={(e) => updateItem(index, { category: e.target.value })}
                  />
                  <Input
                    placeholder="Reference range (e.g. Negative)"
                    value={item.referenceRange}
                    onChange={(e) => updateItem(index, { referenceRange: e.target.value })}
                  />
                </div>
              )}
            </div>
          ))}

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setItems((prev) => [...prev, blankLabItemDraft()])}>
              <Plus className="h-3.5 w-3.5" />
              Add test
            </Button>
            <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.values(Priority).map((p) => (
                  <SelectItem key={p} value={p}>
                    {formatEnumLabel(p)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Notes (optional)</label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <Button onClick={() => createMutation.mutate()} disabled={!canSubmit || createMutation.isPending}>
            {createMutation.isPending && <Loader2 className="animate-spin" />}
            Save lab order
          </Button>
        </div>
      )}

      <div className="rounded-lg border bg-card">
        <div className="border-b p-3">
          <h3 className="text-sm font-semibold text-foreground">Lab orders for this encounter</h3>
        </div>
        {ordersQuery.isLoading ? (
          <div className="flex h-16 items-center justify-center">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : ordersQuery.data?.data.length ? (
          <ul className="divide-y">
            {ordersQuery.data.data.map((order) => (
              <li key={order.id} className="space-y-2 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <FlaskConical className="h-4 w-4 text-muted-foreground" />
                    <span className="font-mono text-xs text-muted-foreground">{order.labOrderNumber}</span>
                    <StatusBadge status={order.status} />
                    <Badge variant="outline">{formatEnumLabel(order.priority)}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(order.createdAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {canUpdate && order.status === LabTestStatus.ORDERED && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => collectMutation.mutate(order.id)}
                        disabled={collectMutation.isPending}
                      >
                        <TestTube className="h-3.5 w-3.5" />
                        Collect sample
                      </Button>
                    )}
                    {canUpdate &&
                      (order.status === LabTestStatus.SAMPLE_COLLECTED || order.status === LabTestStatus.IN_PROGRESS) && (
                        <Button variant="outline" size="sm" onClick={() => openResultsFor(order)}>
                          Enter results
                        </Button>
                      )}
                    {(order.status === LabTestStatus.COMPLETED || order.status === LabTestStatus.REPORTED) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void downloadLabReportPdf(order.id, order.labOrderNumber)}
                      >
                        <Download className="h-3.5 w-3.5" />
                        PDF
                      </Button>
                    )}
                    {canUpdate && order.status === LabTestStatus.COMPLETED && (
                      <label className="inline-flex cursor-pointer items-center gap-1 text-xs text-muted-foreground hover:underline">
                        <Upload className="h-3.5 w-3.5" />
                        Upload report
                        <input
                          type="file"
                          accept="application/pdf,image/png,image/jpeg,image/webp"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) uploadReportMutation.mutate({ id: order.id, file })
                          }}
                        />
                      </label>
                    )}
                    {canUpdate &&
                      [LabTestStatus.ORDERED, LabTestStatus.SAMPLE_COLLECTED, LabTestStatus.IN_PROGRESS].includes(
                        order.status,
                      ) && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive"
                          onClick={() => statusMutation.mutate(order.id)}
                          disabled={statusMutation.isPending}
                        >
                          Cancel
                        </Button>
                      )}
                  </div>
                </div>

                <ul className="space-y-1 pl-6 text-sm">
                  {order.items.map((item) => (
                    <li key={item.id} className="flex flex-wrap items-center gap-2">
                      <span>{item.testName}</span>
                      {item.result && (
                        <span className="text-muted-foreground">
                          {item.result} {item.unit ?? ''}
                          {item.referenceRange ? ` (Ref: ${item.referenceRange})` : ''}
                        </span>
                      )}
                      {item.isAbnormal && (
                        <Badge variant="destructive">{item.abnormalType ? formatEnumLabel(item.abnormalType) : 'Abnormal'}</Badge>
                      )}
                    </li>
                  ))}
                </ul>

                {resultsOrderId === order.id && (
                  <div className="space-y-2 rounded-md border bg-muted/30 p-3">
                    <h4 className="text-xs font-semibold text-foreground">Enter results</h4>
                    {order.items.map((item) => (
                      <div key={item.id} className="flex flex-wrap items-center gap-2">
                        <span className="w-40 shrink-0 text-xs">{item.testName}</span>
                        <Input
                          className="w-40"
                          placeholder="Result"
                          value={resultDrafts[item.id]?.result ?? ''}
                          onChange={(e) =>
                            setResultDrafts((prev) => ({
                              ...prev,
                              [item.id]: { result: e.target.value, isAbnormalOverride: prev[item.id]?.isAbnormalOverride ?? false },
                            }))
                          }
                        />
                        <span className="text-xs text-muted-foreground">{item.unit}</span>
                        <label className="flex items-center gap-1 text-xs text-muted-foreground">
                          <input
                            type="checkbox"
                            checked={resultDrafts[item.id]?.isAbnormalOverride ?? false}
                            onChange={(e) =>
                              setResultDrafts((prev) => ({
                                ...prev,
                                [item.id]: { result: prev[item.id]?.result ?? '', isAbnormalOverride: e.target.checked },
                              }))
                            }
                          />
                          Mark abnormal (non-numeric results only)
                        </label>
                      </div>
                    ))}
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        onClick={() => resultsMutation.mutate({ id: order.id, drafts: resultDrafts })}
                        disabled={resultsMutation.isPending}
                      >
                        {resultsMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                        Save results
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setResultsOrderId(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}

                {order.reportFileUrl && (
                  <p className="pl-6 text-xs text-muted-foreground">
                    External report:{' '}
                    <a href={order.reportFileUrl} target="_blank" rel="noreferrer" className="hover:underline">
                      view file
                    </a>
                  </p>
                )}
                {order.notes && <p className="pl-6 text-xs text-muted-foreground">{order.notes}</p>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="p-4 text-sm text-muted-foreground">No lab orders for this encounter yet.</p>
        )}
      </div>
    </div>
  )
}

function RadiologyTab({ encounterId, canOrder }: { encounterId: string; canOrder: boolean }) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [catalogItemId, setCatalogItemId] = useState('')
  const [modality, setModality] = useState('')
  const [bodyPart, setBodyPart] = useState('')
  const [priority, setPriority] = useState<Priority>(Priority.ROUTINE)
  const [clinicalIndication, setClinicalIndication] = useState('')

  const catalogQuery = useQuery({
    queryKey: ['radiology', 'catalog', 'active'],
    queryFn: () => listRadiologyCatalog({ isActive: true }),
  })

  const ordersQuery = useQuery({
    queryKey: ['radiology', 'encounter', encounterId],
    queryFn: () => listRadiologyOrders({ encounterId, limit: 50 }),
  })

  const createMutation = useMutation({
    mutationFn: () =>
      createRadiologyOrder({
        encounterId,
        priority,
        clinicalIndication: clinicalIndication || undefined,
        catalogItemId: catalogItemId || undefined,
        modality: catalogItemId ? undefined : modality || undefined,
        bodyPart: catalogItemId ? undefined : bodyPart || undefined,
      }),
    onSuccess: () => {
      toast({ title: 'Radiology order created' })
      setCatalogItemId('')
      setModality('')
      setBodyPart('')
      setClinicalIndication('')
      void queryClient.invalidateQueries({ queryKey: ['radiology', 'encounter', encounterId] })
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Could not create radiology order', description: getErrorMessage(error) })
    },
  })

  const canSubmit = Boolean(catalogItemId || (modality && bodyPart))

  return (
    <div className="space-y-4">
      {canOrder && (
        <div className="space-y-3 rounded-lg border bg-card p-4">
          <h3 className="text-sm font-semibold text-foreground">New radiology order</h3>
          <Select value={catalogItemId || '__adhoc__'} onValueChange={(v) => setCatalogItemId(v === '__adhoc__' ? '' : v)}>
            <SelectTrigger>
              <SelectValue placeholder="Choose a study" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__adhoc__">Ad hoc (enter manually)</SelectItem>
              {catalogQuery.data?.map((c: RadiologyCatalogItem) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name} ({c.code}) - {c.modality} · {c.bodyPart}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!catalogItemId && (
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Modality * (e.g. X_RAY, CT, MRI)" value={modality} onChange={(e) => setModality(e.target.value)} />
              <Input placeholder="Body part *" value={bodyPart} onChange={(e) => setBodyPart(e.target.value)} />
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.values(Priority).map((p) => (
                  <SelectItem key={p} value={p}>
                    {formatEnumLabel(p)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Clinical indication</label>
            <Textarea rows={2} value={clinicalIndication} onChange={(e) => setClinicalIndication(e.target.value)} />
          </div>
          <Button onClick={() => createMutation.mutate()} disabled={!canSubmit || createMutation.isPending}>
            {createMutation.isPending && <Loader2 className="animate-spin" />}
            Save radiology order
          </Button>
        </div>
      )}

      <div className="rounded-lg border bg-card">
        <div className="border-b p-3">
          <h3 className="text-sm font-semibold text-foreground">Radiology orders for this encounter</h3>
        </div>
        {ordersQuery.isLoading ? (
          <div className="flex h-16 items-center justify-center">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : ordersQuery.data?.data.length ? (
          <ul className="divide-y">
            {ordersQuery.data.data.map((order) => (
              <li key={order.id} className="p-4">
                <Link
                  href={`/dashboard/radiology/${order.id}`}
                  className="flex flex-wrap items-center gap-2 text-sm hover:underline"
                >
                  <Scan className="h-4 w-4 text-muted-foreground" />
                  <span className="font-mono text-xs text-muted-foreground">{order.orderNumber}</span>
                  <StatusBadge status={order.status} />
                  <Badge variant="outline">{formatEnumLabel(order.priority)}</Badge>
                  <span>
                    {order.modality} - {order.bodyPart}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="p-4 text-sm text-muted-foreground">No radiology orders for this encounter yet.</p>
        )}
      </div>
    </div>
  )
}
