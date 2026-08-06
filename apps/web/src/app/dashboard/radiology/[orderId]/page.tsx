'use client'

import { RadiologyAttachmentType, RadiologyStatus, type CreateRadiologyReportDto } from '@medicore/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  CheckCircle2,
  Download,
  FileImage,
  Loader2,
  Play,
  ShieldCheck,
  Trash2,
  Upload,
} from 'lucide-react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useState } from 'react'

import { PageLayout } from '@/components/layout/page-layout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { PageHeaderMeta } from '@/components/ui/page-header'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { StatusBadge } from '@/components/ui/status-badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { listDoctors } from '@/lib/api/doctors'
import {
  addExternalRadiologyAttachment,
  addRadiologyReportVersion,
  completeRadiologyStudy,
  deleteRadiologyAttachment,
  downloadRadiologyReportPdf,
  getRadiologyOrder,
  releaseRadiologyReport,
  scheduleRadiologyOrder,
  startRadiologyStudy,
  updateRadiologyStatus,
  uploadRadiologyFileAttachment,
  verifyRadiologyReport,
} from '@/lib/api/radiology'
import { useAuth } from '@/lib/auth/auth-context'

function getErrorMessage(error: unknown): string {
  const axiosError = error as { response?: { data?: { error?: { message?: string } } } }
  return axiosError?.response?.data?.error?.message ?? 'Something went wrong. Please try again.'
}

function formatEnumLabel(value: string): string {
  return value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, ' ')
}

