'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import {
  BloodGroup,
  DocumentType,
  Gender,
  UpdatePatientSchema,
  type PatientTimelineEntryType,
  type UpdatePatientDto,
} from '@medicore/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Activity,
  AlertTriangle,
  Building2,
  Calendar,
  FileText,
  FlaskConical,
  Loader2,
  type LucideIcon,
  Pencil,
  Pill,
  Receipt,
  RotateCcw,
  Scan,
  Trash2,
  Upload,
  User,
} from 'lucide-react'
import { useParams, useRouter } from 'next/navigation'
import { useState } from 'react'
import { useForm } from 'react-hook-form'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import {
  deletePatient,
  deletePatientDocument,
  getPatient,
  getPatientTimeline,
  listPatientDocuments,
  restorePatient,
  updatePatient,
  uploadPatientDocument,
} from '@/lib/api/patients'
import { useAuth } from '@/lib/auth/auth-context'

function getErrorMessage(error: unknown): string {
  const axiosError = error as { response?: { data?: { error?: { message?: string } } } }
  return axiosError?.response?.data?.error?.message ?? 'Something went wrong. Please try again.'
}

function formatEnumLabel(value: string): string {
  return value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, ' ')
}

export default function PatientDetailPage() {
  const params = useParams<{ id: string }>()
  const patientId = params.id
  const router = useRouter()
  const { hasPermission } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [confirmDeactivate, setConfirmDeactivate] = useState(false)

  const canUpdate = hasPermission('patients.update')
  const canDelete = hasPermission('patients.delete')

  const patientQuery = useQuery({
    queryKey: ['patients', 'detail', patientId],
    queryFn: () => getPatient(patientId),
  })

  const deactivateMutation = useMutation({
    mutationFn: () => deletePatient(patientId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['patients'] })
      toast({ title: 'Patient deactivated' })
      setConfirmDeactivate(false)
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Could not deactivate patient', description: getErrorMessage(error) })
    },
  })

  const restoreMutation = useMutation({
    mutationFn: () => restorePatient(patientId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['patients'] })
      toast({ title: 'Patient restored' })
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Could not restore patient', description: getErrorMessage(error) })
    },
  })

  if (patientQuery.isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (patientQuery.isError || !patientQuery.data) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Patient not found</AlertTitle>
        <AlertDescription>
          {getErrorMessage(patientQuery.error)}{' '}
          <Button variant="link" className="h-auto p-0" onClick={() => router.push('/dashboard/patients')}>
            Back to patients
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  const patient = patientQuery.data

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-foreground">{patient.fullName}</h1>
            <Badge variant={patient.isActive ? 'success' : 'secondary'}>
              {patient.isActive ? 'Active' : 'Deactivated'}
            </Badge>
          </div>
          <p className="font-mono text-sm text-muted-foreground">
            {patient.uhid} · {patient.age}y · {formatEnumLabel(patient.gender)}
            {patient.bloodGroup ? ` · ${patient.bloodGroup.replace('_POSITIVE', '+').replace('_NEGATIVE', '-')}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {patient.isActive && canDelete && (
            <Button variant="destructive" size="sm" onClick={() => setConfirmDeactivate(true)}>
              <Trash2 />
              Deactivate
            </Button>
          )}
          {!patient.isActive && canUpdate && (
            <Button size="sm" onClick={() => restoreMutation.mutate()} disabled={restoreMutation.isPending}>
              {restoreMutation.isPending ? <Loader2 className="animate-spin" /> : <RotateCcw />}
              Restore
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="profile">
        <TabsList className="flex-wrap">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="medical">Medical Summary</TabsTrigger>
          <TabsTrigger value="insurance">Insurance</TabsTrigger>
          <TabsTrigger value="emergency">Emergency Contact</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="audit">Audit</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <ProfileTab patient={patient} canUpdate={canUpdate} />
        </TabsContent>
        <TabsContent value="medical">
          <StatGrid
            items={[
              ['Appointments', patient.summary.appointments],
              ['Admissions', patient.summary.admissions],
              ['Lab Tests', patient.summary.labTests],
              ['Radiology Orders', patient.summary.radiologyOrders],
              ['Medical Records', patient.summary.medicalRecords],
              ['Prescriptions', patient.summary.prescriptions],
            ]}
            note="Full clinical detail is available once the Medical Records module ships — these are live counts from this patient's linked records."
          />
        </TabsContent>
        <TabsContent value="insurance">
          <StatGrid
            items={[
              ['Insurance Claims', patient.summary.insuranceClaims],
              ['Invoices', patient.summary.invoices],
            ]}
            note="Claim-level detail is available once the Insurance module ships — these are live counts from this patient's linked records."
          />
        </TabsContent>
        <TabsContent value="emergency">
          <EmergencyContactTab patient={patient} canUpdate={canUpdate} />
        </TabsContent>
        <TabsContent value="documents">
          <DocumentsTab patientId={patientId} canUpdate={canUpdate} />
        </TabsContent>
        <TabsContent value="timeline">
          <TimelineTab patientId={patientId} />
        </TabsContent>
        <TabsContent value="audit">
          <TimelineTab patientId={patientId} onlyType="AUDIT" />
        </TabsContent>
      </Tabs>

      <Dialog open={confirmDeactivate} onOpenChange={setConfirmDeactivate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deactivate {patient.fullName}?</DialogTitle>
            <DialogDescription>
              This soft-deletes the patient record. It can be restored later from the patient list.
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
    </div>
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
  patient: NonNullable<ReturnType<typeof useQuery<Awaited<ReturnType<typeof getPatient>>>>['data']>
  canUpdate: boolean
}

function ProfileTab({ patient, canUpdate }: ProfileTabProps) {
  const [editing, setEditing] = useState(false)
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const form = useForm<UpdatePatientDto>({
    resolver: zodResolver(UpdatePatientSchema),
    defaultValues: {
      firstName: patient.firstName,
      lastName: patient.lastName,
      email: patient.email ?? undefined,
      phone: patient.phone,
      dateOfBirth: new Date(patient.dateOfBirth).toISOString().slice(0, 10),
      gender: patient.gender,
      bloodGroup: patient.bloodGroup ?? undefined,
      address: patient.address ?? undefined,
      city: patient.city ?? undefined,
      state: patient.state ?? undefined,
      pincode: patient.pincode ?? undefined,
    },
  })

  const updateMutation = useMutation({
    mutationFn: (dto: UpdatePatientDto) => updatePatient(patient.id, dto),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['patients', 'detail', patient.id] })
      void queryClient.invalidateQueries({ queryKey: ['patients', 'list'] })
      toast({ title: 'Profile updated' })
      setEditing(false)
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Update failed', description: getErrorMessage(error) })
    },
  })

  if (!editing) {
    const rows: Array<[string, string]> = [
      ['First name', patient.firstName],
      ['Last name', patient.lastName],
      ['Phone', patient.phone],
      ['Email', patient.email ?? '—'],
      ['Date of birth', new Date(patient.dateOfBirth).toLocaleDateString('en-IN', { dateStyle: 'medium' })],
      ['Gender', formatEnumLabel(patient.gender)],
      ['Blood group', patient.bloodGroup ? formatEnumLabel(patient.bloodGroup) : '—'],
      ['Address', patient.address ?? '—'],
      ['City', patient.city ?? '—'],
      ['State', patient.state ?? '—'],
      ['Pincode', patient.pincode ?? '—'],
      ['Registered', new Date(patient.createdAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })],
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
            name="firstName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>First name</FormLabel>
                <FormControl>
                  <Input {...field} value={field.value ?? ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="lastName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Last name</FormLabel>
                <FormControl>
                  <Input {...field} value={field.value ?? ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phone</FormLabel>
                <FormControl>
                  <Input maxLength={10} {...field} value={field.value ?? ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input type="email" {...field} value={field.value ?? ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="gender"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Gender</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {Object.values(Gender).map((g) => (
                      <SelectItem key={g} value={g}>
                        {formatEnumLabel(g)}
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
            name="bloodGroup"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Blood group</FormLabel>
                <Select value={field.value ?? ''} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Unknown" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {Object.values(BloodGroup).map((bg) => (
                      <SelectItem key={bg} value={bg}>
                        {formatEnumLabel(bg)}
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
          name="address"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Address</FormLabel>
              <FormControl>
                <Input {...field} value={field.value ?? ''} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-3 gap-4">
          <FormField
            control={form.control}
            name="city"
            render={({ field }) => (
              <FormItem>
                <FormLabel>City</FormLabel>
                <FormControl>
                  <Input {...field} value={field.value ?? ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="state"
            render={({ field }) => (
              <FormItem>
                <FormLabel>State</FormLabel>
                <FormControl>
                  <Input {...field} value={field.value ?? ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="pincode"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Pincode</FormLabel>
                <FormControl>
                  <Input maxLength={6} {...field} value={field.value ?? ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
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

function EmergencyContactTab({ patient, canUpdate }: ProfileTabProps) {
  const [editing, setEditing] = useState(false)
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const form = useForm<UpdatePatientDto>({
    resolver: zodResolver(UpdatePatientSchema),
    defaultValues: {
      emergencyContactName: patient.emergencyContactName ?? undefined,
      emergencyContactPhone: patient.emergencyContactPhone ?? undefined,
    },
  })

  const updateMutation = useMutation({
    mutationFn: (dto: UpdatePatientDto) => updatePatient(patient.id, dto),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['patients', 'detail', patient.id] })
      toast({ title: 'Emergency contact updated' })
      setEditing(false)
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Update failed', description: getErrorMessage(error) })
    },
  })

  if (!editing) {
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
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Name</dt>
            <dd className="text-sm font-medium text-foreground">{patient.emergencyContactName ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Phone</dt>
            <dd className="text-sm font-medium text-foreground">{patient.emergencyContactPhone ?? '—'}</dd>
          </div>
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
        <FormField
          control={form.control}
          name="emergencyContactName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input {...field} value={field.value ?? ''} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="emergencyContactPhone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Phone</FormLabel>
              <FormControl>
                <Input maxLength={10} {...field} value={field.value ?? ''} />
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

function DocumentsTab({ patientId, canUpdate }: { patientId: string; canUpdate: boolean }) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [documentType, setDocumentType] = useState<string>(DocumentType.OTHER)
  const [file, setFile] = useState<File | null>(null)

  const documentsQuery = useQuery({
    queryKey: ['patients', 'documents', patientId],
    queryFn: () => listPatientDocuments(patientId),
  })

  const uploadMutation = useMutation({
    mutationFn: () => {
      if (!file) throw new Error('Choose a file first')
      return uploadPatientDocument(patientId, file, documentType)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['patients', 'documents', patientId] })
      toast({ title: 'Document uploaded' })
      setFile(null)
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Upload failed', description: getErrorMessage(error) })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (documentId: string) => deletePatientDocument(patientId, documentId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['patients', 'documents', patientId] })
      toast({ title: 'Document deleted' })
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
                {Object.values(DocumentType).map((dt) => (
                  <SelectItem key={dt} value={dt}>
                    {formatEnumLabel(dt)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 space-y-1.5">
            <label className="text-sm font-medium">File (PDF, PNG, JPEG, WEBP — max 10MB)</label>
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
          <div className="flex h-24 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
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
                {canUpdate && (
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

const TIMELINE_ICONS: Record<PatientTimelineEntryType, LucideIcon> = {
  REGISTRATION: User,
  APPOINTMENT: Calendar,
  ADMISSION: Building2,
  LAB_TEST: FlaskConical,
  RADIOLOGY: Scan,
  PRESCRIPTION: Pill,
  INVOICE: Receipt,
  AUDIT: Activity,
}

function TimelineTab({ patientId, onlyType }: { patientId: string; onlyType?: PatientTimelineEntryType }) {
  const timelineQuery = useQuery({
    queryKey: ['patients', 'timeline', patientId],
    queryFn: () => getPatientTimeline(patientId),
  })

  if (timelineQuery.isLoading) {
    return (
      <div className="flex h-24 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const entries = (timelineQuery.data ?? []).filter((e) => !onlyType || e.type === onlyType)

  if (entries.length === 0) {
    return (
      <p className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
        {onlyType ? 'No audit events recorded yet.' : 'No activity recorded yet.'}
      </p>
    )
  }

  return (
    <ol className="space-y-4 rounded-lg border bg-card p-4">
      {entries.map((entry) => {
        const Icon = TIMELINE_ICONS[entry.type]
        return (
          <li key={entry.id} className="flex gap-3">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Icon className="h-4 w-4" />
            </div>
            <div className="flex-1 space-y-0.5">
              <p className="text-sm font-medium text-foreground">{entry.title}</p>
              {entry.description && <p className="text-sm text-muted-foreground">{entry.description}</p>}
              <p className="text-xs text-muted-foreground">
                {new Date(entry.occurredAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
              </p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
