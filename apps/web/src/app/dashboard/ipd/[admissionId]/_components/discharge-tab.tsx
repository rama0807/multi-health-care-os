'use client'

import {
  AdmissionStatus,
  DISCHARGE_CHECKLIST_LABELS,
  type AdmissionWithDetails,
  type DischargeChecklistItemKey,
} from '@medicore/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, FileDown, Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'

import { AiAssistButton } from '@/components/ai/ai-assist-button'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import {
  approveDischarge,
  completeDischarge,
  downloadDischargeSummaryPdf,
  getDischargeSummary,
  listDischargeChecklist,
  updateDischargeChecklistItem,
  upsertDischargeSummary,
} from '@/lib/api/discharge'

function getErrorMessage(error: unknown): string {
  const axiosError = error as { response?: { data?: { error?: { message?: string } } } }
  return axiosError?.response?.data?.error?.message ?? 'Something went wrong. Please try again.'
}

export function DischargeTab({
  admission,
  canApprove,
  canUpdateChecklist,
  canFinalize,
  onDischarged,
}: {
  admission: AdmissionWithDetails
  canApprove: boolean
  canUpdateChecklist: boolean
  canFinalize: boolean
  onDischarged: () => void
}) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const admissionId = admission.id
  const isDischarged = admission.status === AdmissionStatus.DISCHARGED
  const isApproved = !!admission.dischargeApprovedAt

  const [dischargeCondition, setDischargeCondition] = useState('')

  const checklistQuery = useQuery({
    queryKey: ['ipd', 'discharge-checklist', admissionId],
    queryFn: () => listDischargeChecklist(admissionId),
    enabled: isApproved,
  })

  const summaryQuery = useQuery({
    queryKey: ['ipd', 'discharge-summary', admissionId],
    queryFn: () => getDischargeSummary(admissionId),
    enabled: isApproved,
  })

  const [finalDiagnosis, setFinalDiagnosis] = useState('')
  const [courseInHospital, setCourseInHospital] = useState('')
  const [conditionAtDischarge, setConditionAtDischarge] = useState('')
  const [medicationReconciliation, setMedicationReconciliation] = useState('')
  const [followUpInstructions, setFollowUpInstructions] = useState('')
  const [dischargeNotes, setDischargeNotes] = useState('')

  useEffect(() => {
    if (summaryQuery.data) {
      setFinalDiagnosis(summaryQuery.data.finalDiagnosis)
      setCourseInHospital(summaryQuery.data.courseInHospital ?? '')
      setConditionAtDischarge(summaryQuery.data.conditionAtDischarge ?? '')
      setMedicationReconciliation(summaryQuery.data.medicationReconciliation ?? '')
      setFollowUpInstructions(summaryQuery.data.followUpInstructions ?? '')
    }
  }, [summaryQuery.data])

  function invalidateAll() {
    void queryClient.invalidateQueries({ queryKey: ['ipd', 'discharge-checklist', admissionId] })
    void queryClient.invalidateQueries({ queryKey: ['ipd', 'discharge-summary', admissionId] })
    void queryClient.invalidateQueries({ queryKey: ['ipd', 'admissions', 'detail', admissionId] })
    void queryClient.invalidateQueries({ queryKey: ['ipd', 'dashboard-stats'] })
  }

  const approveMutation = useMutation({
    mutationFn: () => approveDischarge(admissionId, { dischargeCondition: dischargeCondition || undefined }),
    onSuccess: () => {
      toast({ title: 'Discharge approved — nursing checklist created' })
      invalidateAll()
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Could not approve discharge', description: getErrorMessage(error) }),
  })

  const checklistMutation = useMutation({
    mutationFn: ({ itemKey, completed }: { itemKey: DischargeChecklistItemKey; completed: boolean }) =>
      updateDischargeChecklistItem(admissionId, itemKey, { completed }),
    onSuccess: invalidateAll,
    onError: (error) => toast({ variant: 'destructive', title: 'Could not update checklist', description: getErrorMessage(error) }),
  })

  const summaryMutation = useMutation({
    mutationFn: () =>
      upsertDischargeSummary(admissionId, {
        finalDiagnosis,
        courseInHospital: courseInHospital || undefined,
        conditionAtDischarge: conditionAtDischarge || undefined,
        medicationReconciliation: medicationReconciliation || undefined,
        followUpInstructions: followUpInstructions || undefined,
      }),
    onSuccess: () => {
      toast({ title: 'Discharge summary saved' })
      invalidateAll()
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Could not save summary', description: getErrorMessage(error) }),
  })

  const completeMutation = useMutation({
    mutationFn: () => completeDischarge(admissionId, { dischargeNotes: dischargeNotes || undefined }),
    onSuccess: () => {
      toast({ title: 'Patient discharged — bed vacated' })
      invalidateAll()
      onDischarged()
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Could not finalize discharge', description: getErrorMessage(error) }),
  })

  const checklist = checklistQuery.data ?? []
  const allComplete = checklist.length > 0 && checklist.every((i) => i.completed)

  if (isDischarged) {
    return (
      <div className="rounded-lg border bg-card p-4">
        <div className="flex items-center gap-2">
          <Badge variant="secondary">Discharged</Badge>
          <span className="text-sm text-muted-foreground">
            {admission.dischargedAt && new Date(admission.dischargedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
          </span>
        </div>
        {admission.dischargeNotes && <p className="mt-2 text-sm text-foreground">{admission.dischargeNotes}</p>}
        <Button
          className="mt-3"
          size="sm"
          variant="outline"
          onClick={() => void downloadDischargeSummaryPdf(admissionId, admission.admissionNumber)}
        >
          <FileDown className="h-3.5 w-3.5" />
          Download discharge summary PDF
        </Button>
      </div>
    )
  }

  if (!isApproved) {
    return (
      <div className="rounded-lg border bg-card p-4">
        <h3 className="text-sm font-semibold text-foreground">Doctor discharge approval</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Approving discharge seeds the nursing discharge checklist and unlocks the discharge summary.
        </p>
        {canApprove ? (
          <div className="mt-3 space-y-2">
            <Input
              placeholder="Discharge condition (optional)"
              value={dischargeCondition}
              onChange={(e) => setDischargeCondition(e.target.value)}
            />
            <Button disabled={approveMutation.isPending} onClick={() => approveMutation.mutate()}>
              {approveMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Approve discharge
            </Button>
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">Only the attending doctor can approve discharge.</p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Nursing discharge checklist</h3>
          <Badge variant={allComplete ? 'success' : 'outline'}>
            {checklist.filter((i) => i.completed).length}/{checklist.length} complete
          </Badge>
        </div>
        <ul className="mt-3 space-y-2">
          {checklist.map((item) => (
            <li key={item.id} className="flex items-center gap-2">
              <Checkbox
                id={item.id}
                checked={item.completed}
                disabled={!canUpdateChecklist || checklistMutation.isPending}
                onCheckedChange={(v) => checklistMutation.mutate({ itemKey: item.itemKey, completed: v === true })}
              />
              <Label htmlFor={item.id} className="text-sm font-normal">
                {DISCHARGE_CHECKLIST_LABELS[item.itemKey]}
              </Label>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-lg border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-foreground">Discharge summary</h3>
          {/* Drafts the narrative into "Course in hospital" for the clinician to
              edit — it is never saved without an explicit Save action below. */}
          <AiAssistButton
            feature="DISCHARGE_SUMMARY"
            contextRefs={{ admissionId }}
            label="AI draft"
            onAccept={setCourseInHospital}
            acceptLabel="Use as hospital course"
          />
        </div>
        <div className="mt-3 space-y-2">
          <div>
            <Label className="text-xs">Final diagnosis *</Label>
            <Input value={finalDiagnosis} onChange={(e) => setFinalDiagnosis(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Course in hospital</Label>
            <Textarea value={courseInHospital} onChange={(e) => setCourseInHospital(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Condition at discharge</Label>
            <Input value={conditionAtDischarge} onChange={(e) => setConditionAtDischarge(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Medication reconciliation</Label>
            <Textarea value={medicationReconciliation} onChange={(e) => setMedicationReconciliation(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Follow-up instructions</Label>
            <Textarea value={followUpInstructions} onChange={(e) => setFollowUpInstructions(e.target.value)} />
          </div>
          <Button disabled={!finalDiagnosis || summaryMutation.isPending} onClick={() => summaryMutation.mutate()}>
            {summaryMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Save summary
          </Button>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-4">
        <h3 className="text-sm font-semibold text-foreground">Finalize discharge</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Vacates the bed, raises the room charge, closes the encounter, and completes the admission.
        </p>
        <Textarea
          className="mt-2"
          placeholder="Discharge notes (optional)"
          value={dischargeNotes}
          onChange={(e) => setDischargeNotes(e.target.value)}
        />
        {canFinalize ? (
          <Button
            className="mt-2"
            disabled={!allComplete || !summaryQuery.data || completeMutation.isPending}
            onClick={() => completeMutation.mutate()}
          >
            {completeMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            Complete discharge
          </Button>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">Only the attending doctor can finalize discharge.</p>
        )}
      </div>
    </div>
  )
}
