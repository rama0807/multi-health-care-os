'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { CreateDoctorSchema, DoctorAvailabilityStatus, type CreateDoctorDto } from '@medicore/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useForm, type FieldPath } from 'react-hook-form'

import { PageLayout } from '@/components/layout/page-layout'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { createDoctor } from '@/lib/api/doctors'
import { listDepartments, listHospitals } from '@/lib/api/hospitals'
import { cn } from '@/lib/utils'

const DRAFT_KEY = 'medicore:new-doctor-draft'

const DEFAULT_VALUES: CreateDoctorDto = {
  email: '',
  firstName: '',
  lastName: '',
  phone: undefined,
  registrationNumber: '',
  specialization: '',
  subSpecialization: undefined,
  qualification: '',
  experienceYears: 0,
  languagesSpoken: [],
  bio: undefined,
  consultationFee: 0,
  availabilityStatus: DoctorAvailabilityStatus.AVAILABLE,
  joiningDate: '',
  hospitalId: '',
  departmentId: undefined,
}

const STEPS: Array<{ id: string; title: string; fields: Array<FieldPath<CreateDoctorDto>> }> = [
  {
    id: 'account',
    title: 'Account',
    fields: ['firstName', 'lastName', 'email', 'phone'],
  },
  {
    id: 'professional',
    title: 'Professional Information',
    fields: [
      'registrationNumber',
      'specialization',
      'subSpecialization',
      'qualification',
      'experienceYears',
      'languagesSpoken',
      'bio',
      'consultationFee',
      'joiningDate',
      'hospitalId',
      'departmentId',
      'availabilityStatus',
    ],
  },
  { id: 'review', title: 'Review & Submit', fields: [] },
]

function getErrorMessage(error: unknown): string {
  const axiosError = error as { response?: { data?: { error?: { message?: string } } } }
  return axiosError?.response?.data?.error?.message ?? 'Something went wrong. Please try again.'
}

function formatEnumLabel(value: string): string {
  return value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, ' ')
}

