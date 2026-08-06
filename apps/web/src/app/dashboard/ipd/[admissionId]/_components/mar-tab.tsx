'use client'

import {
  MedicationAdministrationStatus,
  type MedicationAdministrationWithDetails,
  type PrescriptionWithItems,
} from '@medicore/types'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertCircle, Loader2, Plus, ScanLine } from 'lucide-react'
import { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { StatusBadge } from '@/components/ui/status-badge'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import {
  administerDose,
  createAdHocDose,
  generateScheduledDoses,
  listMedicationAdministrations,
  markDoseDelayed,
  markDoseHeld,
  markDoseMissed,
  markDoseRefused,
} from '@/lib/api/mar'
import { getPrescription, listPrescriptions } from '@/lib/api/prescriptions'

function getErrorMessage(error: unknown): string {
  const axiosError = error as { response?: { data?: { error?: { message?: string } } } }
  return axiosError?.response?.data?.error?.message ?? 'Something went wrong. Please try again.'
}

function formatDateTime(value: string | Date): string {
  return new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
}

function formatEnumLabel(value: string): string {
  return value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, ' ')
}

function useEncounterMedications(encounterId: string | null) {
  const prescriptionsQuery = useQuery({
    queryKey: ['prescriptions', 'active', encounterId],
    queryFn: () => listPrescriptions({ encounterId: encounterId ?? undefined, status: 'ACTIVE' as never, limit: 20 }),
    enabled: !!encounterId,
  })

  const prescriptionIds = (prescriptionsQuery.data?.data ?? []).map((p) => p.id)

  const itemsQuery = useQuery({
    queryKey: ['prescriptions', 'items', prescriptionIds],
    queryFn: async () => {
      const details: PrescriptionWithItems[] = await Promise.all(prescriptionIds.map((id) => getPrescription(id)))
      return details.flatMap((p) => p.items.map((item) => ({ ...item, prescriptionNumber: p.prescriptionNumber })))
    },
    enabled: prescriptionIds.length > 0,
  })

  return itemsQuery.data ?? []
}

