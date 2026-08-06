'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { BloodGroup, CreatePatientSchema, Gender, type CreatePatientDto, type DuplicateMatch } from '@medicore/types'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Check, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useForm, type FieldPath } from 'react-hook-form'

import { PageLayout } from '@/components/layout/page-layout'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { checkDuplicatePatients, createPatient } from '@/lib/api/patients'
import { cn } from '@/lib/utils'

const DRAFT_KEY = 'medicore:new-patient-draft'

const DEFAULT_VALUES: CreatePatientDto = {
  firstName: '',
  lastName: '',
  email: undefined,
  phone: '',
  dateOfBirth: '',
  gender: Gender.MALE,
  bloodGroup: undefined,
  address: undefined,
  city: undefined,
  state: undefined,
  pincode: undefined,
  emergencyContactName: undefined,
  emergencyContactPhone: undefined,
}

const STEPS: Array<{ id: string; title: string; fields: Array<FieldPath<CreatePatientDto>> }> = [
  {
    id: 'personal',
    title: 'Personal Information',
    fields: ['firstName', 'lastName', 'dateOfBirth', 'gender', 'bloodGroup'],
  },
  {
    id: 'contact',
    title: 'Contact & Address',
    fields: ['phone', 'email', 'address', 'city', 'state', 'pincode'],
  },
  {
    id: 'emergency',
    title: 'Emergency Contact',
    fields: ['emergencyContactName', 'emergencyContactPhone'],
  },
  { id: 'review', title: 'Review & Submit', fields: [] },
]

function getErrorMessage(error: unknown): string {
  const axiosError = error as { response?: { data?: { error?: { message?: string } } } }
  return axiosError?.response?.data?.error?.message ?? 'Something went wrong. Please try again.'
}

export default function NewPatientPage() {
  const router = useRouter()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [step, setStep] = useState(0)
  const [draftRestored, setDraftRestored] = useState(false)
  const [duplicates, setDuplicates] = useState<DuplicateMatch[]>([])
  const [checkingDuplicates, setCheckingDuplicates] = useState(false)
  const [duplicateConfirmed, setDuplicateConfirmed] = useState(false)

  const form = useForm<CreatePatientDto>({
    resolver: zodResolver(CreatePatientSchema),
    defaultValues: DEFAULT_VALUES,
    mode: 'onTouched',
  })

  // Restore an in-progress draft once, on mount.
  useEffect(() => {
    const raw = window.localStorage.getItem(DRAFT_KEY)
    if (!raw) return
    try {
      const draft = JSON.parse(raw) as CreatePatientDto
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

  // Run a duplicate check once the reviewer reaches the final step.
  useEffect(() => {
    if (step !== STEPS.length - 1) return
    const values = form.getValues()
    if (!values.phone || values.phone.length !== 10) return

    setCheckingDuplicates(true)
    checkDuplicatePatients({
      firstName: values.firstName,
      lastName: values.lastName,
      phone: values.phone,
      dateOfBirth: values.dateOfBirth || undefined,
    })
      .then(setDuplicates)
      .catch(() => setDuplicates([]))
      .finally(() => setCheckingDuplicates(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  const createMutation = useMutation({
    mutationFn: createPatient,
    onSuccess: (patient) => {
      window.localStorage.removeItem(DRAFT_KEY)
      void queryClient.invalidateQueries({ queryKey: ['patients'] })
      toast({ title: 'Patient registered', description: `UHID ${patient.uhid} assigned` })
      router.push(`/dashboard/patients/${patient.id}`)
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

  function onSubmit(values: CreatePatientDto) {
    createMutation.mutate(values)
  }

  const hasBlockingDuplicates = duplicates.some((m) => m.confidence >= 50)
  const canSubmit = !hasBlockingDuplicates || duplicateConfirmed

  return (
    <PageLayout
      breadcrumbs={[{ label: 'Patients', href: '/dashboard/patients' }, { label: 'New' }]}
      title="Register new patient"
      description={`Step ${step + 1} of ${STEPS.length} - ${STEPS[step].title}`}
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
                name="dateOfBirth"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date of birth</FormLabel>
                    <FormControl>
                      <Input type="date" max={new Date().toISOString().slice(0, 10)} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
                              {g.charAt(0) + g.slice(1).toLowerCase()}
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
                      <FormLabel>Blood group (optional)</FormLabel>
                      <Select value={field.value ?? ''} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Unknown" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.values(BloodGroup).map((bg) => (
                            <SelectItem key={bg} value={bg}>
                              {bg.replace('_POSITIVE', '+').replace('_NEGATIVE', '-')}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl>
                        <Input placeholder="10-digit mobile number" maxLength={10} {...field} />
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
                      <FormLabel>Email (optional)</FormLabel>
                      <FormControl>
                        <Input type="email" {...field} value={field.value ?? ''} />
                      </FormControl>
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
                    <FormLabel>Address (optional)</FormLabel>
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
                      <FormLabel>City (optional)</FormLabel>
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
                      <FormLabel>State (optional)</FormLabel>
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
                      <FormLabel>Pincode (optional)</FormLabel>
                      <FormControl>
                        <Input maxLength={6} {...field} value={field.value ?? ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="emergencyContactName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Emergency contact name (optional)</FormLabel>
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
                    <FormLabel>Emergency contact phone (optional)</FormLabel>
                    <FormControl>
                      <Input maxLength={10} {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <ReviewSummary values={form.getValues()} />

              {checkingDuplicates && (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Checking for possible duplicate patients...
                </p>
              )}

              {!checkingDuplicates && duplicates.length > 0 && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Possible duplicate patient{duplicates.length > 1 ? 's' : ''} found</AlertTitle>
                  <AlertDescription className="space-y-2">
                    <ul className="space-y-1">
                      {duplicates.slice(0, 3).map((match) => (
                        <li key={match.patient.id} className="text-sm">
                          {match.patient.fullName} · {match.patient.uhid} · {match.patient.phone} -{' '}
                          {match.confidence}% match
                        </li>
                      ))}
                    </ul>
                    <label className="flex items-center gap-2 text-sm font-normal">
                      <Checkbox
                        checked={duplicateConfirmed}
                        onCheckedChange={(checked) => setDuplicateConfirmed(Boolean(checked))}
                      />
                      I&apos;ve verified this is a genuinely new patient
                    </label>
                  </AlertDescription>
                </Alert>
              )}
            </div>
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
              <Button type="submit" disabled={!canSubmit || createMutation.isPending}>
                {createMutation.isPending ? <Loader2 className="animate-spin" /> : <Check />}
                Register Patient
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

function ReviewSummary({ values }: { values: CreatePatientDto }) {
  const rows: Array<[string, string]> = [
    ['Name', `${values.firstName} ${values.lastName}`],
    ['Date of birth', values.dateOfBirth],
    ['Gender', values.gender],
    ['Blood group', values.bloodGroup ?? '-'],
    ['Phone', values.phone],
    ['Email', values.email ?? '-'],
    ['Address', [values.address, values.city, values.state, values.pincode].filter(Boolean).join(', ') || '-'],
    ['Emergency contact', values.emergencyContactName ?? '-'],
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