export default function NewDoctorPage() {
  const router = useRouter()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [step, setStep] = useState(0)
  const [draftRestored, setDraftRestored] = useState(false)

  const form = useForm<CreateDoctorDto>({
    resolver: zodResolver(CreateDoctorSchema),
    defaultValues: DEFAULT_VALUES,
    mode: 'onTouched',
  })

  const hospitalId = form.watch('hospitalId')
  const hospitalsQuery = useQuery({ queryKey: ['hospitals'], queryFn: listHospitals })
  const departmentsQuery = useQuery({
    queryKey: ['departments', hospitalId],
    queryFn: () => listDepartments(hospitalId || undefined),
    enabled: Boolean(hospitalId),
  })

  // Restore an in-progress draft once, on mount.
  useEffect(() => {
    const raw = window.localStorage.getItem(DRAFT_KEY)
    if (!raw) return
    try {
      const draft = JSON.parse(raw) as CreateDoctorDto
      form.reset(draft)
      setDraftRestored(true)
    } catch {
      window.localStorage.removeItem(DRAFT_KEY)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Debounced autosave of the whole form to localStorage.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const subscription = form.watch((value) => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        window.localStorage.setItem(DRAFT_KEY, JSON.stringify(value))
      }, 500)
    })
    return () => {
      clearTimeout(timer)
      subscription.unsubscribe()
    }
  }, [form])

  const createMutation = useMutation({
    mutationFn: createDoctor,
    onSuccess: (doctor) => {
      window.localStorage.removeItem(DRAFT_KEY)
      void queryClient.invalidateQueries({ queryKey: ['doctors'] })
      toast({ title: 'Doctor registered', description: `Dr. ${doctor.fullName} was added successfully` })
      router.push(`/dashboard/doctors/${doctor.id}`)
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Registration failed', description: getErrorMessage(error) })
    },
  })

  async function handleNext() {
    const valid = await form.trigger(STEPS[step].fields)
    if (valid) setStep((s) => Math.min(s + 1, STEPS.length - 1))
  }

  function handleBack() {
    setStep((s) => Math.max(s - 1, 0))
  }

  function discardDraft() {
    window.localStorage.removeItem(DRAFT_KEY)
    form.reset(DEFAULT_VALUES)
    setDraftRestored(false)
    setStep(0)
  }

  function onSubmit(values: CreateDoctorDto) {
    createMutation.mutate(values)
  }

  return (
    <PageLayout
      breadcrumbs={[{ label: 'Doctors', href: '/dashboard/doctors' }, { label: 'New' }]}
      title="Register new doctor"
      description={`Step ${step + 1} of ${STEPS.length} — ${STEPS[step].title}`}
      width="narrow"
    >
      {draftRestored && (
        <Alert>
          <AlertTitle>Draft restored</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-3">
            <span>We picked up where you left off.</span>
            <Button variant="ghost" size="sm" onClick={discardDraft} type="button">
              Discard draft
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <Steps current={step} />

      <Form {...form}>
        <form onSubmit={(e) => void form.handleSubmit(onSubmit)(e)} className="space-y-6">
          {step === 0 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First name</FormLabel>
                      <FormControl>
                        <Input {...field} />
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
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone (optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="10-digit mobile number" maxLength={10} {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <p className="text-xs text-muted-foreground">
                A login account is created automatically. If this email already has a MediCore account, the
                Doctor role is added to it instead of creating a duplicate.
              </p>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
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
                            <SelectValue placeholder="Select hospital" />
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
                      <FormLabel>Department (optional)</FormLabel>
                      <Select
                        value={field.value ?? ''}
                        onValueChange={field.onChange}
                        disabled={!hospitalId}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select department" />
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
                    <FormLabel>Medical registration number</FormLabel>
                    <FormControl>
                      <Input {...field} />
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
                        <Input {...field} />
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
                      <FormLabel>Sub-specialization (optional)</FormLabel>
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
                      <Input placeholder="e.g. MBBS, MD (Cardiology)" {...field} />
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
                        <Input type="date" max={new Date().toISOString().slice(0, 10)} {...field} />
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
                        placeholder="English, Hindi, Marathi"
                        value={field.value.join(', ')}
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
                    <FormLabel>Biography (optional)</FormLabel>
                    <FormControl>
                      <Textarea rows={4} {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          )}

          {step === 2 && (
            <ReviewSummary
              values={form.getValues()}
              hospitalName={hospitalsQuery.data?.find((h) => h.id === form.getValues('hospitalId'))?.name}
              departmentName={departmentsQuery.data?.find((d) => d.id === form.getValues('departmentId'))?.name}
            />
          )}

          <div className="flex items-center justify-between border-t pt-4">
            <Button type="button" variant="outline" onClick={handleBack} disabled={step === 0}>
              Back
            </Button>
            {step < STEPS.length - 1 ? (
              <Button type="button" onClick={() => void handleNext()}>
                Next
              </Button>
            ) : (
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? <Loader2 className="animate-spin" /> : <Check />}
                Register Doctor
              </Button>
            )}
          </div>
        </form>
      </Form>
    </PageLayout>
  )
}

function Steps({ current }: { current: number }) {
  return (
    <ol className="flex items-center gap-2">
      {STEPS.map((s, i) => (
        <li key={s.id} className="flex flex-1 items-center gap-2">
          <div
            className={cn(
              'flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-medium',
              i < current
                ? 'bg-primary text-primary-foreground'
                : i === current
                  ? 'border-2 border-primary text-primary'
                  : 'border text-muted-foreground',
            )}
          >
            {i < current ? <Check className="h-3.5 w-3.5" /> : i + 1}
          </div>
          {i < STEPS.length - 1 && <div className={cn('h-px flex-1', i < current ? 'bg-primary' : 'bg-border')} />}
        </li>
      ))}
    </ol>
  )
}

function ReviewSummary({
  values,
  hospitalName,
  departmentName,
}: {
  values: CreateDoctorDto
  hospitalName?: string
  departmentName?: string
}) {
  const rows: Array<[string, string]> = [
    ['Name', `Dr. ${values.firstName} ${values.lastName}`],
    ['Email', values.email],
    ['Phone', values.phone ?? '—'],
    ['Registration No.', values.registrationNumber],
    ['Specialization', values.specialization],
    ['Sub-specialization', values.subSpecialization ?? '—'],
    ['Qualification', values.qualification],
    ['Experience', `${values.experienceYears} years`],
    ['Languages', values.languagesSpoken.join(', ') || '—'],
    ['Consultation fee', `₹${values.consultationFee}`],
    ['Joining date', values.joiningDate],
    ['Hospital', hospitalName ?? '—'],
    ['Department', departmentName ?? '—'],
    ['Availability', values.availabilityStatus],
  ]

  return (
    <div className="rounded-lg border bg-card p-4">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="font-medium text-foreground">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