export function MarTab({
  admissionId,
  encounterId,
  canAdminister,
}: {
  admissionId: string
  encounterId: string | null
  canAdminister: boolean
}) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [adHocOpen, setAdHocOpen] = useState(false)
  const [actionDose, setActionDose] = useState<{ dose: MedicationAdministrationWithDetails; action: 'administer' | 'missed' | 'refused' | 'held' | 'delayed' } | null>(null)

  const medications = useEncounterMedications(encounterId)

  const marQuery = useQuery({
    queryKey: ['ipd', 'mar', admissionId],
    queryFn: () => listMedicationAdministrations(admissionId, { limit: 100 }),
  })

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ['ipd', 'mar', admissionId] })
  }

  const doses: MedicationAdministrationWithDetails[] = marQuery.data?.data ?? []

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Medication Administration Record</h3>
        {canAdminister && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setAdHocOpen(true)}>
              <Plus className="h-3.5 w-3.5" />
              PRN / STAT dose
            </Button>
            <Button size="sm" variant="outline" onClick={() => setScheduleOpen(true)}>
              <Plus className="h-3.5 w-3.5" />
              Schedule doses
            </Button>
          </div>
        )}
      </div>

      {doses.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">No medications scheduled or administered yet.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {doses.map((d) => (
            <li key={d.id} className="rounded-md border p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{formatEnumLabel(d.type)}</Badge>
                <StatusBadge status={d.status} />
                {d.barcodeVerified && (
                  <Badge variant="secondary">
                    <ScanLine className="h-3 w-3" /> Barcode verified
                  </Badge>
                )}
                <span className="ml-auto text-xs text-muted-foreground">Due {formatDateTime(d.scheduledAt)}</span>
              </div>
              <p className="mt-1 font-medium text-foreground">
                {d.prescriptionItem.medicationName} — {d.prescriptionItem.dosage} · {d.prescriptionItem.frequency}
              </p>
              {d.administeredAt && (
                <p className="text-xs text-muted-foreground">
                  Administered {formatDateTime(d.administeredAt)} by {d.nurseSignature ?? d.administeredByUserId}
                </p>
              )}
              {d.notes && <p className="text-xs text-muted-foreground">{d.notes}</p>}
              {d.status === MedicationAdministrationStatus.PENDING && canAdminister && (
                <div className="mt-2 flex flex-wrap gap-1">
                  <Button size="sm" onClick={() => setActionDose({ dose: d, action: 'administer' })}>
                    Administer
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setActionDose({ dose: d, action: 'missed' })}>
                    Missed
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setActionDose({ dose: d, action: 'refused' })}>
                    Refused
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setActionDose({ dose: d, action: 'held' })}>
                    Held
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setActionDose({ dose: d, action: 'delayed' })}>
                    Delayed
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <ScheduleDosesDialog
        open={scheduleOpen}
        onOpenChange={setScheduleOpen}
        medications={medications}
        onSubmit={async (dto) => {
          try {
            const result = await generateScheduledDoses(admissionId, dto)
            toast({ title: `${result.created} dose(s) scheduled` })
            setScheduleOpen(false)
            invalidate()
          } catch (error) {
            toast({ variant: 'destructive', title: 'Could not schedule doses', description: getErrorMessage(error) })
          }
        }}
      />

      <AdHocDoseDialog
        open={adHocOpen}
        onOpenChange={setAdHocOpen}
        medications={medications}
        onSubmit={async (dto) => {
          try {
            await createAdHocDose(admissionId, dto as never)
            toast({ title: 'Dose recorded' })
            setAdHocOpen(false)
            invalidate()
          } catch (error) {
            toast({ variant: 'destructive', title: 'Could not record dose', description: getErrorMessage(error) })
          }
        }}
      />

      {actionDose && (
        <DoseActionDialog
          dose={actionDose.dose}
          action={actionDose.action}
          onOpenChange={(open) => !open && setActionDose(null)}
          onSubmit={async (payload) => {
            try {
              if (actionDose.action === 'administer') {
                await administerDose(admissionId, actionDose.dose.id, payload as never)
              } else {
                const fn = { missed: markDoseMissed, refused: markDoseRefused, held: markDoseHeld, delayed: markDoseDelayed }[
                  actionDose.action
                ]
                await fn(admissionId, actionDose.dose.id, payload as never)
              }
              toast({ title: 'Dose updated' })
              setActionDose(null)
              invalidate()
            } catch (error) {
              toast({ variant: 'destructive', title: 'Could not update dose', description: getErrorMessage(error) })
            }
          }}
        />
      )}
    </div>
  )
}

interface MedicationOption {
  id: string
  medicationName: string
  dosage: string
  route: string
  prescriptionNumber: string
}

