'use client'

import type { IntakeOutputRecord, NursingAssessment, NursingNote } from '@medicore/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Loader2, Plus } from 'lucide-react'
import { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { StatusBadge, type StatusTone } from '@/components/ui/status-badge'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import {
  createIntakeOutput,
  createNursingAssessment,
  createNursingNote,
  listIntakeOutput,
  listNursingAssessments,
  listNursingNotes,
} from '@/lib/api/nursing'

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

/**
 * A risk *level* reads the opposite way "LOW"/"HIGH" do as clinical lab
 * flags (where LOW/HIGH mean an abnormal value, i.e. danger) - so this is
 * exactly the sanctioned `tone` override case, not a shared-map fix.
 */
const RISK_TONE: Record<string, StatusTone> = {
  LOW: 'success',
  MEDIUM: 'warning',
  MODERATE: 'warning',
  HIGH: 'danger',
  SEVERE: 'danger',
}

export function NursingTab({ admissionId, canCreate }: { admissionId: string; canCreate: boolean }) {
  return (
    <div className="space-y-4">
      <NursingNotesSection admissionId={admissionId} canCreate={canCreate} />
      <NursingAssessmentsSection admissionId={admissionId} canCreate={canCreate} />
      <IntakeOutputSection admissionId={admissionId} canCreate={canCreate} />
    </div>
  )
}

function NursingNotesSection({ admissionId, canCreate }: { admissionId: string; canCreate: boolean }) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [type, setType] = useState('GENERAL')
  const [shift, setShift] = useState<string | undefined>(undefined)
  const [content, setContent] = useState('')
  const [isEscalated, setIsEscalated] = useState(false)
  const [escalationReason, setEscalationReason] = useState('')

  const notesQuery = useQuery({
    queryKey: ['ipd', 'nursing-notes', admissionId],
    queryFn: () => listNursingNotes(admissionId, { limit: 50 }),
  })

  const createMutation = useMutation({
    mutationFn: () =>
      createNursingNote(admissionId, {
        type: type as never,
        shift: shift as never,
        content,
        isEscalated,
        escalationReason: isEscalated ? escalationReason || undefined : undefined,
      }),
    onSuccess: () => {
      toast({ title: 'Nursing note added' })
      setOpen(false)
      setContent('')
      setIsEscalated(false)
      setEscalationReason('')
      void queryClient.invalidateQueries({ queryKey: ['ipd', 'nursing-notes', admissionId] })
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Could not add note', description: getErrorMessage(error) }),
  })

  const notes: NursingNote[] = notesQuery.data?.data ?? []

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Nursing notes</h3>
        {canCreate && (
          <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
            <Plus className="h-3.5 w-3.5" />
            New note
          </Button>
        )}
      </div>
      {notes.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">No nursing notes recorded yet.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {notes.map((note) => (
            <li key={note.id} className="rounded-md border p-3 text-sm">
              <div className="flex items-center gap-2">
                <Badge variant="outline">{formatEnumLabel(note.type)}</Badge>
                {note.shift && <Badge variant="secondary">{formatEnumLabel(note.shift)} shift</Badge>}
                {note.isEscalated && (
                  <Badge variant="destructive">
                    <AlertTriangle className="h-3 w-3" /> Escalated
                  </Badge>
                )}
                <span className="ml-auto text-xs text-muted-foreground">{formatDateTime(note.createdAt)}</span>
              </div>
              <p className="mt-1 text-foreground">{note.content}</p>
              {note.isEscalated && note.escalationReason && (
                <p className="mt-1 text-xs text-destructive">Reason: {note.escalationReason}</p>
              )}
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New nursing note</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <Select value={type} onValueChange={setType}>
                <SelectTrigger>
                  <SelectValue placeholder="Note type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="GENERAL">General</SelectItem>
                  <SelectItem value="SHIFT_HANDOVER">Shift handover</SelectItem>
                  <SelectItem value="ASSESSMENT">Assessment</SelectItem>
                  <SelectItem value="INCIDENT">Incident</SelectItem>
                </SelectContent>
              </Select>
              <Select value={shift} onValueChange={setShift}>
                <SelectTrigger>
                  <SelectValue placeholder="Shift (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MORNING">Morning</SelectItem>
                  <SelectItem value="AFTERNOON">Afternoon</SelectItem>
                  <SelectItem value="NIGHT">Night</SelectItem>
                  <SelectItem value="ROTATING">Rotating</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Textarea
              placeholder="Note content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
            />
            <div className="flex items-center gap-2">
              <Checkbox id="escalate" checked={isEscalated} onCheckedChange={(v) => setIsEscalated(v === true)} />
              <Label htmlFor="escalate">Escalate to attending doctor</Label>
            </div>
            {isEscalated && (
              <Input
                placeholder="Escalation reason"
                value={escalationReason}
                onChange={(e) => setEscalationReason(e.target.value)}
              />
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button disabled={!content || createMutation.isPending} onClick={() => createMutation.mutate()}>
              {createMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Save note
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function NursingAssessmentsSection({ admissionId, canCreate }: { admissionId: string; canCreate: boolean }) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [painScore, setPainScore] = useState('')
  const [fallRiskScore, setFallRiskScore] = useState('')
  const [bradenScore, setBradenScore] = useState('')
  const [gcsEye, setGcsEye] = useState('')
  const [gcsVerbal, setGcsVerbal] = useState('')
  const [gcsMotor, setGcsMotor] = useState('')
  const [generalNotes, setGeneralNotes] = useState('')

  const assessmentsQuery = useQuery({
    queryKey: ['ipd', 'nursing-assessments', admissionId],
    queryFn: () => listNursingAssessments(admissionId, { limit: 50 }),
  })

  function resetForm() {
    setPainScore('')
    setFallRiskScore('')
    setBradenScore('')
    setGcsEye('')
    setGcsVerbal('')
    setGcsMotor('')
    setGeneralNotes('')
  }

  const createMutation = useMutation({
    mutationFn: () =>
      createNursingAssessment(admissionId, {
        painScore: painScore ? Number(painScore) : undefined,
        fallRiskScore: fallRiskScore ? Number(fallRiskScore) : undefined,
        bradenScore: bradenScore ? Number(bradenScore) : undefined,
        gcsEye: gcsEye ? Number(gcsEye) : undefined,
        gcsVerbal: gcsVerbal ? Number(gcsVerbal) : undefined,
        gcsMotor: gcsMotor ? Number(gcsMotor) : undefined,
        generalNotes: generalNotes || undefined,
      }),
    onSuccess: () => {
      toast({ title: 'Assessment recorded' })
      setOpen(false)
      resetForm()
      void queryClient.invalidateQueries({ queryKey: ['ipd', 'nursing-assessments', admissionId] })
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Could not record assessment', description: getErrorMessage(error) }),
  })

  const assessments: NursingAssessment[] = assessmentsQuery.data?.data ?? []

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Daily assessment - pain, fall risk, Braden, GCS</h3>
        {canCreate && (
          <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
            <Plus className="h-3.5 w-3.5" />
            New assessment
          </Button>
        )}
      </div>
      {assessments.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">No assessments recorded yet.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {assessments.map((a) => (
            <li key={a.id} className="rounded-md border p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                {a.painScore !== null && <Badge variant="outline">Pain {a.painScore}/10</Badge>}
                {a.fallRiskLevel && (
                  <StatusBadge status={a.fallRiskLevel} tone={RISK_TONE[a.fallRiskLevel]} label={`Fall risk: ${formatEnumLabel(a.fallRiskLevel)}`} />
                )}
                {a.bradenRiskLevel && (
                  <StatusBadge status={a.bradenRiskLevel} tone={RISK_TONE[a.bradenRiskLevel]} label={`Pressure ulcer: ${formatEnumLabel(a.bradenRiskLevel)}`} />
                )}
                {a.gcsTotal !== null && <Badge variant="outline">GCS {a.gcsTotal}/15</Badge>}
                <span className="ml-auto text-xs text-muted-foreground">{formatDateTime(a.assessedAt)}</span>
              </div>
              {a.generalNotes && <p className="mt-1 text-foreground">{a.generalNotes}</p>}
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New assessment</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-xs">Pain score (0-10)</Label>
                <Input type="number" min={0} max={10} value={painScore} onChange={(e) => setPainScore(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Fall risk score</Label>
                <Input type="number" min={0} max={125} value={fallRiskScore} onChange={(e) => setFallRiskScore(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Braden score (6-23)</Label>
                <Input type="number" min={6} max={23} value={bradenScore} onChange={(e) => setBradenScore(e.target.value)} />
              </div>
            </div>
            <div>
              <Label className="text-xs">Glasgow Coma Scale</Label>
              <div className="grid grid-cols-3 gap-2">
                <Input type="number" min={1} max={4} placeholder="Eye (1-4)" value={gcsEye} onChange={(e) => setGcsEye(e.target.value)} />
                <Input
                  type="number"
                  min={1}
                  max={5}
                  placeholder="Verbal (1-5)"
                  value={gcsVerbal}
                  onChange={(e) => setGcsVerbal(e.target.value)}
                />
                <Input
                  type="number"
                  min={1}
                  max={6}
                  placeholder="Motor (1-6)"
                  value={gcsMotor}
                  onChange={(e) => setGcsMotor(e.target.value)}
                />
              </div>
            </div>
            <Textarea placeholder="General notes" value={generalNotes} onChange={(e) => setGeneralNotes(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button disabled={createMutation.isPending} onClick={() => createMutation.mutate()}>
              {createMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Save assessment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function IntakeOutputSection({ admissionId, canCreate }: { admissionId: string; canCreate: boolean }) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [fields, setFields] = useState({
    oralIntakeMl: '',
    ivFluidIntakeMl: '',
    otherIntakeMl: '',
    urineOutputMl: '',
    stoolOutputCount: '',
    vomitusMl: '',
    drainOutputMl: '',
    otherOutputMl: '',
  })
  const [notes, setNotes] = useState('')

  const recordsQuery = useQuery({
    queryKey: ['ipd', 'intake-output', admissionId],
    queryFn: () => listIntakeOutput(admissionId, { limit: 50 }),
  })

  function setField(key: keyof typeof fields, value: string) {
    setFields((prev) => ({ ...prev, [key]: value }))
  }

  const createMutation = useMutation({
    mutationFn: () =>
      createIntakeOutput(admissionId, {
        oralIntakeMl: fields.oralIntakeMl ? Number(fields.oralIntakeMl) : undefined,
        ivFluidIntakeMl: fields.ivFluidIntakeMl ? Number(fields.ivFluidIntakeMl) : undefined,
        otherIntakeMl: fields.otherIntakeMl ? Number(fields.otherIntakeMl) : undefined,
        urineOutputMl: fields.urineOutputMl ? Number(fields.urineOutputMl) : undefined,
        stoolOutputCount: fields.stoolOutputCount ? Number(fields.stoolOutputCount) : undefined,
        vomitusMl: fields.vomitusMl ? Number(fields.vomitusMl) : undefined,
        drainOutputMl: fields.drainOutputMl ? Number(fields.drainOutputMl) : undefined,
        otherOutputMl: fields.otherOutputMl ? Number(fields.otherOutputMl) : undefined,
        notes: notes || undefined,
      }),
    onSuccess: () => {
      toast({ title: 'Intake/output recorded' })
      setOpen(false)
      setFields({
        oralIntakeMl: '',
        ivFluidIntakeMl: '',
        otherIntakeMl: '',
        urineOutputMl: '',
        stoolOutputCount: '',
        vomitusMl: '',
        drainOutputMl: '',
        otherOutputMl: '',
      })
      setNotes('')
      void queryClient.invalidateQueries({ queryKey: ['ipd', 'intake-output', admissionId] })
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Could not record chart entry', description: getErrorMessage(error) }),
  })

  const records: IntakeOutputRecord[] = recordsQuery.data?.data ?? []

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Intake / Output chart</h3>
        {canCreate && (
          <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
            <Plus className="h-3.5 w-3.5" />
            New entry
          </Button>
        )}
      </div>
      {records.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">No intake/output entries recorded yet.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {records.map((r) => (
            <li key={r.id} className="rounded-md border p-3 text-sm">
              <div className="flex items-center gap-3">
                <span className="text-foreground">In: {r.totalIntakeMl}ml</span>
                <span className="text-foreground">Out: {r.totalOutputMl}ml</span>
                <Badge variant={r.balanceMl >= 0 ? 'success' : 'destructive'}>Balance: {r.balanceMl}ml</Badge>
                <span className="ml-auto text-xs text-muted-foreground">{formatDateTime(r.recordedAt)}</span>
              </div>
              {r.notes && <p className="mt-1 text-muted-foreground">{r.notes}</p>}
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New intake/output entry</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs font-semibold">Intake (ml)</Label>
              <div className="mt-1 grid grid-cols-3 gap-2">
                <Input placeholder="Oral" type="number" value={fields.oralIntakeMl} onChange={(e) => setField('oralIntakeMl', e.target.value)} />
                <Input placeholder="IV fluid" type="number" value={fields.ivFluidIntakeMl} onChange={(e) => setField('ivFluidIntakeMl', e.target.value)} />
                <Input placeholder="Other" type="number" value={fields.otherIntakeMl} onChange={(e) => setField('otherIntakeMl', e.target.value)} />
              </div>
            </div>
            <div>
              <Label className="text-xs font-semibold">Output</Label>
              <div className="mt-1 grid grid-cols-2 gap-2">
                <Input placeholder="Urine (ml)" type="number" value={fields.urineOutputMl} onChange={(e) => setField('urineOutputMl', e.target.value)} />
                <Input placeholder="Stool (count)" type="number" value={fields.stoolOutputCount} onChange={(e) => setField('stoolOutputCount', e.target.value)} />
                <Input placeholder="Vomitus (ml)" type="number" value={fields.vomitusMl} onChange={(e) => setField('vomitusMl', e.target.value)} />
                <Input placeholder="Drain (ml)" type="number" value={fields.drainOutputMl} onChange={(e) => setField('drainOutputMl', e.target.value)} />
                <Input placeholder="Other (ml)" type="number" value={fields.otherOutputMl} onChange={(e) => setField('otherOutputMl', e.target.value)} />
              </div>
            </div>
            <Textarea placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button disabled={createMutation.isPending} onClick={() => createMutation.mutate()}>
              {createMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Save entry
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
