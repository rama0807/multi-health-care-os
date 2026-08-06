'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableContainer, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'
import { createHoliday, deleteHoliday, listHolidays } from '@/lib/api/leave'
import { getOrganizationSettings, updateOrganizationSettings } from '@/lib/api/organization'
import { useAuth } from '@/lib/auth/auth-context'

import { formatDate } from './format'

const WEEKDAYS = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
]

/**
 * Feature flags are free-form on the server (a `Record<string, boolean>`), but
 * the UI offers the set MediCore reads today plus whatever an organization has
 * already stored — so the form never silently drops a flag added by a future
 * module.
 */
const KNOWN_FEATURE_FLAGS = [
  { key: 'teleconsultation', label: 'Teleconsultation' },
  { key: 'aiAssistant', label: 'AI assistant' },
  { key: 'patientPortal', label: 'Patient portal' },
  { key: 'smsNotifications', label: 'SMS notifications' },
]

export function SettingsTab() {
  const { toast } = useToast()
  const { hasPermission } = useAuth()
  const queryClient = useQueryClient()
  const canEdit = hasPermission('organizations.update')
  const canManageHolidays = hasPermission('leave.manage')

  const settingsQuery = useQuery({
    queryKey: ['organization', 'settings'],
    queryFn: getOrganizationSettings,
  })

  const [timezone, setTimezone] = useState('')
  const [currency, setCurrency] = useState('')
  const [currencySymbol, setCurrencySymbol] = useState('')
  const [language, setLanguage] = useState('')
  const [dateFormat, setDateFormat] = useState('')
  const [timeFormat, setTimeFormat] = useState<'12h' | '24h'>('12h')
  const [gstNumber, setGstNumber] = useState('')
  const [gstRate, setGstRate] = useState('')
  const [uhidPrefix, setUhidPrefix] = useState('')
  const [appointmentDuration, setAppointmentDuration] = useState('')
  const [workingDays, setWorkingDays] = useState<number[]>([])
  const [workingHoursStart, setWorkingHoursStart] = useState('')
  const [workingHoursEnd, setWorkingHoursEnd] = useState('')
  const [featureFlags, setFeatureFlags] = useState<Record<string, boolean>>({})

  useEffect(() => {
    const settings = settingsQuery.data
    if (!settings) return
    setTimezone(settings.timezone ?? '')
    setCurrency(settings.currency ?? '')
    setCurrencySymbol(settings.currencySymbol ?? '')
    setLanguage(settings.language ?? 'en-IN')
    setDateFormat(settings.dateFormat ?? '')
    setTimeFormat(settings.timeFormat ?? '12h')
    setGstNumber(settings.gstNumber ?? '')
    setGstRate(String(settings.gstRate ?? ''))
    setUhidPrefix(settings.uhidPrefix ?? '')
    setAppointmentDuration(String(settings.defaultAppointmentDuration ?? ''))
    setWorkingDays(settings.workingDays ?? [])
    setWorkingHoursStart(settings.workingHoursStart ?? '')
    setWorkingHoursEnd(settings.workingHoursEnd ?? '')
    setFeatureFlags(settings.featureFlags ?? {})
  }, [settingsQuery.data])

  const saveMutation = useMutation({
    mutationFn: updateOrganizationSettings,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['organization'] })
      toast({ title: 'Settings saved' })
    },
    onError: (error: { response?: { data?: { message?: string } } }) =>
      toast({
        title: 'Could not save settings',
        description: error.response?.data?.message ?? 'Please check the values and try again.',
        variant: 'destructive',
      }),
  })

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    saveMutation.mutate({
      timezone: timezone.trim() || undefined,
      currency: currency.trim() || undefined,
      currencySymbol: currencySymbol.trim() || undefined,
      language: language.trim() || undefined,
      dateFormat: dateFormat.trim() || undefined,
      timeFormat,
      gstNumber: gstNumber.trim() || undefined,
      gstRate: gstRate === '' ? undefined : Number(gstRate),
      uhidPrefix: uhidPrefix.trim() || undefined,
      defaultAppointmentDuration:
        appointmentDuration === '' ? undefined : Number(appointmentDuration),
      workingDays,
      workingHoursStart: workingHoursStart || undefined,
      workingHoursEnd: workingHoursEnd || undefined,
      featureFlags,
    })
  }

  const flagKeys = [
    ...KNOWN_FEATURE_FLAGS,
    ...Object.keys(featureFlags)
      .filter((key) => !KNOWN_FEATURE_FLAGS.some((f) => f.key === key))
      .map((key) => ({ key, label: key })),
  ]

  return (
    <div className="space-y-4 pt-4">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Locale &amp; currency</CardTitle>
          </CardHeader>
          <CardContent>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Timezone" id="set-timezone">
              <Input
                id="set-timezone"
                value={timezone}
                disabled={!canEdit}
                onChange={(e) => setTimezone(e.target.value)}
                placeholder="Asia/Kolkata"
              />
            </Field>
            <Field label="Language" id="set-language">
              <Input
                id="set-language"
                value={language}
                disabled={!canEdit}
                onChange={(e) => setLanguage(e.target.value)}
                placeholder="en-IN"
              />
            </Field>
            <Field label="Currency (ISO-3)" id="set-currency">
              <Input
                id="set-currency"
                value={currency}
                disabled={!canEdit}
                onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                placeholder="INR"
              />
            </Field>
            <Field label="Currency symbol" id="set-currency-symbol">
              <Input
                id="set-currency-symbol"
                value={currencySymbol}
                disabled={!canEdit}
                onChange={(e) => setCurrencySymbol(e.target.value)}
              />
            </Field>
            <Field label="Date format" id="set-date-format">
              <Input
                id="set-date-format"
                value={dateFormat}
                disabled={!canEdit}
                onChange={(e) => setDateFormat(e.target.value)}
                placeholder="DD/MM/YYYY"
              />
            </Field>
            <Field label="Time format" id="set-time-format">
              <Select
                value={timeFormat}
                disabled={!canEdit}
                onValueChange={(v) => setTimeFormat(v as '12h' | '24h')}
              >
                <SelectTrigger id="set-time-format">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="12h">12-hour</SelectItem>
                  <SelectItem value="24h">24-hour</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tax &amp; records</CardTitle>
          </CardHeader>
          <CardContent>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="GST number" id="set-gst-number">
              <Input
                id="set-gst-number"
                value={gstNumber}
                disabled={!canEdit}
                onChange={(e) => setGstNumber(e.target.value)}
              />
            </Field>
            <Field label="GST rate (%)" id="set-gst-rate">
              <Input
                id="set-gst-rate"
                type="number"
                min={0}
                max={100}
                value={gstRate}
                disabled={!canEdit}
                onChange={(e) => setGstRate(e.target.value)}
              />
            </Field>
            <Field label="UHID prefix" id="set-uhid">
              <Input
                id="set-uhid"
                value={uhidPrefix}
                disabled={!canEdit}
                onChange={(e) => setUhidPrefix(e.target.value.toUpperCase())}
              />
            </Field>
            <Field label="Default appointment (min)" id="set-appt-duration">
              <Input
                id="set-appt-duration"
                type="number"
                min={5}
                max={240}
                value={appointmentDuration}
                disabled={!canEdit}
                onChange={(e) => setAppointmentDuration(e.target.value)}
              />
            </Field>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Changing the UHID prefix affects only newly registered patients — existing UHIDs are
            never rewritten.
          </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Working hours</CardTitle>
          </CardHeader>
          <CardContent>
          <div className="flex flex-wrap gap-3">
            {WEEKDAYS.map((day) => (
              <label key={day.value} className="flex items-center gap-1.5 text-sm">
                <Checkbox
                  checked={workingDays.includes(day.value)}
                  disabled={!canEdit}
                  onCheckedChange={(checked) =>
                    setWorkingDays((prev) =>
                      checked
                        ? [...prev, day.value].sort((a, b) => a - b)
                        : prev.filter((d) => d !== day.value),
                    )
                  }
                />
                {day.label}
              </label>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:w-1/2">
            <Field label="Opens at" id="set-hours-start">
              <Input
                id="set-hours-start"
                type="time"
                value={workingHoursStart}
                disabled={!canEdit}
                onChange={(e) => setWorkingHoursStart(e.target.value)}
              />
            </Field>
            <Field label="Closes at" id="set-hours-end">
              <Input
                id="set-hours-end"
                type="time"
                value={workingHoursEnd}
                disabled={!canEdit}
                onChange={(e) => setWorkingHoursEnd(e.target.value)}
              />
            </Field>
          </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Feature flags</CardTitle>
          </CardHeader>
          <CardContent>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {flagKeys.map((flag) => (
              <label key={flag.key} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={featureFlags[flag.key] ?? false}
                  disabled={!canEdit}
                  onCheckedChange={(checked) =>
                    setFeatureFlags((prev) => ({ ...prev, [flag.key]: checked === true }))
                  }
                />
                {flag.label}
              </label>
            ))}
          </div>
          </CardContent>
        </Card>

        {canEdit ? (
          <div className="flex justify-end">
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Saving…' : 'Save settings'}
            </Button>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">You have read-only access to settings.</p>
        )}
      </form>

      <HolidaysPanel canManage={canManageHolidays} />
    </div>
  )
}

/**
 * Holidays reuse the `Holiday` model and API built in Milestone 14 rather than
 * introducing a second organization-level holiday calendar.
 */
function HolidaysPanel({ canManage }: { canManage: boolean }) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const year = new Date().getFullYear()

  const holidaysQuery = useQuery({
    queryKey: ['organization', 'holidays', year],
    queryFn: () => listHolidays(year),
  })

  const [name, setName] = useState('')
  const [date, setDate] = useState('')

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['organization', 'holidays'] })
  }

  const createMutation = useMutation({
    mutationFn: createHoliday,
    onSuccess: () => {
      invalidate()
      setName('')
      setDate('')
      toast({ title: 'Holiday added' })
    },
    onError: (error: { response?: { data?: { message?: string } } }) =>
      toast({
        title: 'Could not add holiday',
        description: error.response?.data?.message ?? 'A holiday may already exist on that date.',
        variant: 'destructive',
      }),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteHoliday,
    onSuccess: () => {
      invalidate()
      toast({ title: 'Holiday removed' })
    },
  })

  const holidays = holidaysQuery.data ?? []

  return (
    <Card>
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Holiday calendar ({year})</h3>
          <p className="text-xs text-muted-foreground">
            Shared with Staff attendance and leave — the same calendar, not a copy.
          </p>
        </div>
        {canManage && (
          <div className="flex items-end gap-2">
            <div className="space-y-1">
              <Label htmlFor="holiday-name">Name</Label>
              <Input
                id="holiday-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Independence Day"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="holiday-date">Date</Label>
              <Input
                id="holiday-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <Button
              type="button"
              disabled={!name.trim() || !date || createMutation.isPending}
              onClick={() =>
                createMutation.mutate({ name: name.trim(), date, isOptional: false })
              }
            >
              <Plus className="mr-1.5 h-4 w-4" />
              Add
            </Button>
          </div>
        )}
      </div>
      {holidays.length === 0 ? (
        <EmptyState compact title={`No holidays configured for ${year}`} />
      ) : (
        <TableContainer className="rounded-none border-0">
          <Table density="compact" container={false}>
            <TableHeader>
              <TableRow>
                <TableHead>Holiday</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                {canManage && <TableHead align="right" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {holidays.map((holiday) => (
                <TableRow key={holiday.id}>
                  <TableCell className="font-medium">{holiday.name}</TableCell>
                  <TableCell>{formatDate(holiday.date)}</TableCell>
                  <TableCell>{holiday.isOptional ? 'Optional' : 'Mandatory'}</TableCell>
                  {canManage && (
                    <TableCell align="right">
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={`Remove ${holiday.name}`}
                        disabled={deleteMutation.isPending}
                        onClick={() => deleteMutation.mutate(holiday.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Card>
  )
}

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  )
}