function ScheduleDosesDialog({
  open,
  onOpenChange,
  medications,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  medications: MedicationOption[]
  onSubmit: (dto: { prescriptionItemId: string; times: string[]; days: number }) => Promise<void>
}) {
  const [prescriptionItemId, setPrescriptionItemId] = useState('')
  const [timesText, setTimesText] = useState('08:00, 14:00, 20:00')
  const [days, setDays] = useState('3')
  const [submitting, setSubmitting] = useState(false)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Schedule doses</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Select value={prescriptionItemId} onValueChange={setPrescriptionItemId}>
            <SelectTrigger>
              <SelectValue placeholder="Select medication" />
            </SelectTrigger>
            <SelectContent>
              {medications.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.medicationName} {m.dosage} ({m.prescriptionNumber})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div>
            <Label className="text-xs">Times per day (comma-separated, HH:MM)</Label>
            <Input value={timesText} onChange={(e) => setTimesText(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Number of days</Label>
            <Input type="number" min={1} max={30} value={days} onChange={(e) => setDays(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!prescriptionItemId || submitting}
            onClick={() => {
              void (async () => {
                setSubmitting(true)
                await onSubmit({
                  prescriptionItemId,
                  times: timesText.split(',').map((t) => t.trim()),
                  days: Number(days) || 1,
                })
                setSubmitting(false)
              })()
            }}
          >
            {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Schedule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function AdHocDoseDialog({
  open,
  onOpenChange,
  medications,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  medications: MedicationOption[]
  onSubmit: (dto: { prescriptionItemId: string; type: 'PRN' | 'STAT'; notes?: string }) => Promise<void>
}) {
  const [prescriptionItemId, setPrescriptionItemId] = useState('')
  const [type, setType] = useState<'PRN' | 'STAT'>('PRN')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>PRN / STAT dose</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Select value={prescriptionItemId} onValueChange={setPrescriptionItemId}>
            <SelectTrigger>
              <SelectValue placeholder="Select medication" />
            </SelectTrigger>
            <SelectContent>
              {medications.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.medicationName} {m.dosage} ({m.prescriptionNumber})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={type} onValueChange={(v) => setType(v as 'PRN' | 'STAT')}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="PRN">PRN (as needed)</SelectItem>
              <SelectItem value="STAT">STAT (immediate)</SelectItem>
            </SelectContent>
          </Select>
          <Textarea placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!prescriptionItemId || submitting}
            onClick={() => {
              void (async () => {
                setSubmitting(true)
                await onSubmit({ prescriptionItemId, type, notes: notes || undefined })
                setSubmitting(false)
              })()
            }}
          >
            {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Record
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function DoseActionDialog({
  dose,
  action,
  onOpenChange,
  onSubmit,
}: {
  dose: MedicationAdministrationWithDetails
  action: 'administer' | 'missed' | 'refused' | 'held' | 'delayed'
  onOpenChange: (open: boolean) => void
  onSubmit: (payload: {
    doseGiven?: string
    route?: string
    notes?: string
    barcodeVerified: boolean
    scannedCode?: string
    nurseSignature: string
  }) => Promise<void>
}) {
  const [doseGiven, setDoseGiven] = useState(dose.prescriptionItem.dosage)
  const [notes, setNotes] = useState('')
  const [barcodeVerified, setBarcodeVerified] = useState(false)
  const [scannedCode, setScannedCode] = useState('')
  const [nurseSignature, setNurseSignature] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const titles: Record<typeof action, string> = {
    administer: 'Administer dose',
    missed: 'Record missed dose',
    refused: 'Record refused dose',
    held: 'Record held dose',
    delayed: 'Record delayed dose',
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{titles[action]}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {dose.prescriptionItem.medicationName} — {dose.prescriptionItem.dosage}
          </p>
          {action === 'administer' && (
            <>
              <Input placeholder="Dose given" value={doseGiven} onChange={(e) => setDoseGiven(e.target.value)} />
              <div className="flex items-center gap-2">
                <Checkbox id="barcode" checked={barcodeVerified} onCheckedChange={(v) => setBarcodeVerified(v === true)} />
                <Label htmlFor="barcode">Barcode scanned/verified</Label>
              </div>
              {barcodeVerified && (
                <Input placeholder="Scanned code" value={scannedCode} onChange={(e) => setScannedCode(e.target.value)} />
              )}
            </>
          )}
          {action !== 'administer' && (
            <div className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800">
              <AlertCircle className="h-3.5 w-3.5" />
              A reason is required to record this exception.
            </div>
          )}
          <Textarea
            placeholder={action === 'administer' ? 'Notes (optional)' : 'Reason (required)'}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <Input placeholder="Nurse signature (your full name)" value={nurseSignature} onChange={(e) => setNurseSignature(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!nurseSignature || (action !== 'administer' && !notes) || submitting}
            onClick={() => {
              void (async () => {
                setSubmitting(true)
                await onSubmit({
                  doseGiven: action === 'administer' ? doseGiven : undefined,
                  notes: notes || undefined,
                  barcodeVerified,
                  scannedCode: scannedCode || undefined,
                  nurseSignature,
                })
                setSubmitting(false)
              })()
            }}
          >
            {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