export default function RadiologyOrderDetailPage() {
  const params = useParams<{ orderId: string }>()
  const orderId = params.orderId
  const { hasPermission } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const canUpdate = hasPermission('radiology.update')

  const orderQuery = useQuery({ queryKey: ['radiology', 'detail', orderId], queryFn: () => getRadiologyOrder(orderId) })

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ['radiology', 'detail', orderId] })
    void queryClient.invalidateQueries({ queryKey: ['radiology', 'list'] })
  }

  const startMutation = useMutation({
    mutationFn: () => startRadiologyStudy(orderId),
    onSuccess: () => {
      toast({ title: 'Study started' })
      invalidate()
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Could not start study', description: getErrorMessage(error) }),
  })

  const completeMutation = useMutation({
    mutationFn: () => completeRadiologyStudy(orderId),
    onSuccess: () => {
      toast({ title: 'Study completed' })
      invalidate()
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Could not complete study', description: getErrorMessage(error) }),
  })

  const cancelMutation = useMutation({
    mutationFn: () => updateRadiologyStatus(orderId, { status: RadiologyStatus.CANCELLED }),
    onSuccess: () => {
      toast({ title: 'Order cancelled' })
      invalidate()
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Could not cancel order', description: getErrorMessage(error) }),
  })

  const rejectMutation = useMutation({
    mutationFn: (reason: string) => updateRadiologyStatus(orderId, { status: RadiologyStatus.REJECTED, reason }),
    onSuccess: () => {
      toast({ title: 'Order rejected' })
      invalidate()
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Could not reject order', description: getErrorMessage(error) }),
  })

  if (orderQuery.isLoading) {
    return (
      <PageLayout
        breadcrumbs={[{ label: 'Radiology', href: '/dashboard/radiology' }, { label: 'Orders', href: '/dashboard/radiology/orders' }, { label: '…' }]}
        title="…"
        loading
      >
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </PageLayout>
    )
  }

  if (orderQuery.isError || !orderQuery.data) {
    return (
      <PageLayout
        breadcrumbs={[{ label: 'Radiology', href: '/dashboard/radiology' }, { label: 'Orders', href: '/dashboard/radiology/orders' }, { label: 'Not found' }]}
        title="Radiology order not found"
      >
        <EmptyState
          variant="error"
          title="Radiology order not found"
          description={getErrorMessage(orderQuery.error)}
          action={{ label: 'Back to orders', href: '/dashboard/radiology/orders' }}
        />
      </PageLayout>
    )
  }

  const order = orderQuery.data
  const isNonTerminal = ![
    RadiologyStatus.CANCELLED,
    RadiologyStatus.REJECTED,
    RadiologyStatus.REPORTED,
  ].includes(order.status)

  return (
    <Tabs defaultValue={order.status === RadiologyStatus.ORDERED || order.status === RadiologyStatus.SCHEDULED ? 'scheduling' : 'report'}>
      <PageLayout
        breadcrumbs={[
          { label: 'Radiology', href: '/dashboard/radiology' },
          { label: 'Orders', href: '/dashboard/radiology/orders' },
          { label: order.orderNumber },
        ]}
        title={order.orderNumber}
        badge={
          <>
            <StatusBadge status={order.status} />
            <Badge variant="outline">{formatEnumLabel(order.priority)}</Badge>
          </>
        }
        meta={
          <>
            <PageHeaderMeta label="Patient">
              {order.patient.fullName} ({order.patient.uhid})
            </PageHeaderMeta>
            <PageHeaderMeta label="Doctor">
              Dr. {order.doctor.fullName} ({order.doctor.specialization})
            </PageHeaderMeta>
            <PageHeaderMeta label="Study">
              {order.modality} — {order.bodyPart}
            </PageHeaderMeta>
            {order.encounterId && (
              <Link href={`/dashboard/medical-records/${order.encounterId}`} className="text-subtle-foreground hover:underline">
                View originating encounter
              </Link>
            )}
          </>
        }
        actions={
          canUpdate &&
          isNonTerminal && (
            <>
              {order.status === RadiologyStatus.SCHEDULED && (
                <Button size="sm" onClick={() => startMutation.mutate()} disabled={startMutation.isPending}>
                  {startMutation.isPending ? <Loader2 className="animate-spin" /> : <Play />}
                  Start study
                </Button>
              )}
              {order.status === RadiologyStatus.IN_PROGRESS && (
                <Button size="sm" onClick={() => completeMutation.mutate()} disabled={completeMutation.isPending}>
                  {completeMutation.isPending ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
                  Complete study
                </Button>
              )}
              {order.status === RadiologyStatus.ORDERED && (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-destructive"
                  onClick={() => rejectMutation.mutate('Rejected by radiology staff')}
                  disabled={rejectMutation.isPending}
                >
                  Reject
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                className="text-destructive"
                onClick={() => cancelMutation.mutate()}
                disabled={cancelMutation.isPending}
              >
                Cancel
              </Button>
            </>
          )
        }
        toolbar={
          <TabsList>
            <TabsTrigger value="scheduling">Scheduling</TabsTrigger>
            <TabsTrigger value="report">Report</TabsTrigger>
            <TabsTrigger value="attachments">Attachments</TabsTrigger>
          </TabsList>
        }
      >
        <TabsContent value="scheduling">
          <SchedulingTab orderId={orderId} order={order} canUpdate={canUpdate} onSaved={invalidate} />
        </TabsContent>
        <TabsContent value="report">
          <ReportTab orderId={orderId} order={order} canUpdate={canUpdate} onSaved={invalidate} />
        </TabsContent>
        <TabsContent value="attachments">
          <AttachmentsTab orderId={orderId} attachments={order.attachments} canUpdate={canUpdate} onSaved={invalidate} />
        </TabsContent>
      </PageLayout>
    </Tabs>
  )
}

function SchedulingTab({
  orderId,
  order,
  canUpdate,
  onSaved,
}: {
  orderId: string
  order: {
    status: RadiologyStatus
    scheduledAt: string | Date | null
    room: string | null
    machine: string | null
    technicianUserId: string | null
    radiologistDoctorId: string | null
    durationMinutes: number | null
  }
  canUpdate: boolean
  onSaved: () => void
}) {
  const { toast } = useToast()
  const doctorsQuery = useQuery({ queryKey: ['doctors', 'list', 'all'], queryFn: () => listDoctors({ limit: 100 }) })

  const [scheduledAt, setScheduledAt] = useState(() =>
    order.scheduledAt ? new Date(order.scheduledAt).toISOString().slice(0, 16) : '',
  )
  const [room, setRoom] = useState(order.room ?? '')
  const [machine, setMachine] = useState(order.machine ?? '')
  const [radiologistDoctorId, setRadiologistDoctorId] = useState(order.radiologistDoctorId ?? '')
  const [durationMinutes, setDurationMinutes] = useState(order.durationMinutes?.toString() ?? '')

  const scheduleMutation = useMutation({
    mutationFn: () =>
      scheduleRadiologyOrder(orderId, {
        scheduledAt: new Date(scheduledAt),
        room: room || undefined,
        machine: machine || undefined,
        radiologistDoctorId: radiologistDoctorId || undefined,
        durationMinutes: durationMinutes ? Number(durationMinutes) : undefined,
      }),
    onSuccess: () => {
      toast({ title: 'Study scheduled' })
      onSaved()
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Could not schedule study', description: getErrorMessage(error) }),
  })

  const canSchedule = order.status === RadiologyStatus.ORDERED || order.status === RadiologyStatus.SCHEDULED

  return (
    <div className="space-y-4 rounded-lg border bg-card p-4">
      {!canSchedule && (
        <p className="text-sm text-muted-foreground">Scheduling is locked once a study is in progress or later.</p>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Appointment date &amp; time</label>
          <Input
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            disabled={!canUpdate || !canSchedule}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Duration (minutes)</label>
          <Input
            type="number"
            value={durationMinutes}
            onChange={(e) => setDurationMinutes(e.target.value)}
            disabled={!canUpdate || !canSchedule}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Room</label>
          <Input
            placeholder="e.g. Room 3"
            value={room}
            onChange={(e) => setRoom(e.target.value)}
            disabled={!canUpdate || !canSchedule}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Machine</label>
          <Input
            placeholder="e.g. XR-1"
            value={machine}
            onChange={(e) => setMachine(e.target.value)}
            disabled={!canUpdate || !canSchedule}
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <label className="text-sm font-medium">Radiologist</label>
          <Select value={radiologistDoctorId || '__none__'} onValueChange={(v) => setRadiologistDoctorId(v === '__none__' ? '' : v)}>
            <SelectTrigger disabled={!canUpdate || !canSchedule}>
              <SelectValue placeholder="Assign a radiologist" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Unassigned</SelectItem>
              {doctorsQuery.data?.data.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  Dr. {d.fullName} — {d.specialization}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      {canUpdate && canSchedule && (
        <Button onClick={() => scheduleMutation.mutate()} disabled={!scheduledAt || scheduleMutation.isPending}>
          {scheduleMutation.isPending && <Loader2 className="animate-spin" />}
          {order.status === RadiologyStatus.SCHEDULED ? 'Reschedule' : 'Schedule study'}
        </Button>
      )}
    </div>
  )
}

function ReportTab({
  orderId,
  order,
  canUpdate,
  onSaved,
}: {
  orderId: string
  order: {
    status: RadiologyStatus
    clinicalIndication: string | null
    technique: string | null
    findings: string | null
    impression: string | null
    recommendations: string | null
    verifiedAt: string | Date | null
    releasedAt: string | Date | null
    reports: Array<{ id: string; version: number; createdAt: string | Date; findings: string | null }>
    orderNumber: string
  }
  canUpdate: boolean
  onSaved: () => void
}) {
  const { toast } = useToast()
  const [draft, setDraft] = useState<CreateRadiologyReportDto>({
    clinicalIndication: order.clinicalIndication ?? '',
    technique: order.technique ?? '',
    findings: order.findings ?? '',
    impression: order.impression ?? '',
    recommendations: order.recommendations ?? '',
  })

  const saveMutation = useMutation({
    mutationFn: () => addRadiologyReportVersion(orderId, draft),
    onSuccess: () => {
      toast({ title: 'Report saved' })
      onSaved()
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Could not save report', description: getErrorMessage(error) }),
  })

  const verifyMutation = useMutation({
    mutationFn: () => verifyRadiologyReport(orderId),
    onSuccess: () => {
      toast({ title: 'Report verified' })
      onSaved()
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Could not verify report', description: getErrorMessage(error) }),
  })

  const releaseMutation = useMutation({
    mutationFn: () => releaseRadiologyReport(orderId),
    onSuccess: () => {
      toast({ title: 'Report released' })
      onSaved()
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Could not release report', description: getErrorMessage(error) }),
  })

  const canAuthor = canUpdate && order.status === RadiologyStatus.COMPLETED
  const hasReport = order.reports.length > 0

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-lg border bg-card p-4">
        <h3 className="text-sm font-semibold text-foreground">Report</h3>
        {order.status !== RadiologyStatus.COMPLETED && order.status !== RadiologyStatus.REPORTED && (
          <p className="text-sm text-muted-foreground">A report can be authored once the study is completed.</p>
        )}
        {(['clinicalIndication', 'technique', 'findings', 'impression', 'recommendations'] as const).map((field) => (
          <div key={field} className="space-y-1.5">
            <label className="text-sm font-medium">{formatEnumLabel(field.replace(/([A-Z])/g, '_$1'))}</label>
            <Textarea
              rows={field === 'findings' ? 4 : 2}
              value={draft[field] ?? ''}
              onChange={(e) => setDraft((prev) => ({ ...prev, [field]: e.target.value }))}
              disabled={!canAuthor}
            />
          </div>
        ))}
        {canAuthor && (
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending && <Loader2 className="animate-spin" />}
            Save report version
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-4">
        <div className="flex-1 text-sm">
          <p>
            <span className="font-medium">Verified:</span>{' '}
            {order.verifiedAt ? new Date(order.verifiedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'Not yet'}
          </p>
          <p>
            <span className="font-medium">Released:</span>{' '}
            {order.releasedAt ? new Date(order.releasedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'Not yet'}
          </p>
        </div>
        {canUpdate && order.status === RadiologyStatus.COMPLETED && !order.verifiedAt && (
          <Button variant="outline" onClick={() => verifyMutation.mutate()} disabled={!hasReport || verifyMutation.isPending}>
            {verifyMutation.isPending ? <Loader2 className="animate-spin" /> : <ShieldCheck />}
            Verify report
          </Button>
        )}
        {canUpdate && order.status === RadiologyStatus.COMPLETED && order.verifiedAt && (
          <Button onClick={() => releaseMutation.mutate()} disabled={releaseMutation.isPending}>
            {releaseMutation.isPending ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
            Release report
          </Button>
        )}
        {(order.status === RadiologyStatus.COMPLETED || order.status === RadiologyStatus.REPORTED) && (
          <Button variant="outline" onClick={() => void downloadRadiologyReportPdf(orderId, order.orderNumber)}>
            <Download className="h-4 w-4" />
            Download PDF
          </Button>
        )}
      </div>

      {order.reports.length > 0 && (
        <div className="rounded-lg border bg-card p-4">
          <h3 className="mb-2 text-sm font-semibold text-foreground">Version history</h3>
          <ul className="space-y-1 text-sm text-muted-foreground">
            {order.reports.map((r) => (
              <li key={r.id}>
                v{r.version} — {new Date(r.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function AttachmentsTab({
  orderId,
  attachments,
  canUpdate,
  onSaved,
}: {
  orderId: string
  attachments: Array<{
    id: string
    type: RadiologyAttachmentType
    fileName: string | null
    fileUrl: string | null
    metadata: Record<string, unknown> | null
  }>
  canUpdate: boolean
  onSaved: () => void
}) {
  const { toast } = useToast()
  const [externalType, setExternalType] = useState<
    RadiologyAttachmentType.EXTERNAL_IMAGING | RadiologyAttachmentType.DICOM_PLACEHOLDER
  >(RadiologyAttachmentType.EXTERNAL_IMAGING)
  const [accessionNumber, setAccessionNumber] = useState('')
  const [externalUrl, setExternalUrl] = useState('')

  const uploadMutation = useMutation({
    mutationFn: ({ type, file }: { type: 'IMAGE' | 'PDF'; file: File }) => uploadRadiologyFileAttachment(orderId, type, file),
    onSuccess: () => {
      toast({ title: 'Attachment uploaded' })
      onSaved()
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Upload failed', description: getErrorMessage(error) }),
  })

  const externalMutation = useMutation({
    mutationFn: () =>
      addExternalRadiologyAttachment(orderId, {
        type: externalType,
        metadata: { accessionNumber: accessionNumber || undefined, externalUrl: externalUrl || undefined },
      }),
    onSuccess: () => {
      toast({ title: 'External imaging reference added' })
      setAccessionNumber('')
      setExternalUrl('')
      onSaved()
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Could not add reference', description: getErrorMessage(error) }),
  })

  const deleteMutation = useMutation({
    mutationFn: (attachmentId: string) => deleteRadiologyAttachment(orderId, attachmentId),
    onSuccess: () => {
      toast({ title: 'Attachment removed' })
      onSaved()
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Could not remove attachment', description: getErrorMessage(error) }),
  })

  return (
    <div className="space-y-4">
      {canUpdate && (
        <div className="space-y-3 rounded-lg border bg-card p-4">
          <h3 className="text-sm font-semibold text-foreground">Add attachment</h3>
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-muted">
              <Upload className="h-3.5 w-3.5" />
              Upload image
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) uploadMutation.mutate({ type: 'IMAGE', file })
                }}
              />
            </label>
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-muted">
              <Upload className="h-3.5 w-3.5" />
              Upload PDF
              <input
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) uploadMutation.mutate({ type: 'PDF', file })
                }}
              />
            </label>
          </div>

          <div className="space-y-2 rounded-md border p-3">
            <h4 className="text-xs font-semibold text-muted-foreground">
              External imaging / PACS reference (no file — DICOM placeholder, since no PACS integration exists yet)
            </h4>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={externalType} onValueChange={(v) => setExternalType(v as typeof externalType)}>
                <SelectTrigger className="w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EXTERNAL_IMAGING">External imaging</SelectItem>
                  <SelectItem value="DICOM_PLACEHOLDER">DICOM placeholder</SelectItem>
                </SelectContent>
              </Select>
              <Input
                placeholder="Accession number"
                value={accessionNumber}
                onChange={(e) => setAccessionNumber(e.target.value)}
                className="w-48"
              />
              <Input placeholder="External URL (optional)" value={externalUrl} onChange={(e) => setExternalUrl(e.target.value)} className="w-56" />
              <Button
                size="sm"
                variant="outline"
                onClick={() => externalMutation.mutate()}
                disabled={(!accessionNumber && !externalUrl) || externalMutation.isPending}
              >
                {externalMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Add reference
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-lg border bg-card">
        <div className="border-b p-3">
          <h3 className="text-sm font-semibold text-foreground">Attachments</h3>
        </div>
        {attachments.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No attachments yet.</p>
        ) : (
          <ul className="divide-y">
            {attachments.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-2 p-3 text-sm">
                <div className="flex items-center gap-2">
                  <FileImage className="h-4 w-4 text-muted-foreground" />
                  <Badge variant="outline">{formatEnumLabel(a.type)}</Badge>
                  {a.fileUrl ? (
                    <a href={a.fileUrl} target="_blank" rel="noreferrer" className="hover:underline">
                      {a.fileName ?? 'View file'}
                    </a>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      {a.metadata?.accessionNumber ? `Accession: ${String(a.metadata.accessionNumber)}` : 'No file — metadata only'}
                    </span>
                  )}
                </div>
                {canUpdate && (
                  <Button variant="ghost" size="sm" onClick={() => deleteMutation.mutate(a.id)} disabled={deleteMutation.isPending}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
