'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import {
  AdmissionStatus,
  BloodGroup,
  DocumentType,
  Gender,
  type Patient,
  PatientInsuranceType,
  type PatientTimelineEntryType,
  UpdatePatientSchema,
  type UpdatePatientDto,
} from '@medicore/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Activity,
  Building2,
  Calendar,
  FileText,
  FlaskConical,
  GitMerge,
  Loader2,
  type LucideIcon,
  Pencil,
  Pill,
  Plus,
  Receipt,
  RotateCcw,
  Scan,
  Search,
  Trash2,
  Upload,
  User,
  Users,
  X,
} from 'lucide-react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useState } from 'react'
import { useForm } from 'react-hook-form'

import { PageLayout } from '@/components/layout/page-layout'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
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
import { useToast } from '@/hooks/use-toast'
import { createPatientCoverage, listInsurancePlans, listInsuranceProviders, listPatientCoverages } from '@/lib/api/insurance'
import { listAdmissions } from '@/lib/api/ipd'
import {
  deletePatient,
  deletePatientDocument,
  getPatient,
  getPatientFamily,
  getPatientTimeline,
  linkFamilyMember,
  listPatientDocuments,
  listPatients,
  mergePatients,
  restorePatient,
  unlinkFamilyMember,
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
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false)

  const canUpdate = hasPermission('patients.update')
  const canDelete = hasPermission('patients.delete')
  const canManage = hasPermission('patients.manage')

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
      <PageLayout
        breadcrumbs={[{ label: 'Patients', href: '/dashboard/patients' }, { label: '…' }]}
        title="…"
        loading
      >
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </PageLayout>
    )
  }

  if (patientQuery.isError || !patientQuery.data) {
    return (
      <PageLayout breadcrumbs={[{ label: 'Patients', href: '/dashboard/patients' }, { label: 'Not found' }]} title="Patient not found">
        <EmptyState
          variant="error"
          title="Patient not found"
          description={getErrorMessage(patientQuery.error)}
          action={{ label: 'Back to patients', href: '/dashboard/patients' }}
        />
      </PageLayout>
    )
  }

  const patient = patientQuery.data

  return (
    <Tabs defaultValue="profile">
      <PageLayout
        breadcrumbs={[{ label: 'Patients', href: '/dashboard/patients' }, { label: patient.fullName }]}
        title={patient.fullName}
        badge={<StatusBadge status={patient.isActive ? 'ACTIVE' : 'INACTIVE'} label={patient.isActive ? 'Active' : 'Deactivated'} />}
        meta={
          <>
            <PageHeaderMeta label="UHID">{patient.uhid}</PageHeaderMeta>
            <PageHeaderMeta label="Age">
              {patient.age}y · {formatEnumLabel(patient.gender)}
            </PageHeaderMeta>
            {patient.bloodGroup && (
              <PageHeaderMeta label="Blood group">
                {patient.bloodGroup.replace('_POSITIVE', '+').replace('_NEGATIVE', '-')}
              </PageHeaderMeta>
            )}
          </>
        }
        actions={
          <>
            {patient.isActive && canManage && (
              <Button variant="outline" size="sm" onClick={() => setMergeDialogOpen(true)}>
                <GitMerge />
                Merge
              </Button>
            )}
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
          </>
        }
        toolbar={
          <TabsList className="flex-wrap">
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="medical">Medical Summary</TabsTrigger>
            <TabsTrigger value="insurance">Insurance</TabsTrigger>
            <TabsTrigger value="admissions">Admissions</TabsTrigger>
            <TabsTrigger value="family">Family</TabsTrigger>
            <TabsTrigger value="emergency">Emergency Contact</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
            <TabsTrigger value="audit">Audit</TabsTrigger>
          </TabsList>
        }
      >
        {patient.mergedIntoId && (
          <Alert>
            <GitMerge className="h-4 w-4" />
            <AlertTitle>This record was merged</AlertTitle>
            <AlertDescription>
              All linked records were moved to another patient profile.{' '}
              <Link href={`/dashboard/patients/${patient.mergedIntoId}`} className="underline">
                View the surviving record
              </Link>
              .
            </AlertDescription>
          </Alert>
        )}

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
          <PatientInsuranceTab patientId={patientId} canUpdate={canUpdate} />
        </TabsContent>
        <TabsContent value="admissions">
          <PatientAdmissionsTab patientId={patientId} />
        </TabsContent>
        <TabsContent value="family">
          <FamilyTab patient={patient} canUpdate={canUpdate} />
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

        <MergeDialog
          open={mergeDialogOpen}
          onOpenChange={setMergeDialogOpen}
          patient={patient}
          onMerged={(survivorId) => {
            setMergeDialogOpen(false)
            if (survivorId !== patient.id) router.push(`/dashboard/patients/${survivorId}`)
            else void queryClient.invalidateQueries({ queryKey: ['patients'] })
          }}
        />
      </PageLayout>
    </Tabs>
  )
}

