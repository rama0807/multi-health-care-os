'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { DoctorAvailabilityStatus, UpdateDoctorSchema, type UpdateDoctorDto } from '@medicore/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Loader2, Pencil, RotateCcw, Trash2 } from 'lucide-react'
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
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { deactivateDoctor, getDoctor, restoreDoctor, updateDoctor } from '@/lib/api/doctors'
import { listDepartments, listHospitals } from '@/lib/api/hospitals'
import { useAuth } from '@/lib/auth/auth-context'

function getErrorMessage(error: unknown): string {
  const axiosError = error as { response?: { data?: { error?: { message?: string } } } }
  return axiosError?.response?.data?.error?.message ?? 'Something went wrong. Please try again.'
}

function formatEnumLabel(value: string): string {
  return value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, ' ')
}

const AVAILABILITY_BADGE_VARIANT: Record<DoctorAvailabilityStatus, 'success' | 'secondary' | 'destructive'> = {
  [DoctorAvailabilityStatus.AVAILABLE]: 'success',
  [DoctorAvailabilityStatus.ON_LEAVE]: 'secondary',
  [DoctorAvailabilityStatus.UNAVAILABLE]: 'destructive',
}

export default function DoctorDetailPage() {
  const params = useParams<{ id: string }>()
  const doctorId = params.id
  const router = useRouter()
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
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (doctorQuery.isError || !doctorQuery.data) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Doctor not found</AlertTitle>
        <AlertDescription>
          {getErrorMessage(doctorQuery.error)}{' '}
          <Button variant="link" className="h-auto p-0" onClick={() => router.push('/dashboard/doctors')}>
            Back to doctors
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  const doctor = doctorQuery.data

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-foreground">Dr. {doctor.fullName}</h1>
            <Badge variant={doctor.isActive ? 'success' : 'secondary'}>
              {doctor.isActive ? 'Active' : 'Deactivated'}
            </Badge>
            <Badge variant={AVAILABILITY_BADGE_VARIANT[doctor.availabilityStatus]}>
              {formatEnumLabel(doctor.availabilityStatus)}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {doctor.specialization}
            {doctor.subSpecialization ? ` · ${doctor.subSpecialization}` : ''} · {doctor.experienceYears} yrs
            experience
          </p>
          <p className="font-mono text-xs text-muted-foreground">{doctor.registrationNumber}</p>
        </div>
        <div className="flex items-center gap-2">
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
        </div>
      </div>

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="statistics">Statistics</TabsTrigger>
        </TabsList>

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
            note="Full clinical detail is available once the Appointments module ships — these are live counts from this doctor's linked records."
          />
        </TabsContent>
      </Tabs>

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
      ['Sub-specialization', doctor.subSpecialization ?? '—'],
      ['Qualification', doctor.qualification],
      ['Experience', `${doctor.experienceYears} years`],
      ['Languages spoken', doctor.languagesSpoken.join(', ') || '—'],
      ['Consultation fee', `₹${doctor.consultationFee}`],
      ['Joining date', new Date(doctor.joiningDate).toLocaleDateString('en-IN', { dateStyle: 'medium' })],
      ['Hospital', doctor.hospital?.name ?? '—'],
      ['Department', doctor.department?.name ?? '—'],
      ['Email', doctor.email],
      ['Phone', doctor.phone ?? '—'],
      ['Biography', doctor.bio ?? '—'],
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