function PatientSearchPicker({
  excludeId,
  selected,
  onSelect,
}: {
  excludeId: string
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

  const results = (searchQuery.data?.data ?? []).filter((p) => p.id !== excludeId)

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
          ) : results.length ? (
            results.map((p) => (
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

function MergeDialog({
  open,
  onOpenChange,
  patient,
  onMerged,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  patient: Patient
  onMerged: (survivorPatientId: string) => void
}) {
  const { toast } = useToast()
  const [otherPatient, setOtherPatient] = useState<Patient | null>(null)
  const [direction, setDirection] = useState<'thisIntoOther' | 'otherIntoThis'>('otherIntoThis')

  const mutation = useMutation({
    mutationFn: () => {
      if (!otherPatient) throw new Error('Choose a patient first')
      return direction === 'thisIntoOther'
        ? mergePatients(patient.id, otherPatient.id)
        : mergePatients(otherPatient.id, patient.id)
    },
    onSuccess: (result) => {
      toast({ title: 'Patients merged' })
      onMerged(result.survivorPatientId)
      setOtherPatient(null)
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Merge failed', description: getErrorMessage(error) }),
  })

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next)
        if (!next) setOtherPatient(null)
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Merge duplicate patient record</DialogTitle>
          <DialogDescription>
            Every appointment, encounter, prescription, lab/radiology order, invoice, and document belonging
            to the duplicate record moves to the survivor. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm">
            Merging <span className="font-medium">{patient.fullName}</span> ({patient.uhid}) with:
          </p>
          <PatientSearchPicker excludeId={patient.id} selected={otherPatient} onSelect={setOtherPatient} />

          {otherPatient && (
            <div className="space-y-2 rounded-md border p-3">
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="radio"
                  className="mt-1"
                  checked={direction === 'otherIntoThis'}
                  onChange={() => setDirection('otherIntoThis')}
                />
                <span>
                  Keep <span className="font-medium">{patient.fullName}</span>, merge{' '}
                  <span className="font-medium">{otherPatient.fullName}</span> into it
                </span>
              </label>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="radio"
                  className="mt-1"
                  checked={direction === 'thisIntoOther'}
                  onChange={() => setDirection('thisIntoOther')}
                />
                <span>
                  Keep <span className="font-medium">{otherPatient.fullName}</span>, merge{' '}
                  <span className="font-medium">{patient.fullName}</span> into it
                </span>
              </label>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => mutation.mutate()}
            disabled={!otherPatient || mutation.isPending}
          >
            {mutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Merge
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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

function PatientInsuranceTab({ patientId, canUpdate }: { patientId: string; canUpdate: boolean }) {
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)

  const coveragesQuery = useQuery({
    queryKey: ['insurance', 'patient-coverages', patientId],
    queryFn: () => listPatientCoverages(patientId),
  })

  return (
    <div className="space-y-4">
      {canUpdate && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="h-3.5 w-3.5" />
            Add coverage
          </Button>
        </div>
      )}

      <div className="rounded-lg border bg-card">
        {coveragesQuery.isLoading ? (
          <div className="flex h-24 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : coveragesQuery.data?.length ? (
          <ul className="divide-y">
            {coveragesQuery.data.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 p-4 text-sm">
                <div>
                  <p className="font-medium text-foreground">
                    {c.provider.name} · {c.plan.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatEnumLabel(c.type)} · Member {c.memberId} · Policy {c.policyNumber}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>
                    {new Date(c.effectiveDate).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                    {c.expiryDate ? ` – ${new Date(c.expiryDate).toLocaleDateString('en-IN', { dateStyle: 'medium' })}` : ''}
                  </span>
                  <StatusBadge status={c.status} />
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="p-4 text-sm text-muted-foreground">No insurance coverage on file for this patient.</p>
        )}
      </div>

      <AddCoverageDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        patientId={patientId}
        onAdded={() => void queryClient.invalidateQueries({ queryKey: ['insurance', 'patient-coverages', patientId] })}
      />
    </div>
  )
}

function AddCoverageDialog({
  open,
  onOpenChange,
  patientId,
  onAdded,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  patientId: string
  onAdded: () => void
}) {
  const { toast } = useToast()
  const providersQuery = useQuery({
    queryKey: ['insurance', 'providers', 'list'],
    queryFn: () => listInsuranceProviders({ limit: 100, isActive: true }),
    enabled: open,
  })
  const [providerId, setProviderId] = useState('')
  const plansQuery = useQuery({
    queryKey: ['insurance', 'plans', 'list', providerId],
    queryFn: () => listInsurancePlans({ providerId, limit: 100, isActive: true }),
    enabled: open && Boolean(providerId),
  })
  const [planId, setPlanId] = useState('')
  const [type, setType] = useState<PatientInsuranceType>(PatientInsuranceType.PRIMARY)
  const [memberId, setMemberId] = useState('')
  const [policyNumber, setPolicyNumber] = useState('')
  const [effectiveDate, setEffectiveDate] = useState('')
  const [expiryDate, setExpiryDate] = useState('')

  const mutation = useMutation({
    mutationFn: () =>
      createPatientCoverage(patientId, {
        providerId,
        planId,
        type,
        memberId,
        policyNumber,
        effectiveDate: new Date(effectiveDate),
        expiryDate: expiryDate ? new Date(expiryDate) : undefined,
      }),
    onSuccess: () => {
      toast({ title: 'Coverage added' })
      onAdded()
      onOpenChange(false)
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Could not add coverage', description: getErrorMessage(error) }),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add insurance coverage</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Select value={type} onValueChange={(v) => setType(v as PatientInsuranceType)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.values(PatientInsuranceType).map((t) => (
                <SelectItem key={t} value={t}>
                  {formatEnumLabel(t)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={providerId}
            onValueChange={(v) => {
              setProviderId(v)
              setPlanId('')
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Provider" />
            </SelectTrigger>
            <SelectContent>
              {providersQuery.data?.data.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={planId} onValueChange={setPlanId}>
            <SelectTrigger>
              <SelectValue placeholder="Plan" />
            </SelectTrigger>
            <SelectContent>
              {plansQuery.data?.data.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name} ({p.coveragePercent}% coverage)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input placeholder="Member ID" value={memberId} onChange={(e) => setMemberId(e.target.value)} />
          <Input placeholder="Policy number" value={policyNumber} onChange={(e) => setPolicyNumber(e.target.value)} />
          <div className="grid grid-cols-2 gap-2">
            <Input type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} />
            <Input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} placeholder="Expiry (optional)" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={!providerId || !planId || !memberId.trim() || !policyNumber.trim() || !effectiveDate || mutation.isPending}
          >
            {mutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function PatientAdmissionsTab({ patientId }: { patientId: string }) {
  const admissionsQuery = useQuery({
    queryKey: ['ipd', 'admissions', 'list', 'patient', patientId],
    queryFn: () => listAdmissions({ patientId, limit: 50 }),
  })
  const admissions = admissionsQuery.data?.data ?? []
  const current = admissions.find((a) => a.status === AdmissionStatus.ADMITTED)

  return (
    <div className="space-y-4">
      {current && (
        <div className="rounded-lg border border-primary/40 bg-primary/5 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-primary">Current admission</p>
          <p className="mt-1 text-sm font-medium text-foreground">
            {current.admissionNumber} · {current.ward.name}
            {current.bed ? ` · Bed ${current.bed.bedNumber}` : ' · Bed not yet allocated'}
          </p>
          <p className="text-xs text-muted-foreground">Attending: {current.attendingDoctor.fullName}</p>
          <Link href={`/dashboard/ipd/${current.id}`} className="text-xs text-primary hover:underline">
            View admission →
          </Link>
        </div>
      )}

      <div className="rounded-lg border bg-card">
        {admissionsQuery.isLoading ? (
          <div className="flex h-24 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : admissions.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No IPD admissions on file for this patient.</p>
        ) : (
          <ul className="divide-y">
            {admissions.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 p-4 text-sm">
                <div>
                  <Link href={`/dashboard/ipd/${a.id}`} className="font-mono text-xs text-primary hover:underline">
                    {a.admissionNumber}
                  </Link>
                  <p className="font-medium text-foreground">
                    {a.ward.name}
                    {a.bed ? ` · Bed ${a.bed.bedNumber}` : ''}
                  </p>
                  <p className="text-xs text-muted-foreground">{a.admissionReason}</p>
                  {a.encounterId && (
                    <Link href={`/dashboard/medical-records/${a.encounterId}`} className="text-xs text-primary hover:underline">
                      Linked encounter →
                    </Link>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{new Date(a.admittedAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })}</span>
                  <StatusBadge status={a.status} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function FamilyTab({ patient, canUpdate }: { patient: Patient; canUpdate: boolean }) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [linking, setLinking] = useState(false)
  const [headCandidate, setHeadCandidate] = useState<Patient | null>(null)

  const familyQuery = useQuery({
    queryKey: ['patients', 'family', patient.id],
    queryFn: () => getPatientFamily(patient.id),
  })

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['patients', 'family', patient.id] })
    void queryClient.invalidateQueries({ queryKey: ['patients', 'detail', patient.id] })
  }

  const linkMutation = useMutation({
    mutationFn: (headOfFamilyId: string) => linkFamilyMember(patient.id, headOfFamilyId),
    onSuccess: () => {
      toast({ title: 'Family linked' })
      setLinking(false)
      setHeadCandidate(null)
      invalidate()
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Could not link family', description: getErrorMessage(error) }),
  })

  const unlinkMutation = useMutation({
    mutationFn: () => unlinkFamilyMember(patient.id),
    onSuccess: () => {
      toast({ title: 'Removed from family' })
      invalidate()
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Could not unlink', description: getErrorMessage(error) }),
  })

  if (familyQuery.isLoading) {
    return (
      <div className="flex h-24 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const group = familyQuery.data
  const isHead = group?.headOfFamily.id === patient.id
  const otherMembers = (group?.members ?? []).filter((m) => m.id !== patient.id)
  const hasFamily = otherMembers.length > 0

  return (
    <div className="space-y-4">
      {hasFamily && group ? (
        <div className="rounded-lg border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-medium text-foreground">{isHead ? 'Head of family' : 'Family group'}</p>
            {!isHead && canUpdate && (
              <Button variant="ghost" size="sm" onClick={() => unlinkMutation.mutate()} disabled={unlinkMutation.isPending}>
                {unlinkMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                Remove from family
              </Button>
            )}
          </div>
          <ul className="divide-y">
            <li className="flex items-center gap-3 py-2 text-sm">
              <Users className="h-4 w-4 text-primary" />
              <div>
                <Link href={`/dashboard/patients/${group.headOfFamily.id}`} className="font-medium hover:underline">
                  {group.headOfFamily.fullName}
                </Link>
                <span className="ml-2 text-xs text-muted-foreground">Head of family</span>
              </div>
            </li>
            {otherMembers.map((m) => (
              <li key={m.id} className="flex items-center gap-3 py-2 text-sm">
                <User className="h-4 w-4 text-muted-foreground" />
                <Link href={`/dashboard/patients/${m.id}`} className="hover:underline">
                  {m.fullName}
                </Link>
                <span className="font-mono text-xs text-muted-foreground">{m.uhid}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
          This patient isn&apos;t linked to a family group yet.
        </p>
      )}

      {canUpdate && isHead && !hasFamily && !linking && (
        <Button variant="outline" size="sm" onClick={() => setLinking(true)}>
          <Plus className="h-3.5 w-3.5" />
          Link to a family
        </Button>
      )}

      {canUpdate && isHead && !hasFamily && linking && (
        <div className="space-y-2 rounded-lg border bg-card p-4">
          <p className="text-sm font-medium">Link this patient under a head of family</p>
          <PatientSearchPicker excludeId={patient.id} selected={headCandidate} onSelect={setHeadCandidate} />
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => { setLinking(false); setHeadCandidate(null) }}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={!headCandidate || linkMutation.isPending}
              onClick={() => headCandidate && linkMutation.mutate(headCandidate.id)}
            >
              {linkMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Link
            </Button>
          </div>
        </div>
      )}
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
