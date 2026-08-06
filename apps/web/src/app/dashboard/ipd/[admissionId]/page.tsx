'use client'

import { AdmissionStatus, BedStatus, type BedWithDetails } from '@medicore/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeftRight, ArrowLeftCircle, BedDouble, Loader2, LogOut } from 'lucide-react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useState } from 'react'

import { PageLayout } from '@/components/layout/page-layout'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { PageHeaderMeta } from '@/components/ui/page-header'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { StatusBadge } from '@/components/ui/status-badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import {
  allocateBed,
  cancelAdmission,
  cancelBedReservation,
  getAdmission,
  listBeds,
  listBedAllocationHistory,
  listBedTransferHistory,
  reserveBed,
  transferBed,
  vacateBed,
} from '@/lib/api/ipd'
import { useAuth } from '@/lib/auth/auth-context'

import { DischargeTab } from './_components/discharge-tab'
import { MarTab } from './_components/mar-tab'
import { NursingTab } from './_components/nursing-tab'
import { OrdersTab } from './_components/orders-tab'

function getErrorMessage(error: unknown): string {
  const axiosError = error as { response?: { data?: { error?: { message?: string } } } }
  return axiosError?.response?.data?.error?.message ?? 'Something went wrong. Please try again.'
}

function formatEnumLabel(value: string): string {
  return value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, ' ')
}

function formatDateTime(value: string | Date): string {
  return new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
}

export default function AdmissionDetailPage() {
  const params = useParams<{ admissionId: string }>()
  const admissionId = params.admissionId
  const { hasPermission } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const canUpdate = hasPermission('ipd.admissions.update')
  const canTransfer = hasPermission('ipd.transfer.create')

  const [allocateOpen, setAllocateOpen] = useState(false)
  const [reserveOpen, setReserveOpen] = useState(false)
  const [transferOpen, setTransferOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)

  const admissionQuery = useQuery({
    queryKey: ['ipd', 'admissions', 'detail', admissionId],
    queryFn: () => getAdmission(admissionId),
  })
  const admission = admissionQuery.data

  const allocationsQuery = useQuery({
    queryKey: ['ipd', 'admissions', 'allocations', admissionId],
    queryFn: () => listBedAllocationHistory(admissionId),
  })
  const transfersQuery = useQuery({
    queryKey: ['ipd', 'admissions', 'transfers', admissionId],
    queryFn: () => listBedTransferHistory(admissionId),
  })

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ['ipd', 'admissions', 'detail', admissionId] })
    void queryClient.invalidateQueries({ queryKey: ['ipd', 'admissions', 'allocations', admissionId] })
    void queryClient.invalidateQueries({ queryKey: ['ipd', 'admissions', 'transfers', admissionId] })
    void queryClient.invalidateQueries({ queryKey: ['ipd', 'beds', 'list'] })
    void queryClient.invalidateQueries({ queryKey: ['ipd', 'wards', 'list'] })
    void queryClient.invalidateQueries({ queryKey: ['ipd', 'dashboard-stats'] })
  }

  const vacateMutation = useMutation({
    mutationFn: () => vacateBed(admissionId, {}),
    onSuccess: () => {
      toast({ title: 'Bed vacated — sent for cleaning' })
      invalidate()
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Could not vacate bed', description: getErrorMessage(error) }),
  })

  const cancelReservationMutation = useMutation({
    mutationFn: () => cancelBedReservation(admissionId),
    onSuccess: () => {
      toast({ title: 'Reservation cancelled' })
      invalidate()
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Could not cancel reservation', description: getErrorMessage(error) }),
  })

  const cancelAdmissionMutation = useMutation({
    mutationFn: (reason: string) => cancelAdmission(admissionId, { reason }),
    onSuccess: () => {
      toast({ title: 'Admission cancelled' })
      setCancelOpen(false)
      invalidate()
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Could not cancel admission', description: getErrorMessage(error) }),
  })

  if (admissionQuery.isLoading || !admission) {
    return (
      <PageLayout
        breadcrumbs={[{ label: 'IPD', href: '/dashboard/ipd' }, { label: 'Admissions', href: '/dashboard/ipd/admissions' }, { label: '…' }]}
        title="…"
        loading
      >
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </PageLayout>
    )
  }

  const bedIsFree = !admission.bed
  const bedIsReserved = admission.bed?.status === BedStatus.RESERVED
  const bedIsOccupied = admission.bed?.status === BedStatus.OCCUPIED
  const isActive = admission.status === AdmissionStatus.ADMITTED

  const timeline = [
    ...(allocationsQuery.data ?? []).map((a) => ({ kind: 'allocation' as const, at: a.occurredAt, entry: a })),
    ...(transfersQuery.data ?? []).map((t) => ({ kind: 'transfer' as const, at: t.transferredAt, entry: t })),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())

  return (
    <Tabs defaultValue="overview">
      <PageLayout
        breadcrumbs={[
          { label: 'IPD', href: '/dashboard/ipd' },
          { label: 'Admissions', href: '/dashboard/ipd/admissions' },
          { label: admission.admissionNumber },
        ]}
        title={admission.admissionNumber}
        badge={<StatusBadge status={admission.status} />}
        meta={
          <PageHeaderMeta label="Patient">
            {admission.patient.fullName} ({admission.patient.uhid})
          </PageHeaderMeta>
        }
        actions={
          isActive &&
          canUpdate && (
            <Button variant="destructive" size="sm" onClick={() => setCancelOpen(true)}>
              Cancel admission
            </Button>
          )
        }
        toolbar={
          <TabsList className="flex-wrap">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="nursing">Nursing</TabsTrigger>
            <TabsTrigger value="orders">Orders & Tasks</TabsTrigger>
            <TabsTrigger value="mar">MAR</TabsTrigger>
            <TabsTrigger value="discharge">Discharge</TabsTrigger>
          </TabsList>
        }
      >
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <InfoCard label="Attending doctor" value={`${admission.attendingDoctor.fullName} (${admission.attendingDoctor.specialization})`} />
            <InfoCard label="Type" value={formatEnumLabel(admission.type)} />
            <InfoCard label="Department" value={admission.department?.name ?? '—'} />
            <InfoCard label="Ward" value={`${admission.ward.name} (${formatEnumLabel(admission.ward.type)})`} />
            <InfoCard label="Room" value={admission.room?.roomNumber ?? '—'} />
            <InfoCard label="Admitted" value={formatDateTime(admission.admittedAt)} />
            <InfoCard label="Expected discharge" value={admission.expectedDischargeAt ? formatDateTime(admission.expectedDischargeAt) : '—'} />
            {admission.patientInsurance && (
              <InfoCard label="Insurance" value={`${admission.patientInsurance.provider.name} · ${admission.patientInsurance.plan.name}`} />
            )}
            {admission.encounterId && (
              <div className="rounded-lg border bg-card p-4">
                <p className="text-xs text-muted-foreground">Encounter</p>
                <Link href={`/dashboard/medical-records/${admission.encounterId}`} className="text-sm text-primary hover:underline">
                  View encounter →
                </Link>
              </div>
            )}
          </div>

          <div className="rounded-lg border bg-card p-4">
            <h3 className="mb-2 text-sm font-semibold text-foreground">Reason & diagnosis</h3>
            <p className="text-sm text-foreground">{admission.admissionReason}</p>
            {admission.diagnosis && <p className="mt-1 text-sm text-muted-foreground">Diagnosis: {admission.diagnosis}</p>}
          </div>

          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Bed allocation</h3>
              {admission.bed && <StatusBadge status={admission.bed.status} />}
            </div>
            <p className="mt-1 text-sm text-foreground">
              {admission.bed ? `Bed ${admission.bed.bedNumber}` : 'No bed currently allocated'}
            </p>

            {isActive && canTransfer && (
              <div className="mt-3 flex flex-wrap gap-2">
                {bedIsFree && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => setAllocateOpen(true)}>
                      <BedDouble className="h-3.5 w-3.5" />
                      Allocate bed
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setReserveOpen(true)}>
                      Reserve bed
                    </Button>
                  </>
                )}
                {bedIsReserved && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => setAllocateOpen(true)}>
                      Confirm allocation
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => cancelReservationMutation.mutate()} disabled={cancelReservationMutation.isPending}>
                      <ArrowLeftCircle className="h-3.5 w-3.5" />
                      Cancel reservation
                    </Button>
                  </>
                )}
                {bedIsOccupied && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => setTransferOpen(true)}>
                      <ArrowLeftRight className="h-3.5 w-3.5" />
                      Transfer
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => vacateMutation.mutate()} disabled={vacateMutation.isPending}>
                      <LogOut className="h-3.5 w-3.5" />
                      Vacate
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="rounded-lg border bg-card p-4">
            <h3 className="mb-3 text-sm font-semibold text-foreground">Bed & transfer history</h3>
            {timeline.length === 0 ? (
              <p className="text-sm text-muted-foreground">No bed allocation events yet.</p>
            ) : (
              <ul className="space-y-2">
                {timeline.map((item) => (
                  <li key={`${item.kind}-${item.entry.id}`} className="flex items-start gap-3 text-sm">
                    <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary" />
                    <div>
                      <p className="font-medium text-foreground">
                        {item.kind === 'allocation'
                          ? formatEnumLabel((item.entry).action)
                          : `Transferred${(item.entry).fromBed ? ` from Bed ${(item.entry).fromBed.bedNumber}` : ''} to Bed ${(item.entry).toBed.bedNumber}`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(item.at)}
                        {item.entry.reason ? ` · ${item.entry.reason}` : ''}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </TabsContent>

        <TabsContent value="nursing">
          <NursingTab admissionId={admissionId} canCreate={hasPermission('ipd.nursing.create')} />
        </TabsContent>

        <TabsContent value="orders">
          <OrdersTab
            admissionId={admissionId}
            canOrder={hasPermission('ipd.orders.create')}
            canManageTasks={hasPermission('ipd.tasks.create')}
          />
        </TabsContent>

        <TabsContent value="mar">
          <MarTab admissionId={admissionId} encounterId={admission.encounterId} canAdminister={hasPermission('ipd.mar.create')} />
        </TabsContent>

        <TabsContent value="discharge">
          <DischargeTab
            admission={admission}
            canApprove={hasPermission('ipd.discharge.create')}
            canUpdateChecklist={hasPermission('ipd.discharge.update')}
            canFinalize={hasPermission('ipd.discharge.manage')}
            onDischarged={invalidate}
          />
        </TabsContent>

      <AllocateBedDialog
        open={allocateOpen}
        onOpenChange={setAllocateOpen}
        wardId={admission.wardId}
        reservedBedId={bedIsReserved ? admission.bed?.id : undefined}
        onAllocate={async (bedId) => {
          try {
            await allocateBed(admissionId, { bedId })
            toast({ title: 'Bed allocated' })
            setAllocateOpen(false)
            invalidate()
          } catch (error) {
            toast({ variant: 'destructive', title: 'Could not allocate bed', description: getErrorMessage(error) })
          }
        }}
      />
      <AllocateBedDialog
        open={reserveOpen}
        onOpenChange={setReserveOpen}
        wardId={admission.wardId}
        title="Reserve bed"
        onAllocate={async (bedId) => {
          try {
            await reserveBed(admissionId, { bedId })
            toast({ title: 'Bed reserved' })
            setReserveOpen(false)
            invalidate()
          } catch (error) {
            toast({ variant: 'destructive', title: 'Could not reserve bed', description: getErrorMessage(error) })
          }
        }}
      />
      <TransferBedDialog
        open={transferOpen}
        onOpenChange={setTransferOpen}
        wardId={admission.wardId}
        currentBedId={admission.bed?.id}
        onTransfer={async (bedId, reason) => {
          try {
            await transferBed(admissionId, { toBedId: bedId, reason: reason || undefined })
            toast({ title: 'Patient transferred' })
            setTransferOpen(false)
            invalidate()
          } catch (error) {
            toast({ variant: 'destructive', title: 'Could not transfer', description: getErrorMessage(error) })
          }
        }}
      />
      <CancelAdmissionDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        isPending={cancelAdmissionMutation.isPending}
        onConfirm={(reason) => cancelAdmissionMutation.mutate(reason)}
      />
      </PageLayout>
    </Tabs>
  )
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground">{value}</p>
    </div>
  )
}

function AllocateBedDialog({
  open,
  onOpenChange,
  wardId,
  title = 'Allocate bed',
  reservedBedId,
  onAllocate,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  wardId: string
  title?: string
  reservedBedId?: string
  onAllocate: (bedId: string) => Promise<void>
}) {
  const [bedId, setBedId] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const bedsQuery = useQuery({
    queryKey: ['ipd', 'beds', 'available-for-ward', wardId],
    queryFn: () => listBeds({ limit: 100, wardId, status: 'AVAILABLE' as never }),
    enabled: open,
  })

  const options: BedWithDetails[] = bedsQuery.data?.data ?? []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <Select value={bedId} onValueChange={setBedId}>
          <SelectTrigger>
            <SelectValue placeholder="Select an available bed" />
          </SelectTrigger>
          <SelectContent>
            {reservedBedId && <SelectItem value={reservedBedId}>Currently reserved bed</SelectItem>}
            {options.map((b) => (
              <SelectItem key={b.id} value={b.id}>
                {b.bedNumber} — {b.room.roomNumber}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!bedId || submitting}
            onClick={() => {
              void (async () => {
                setSubmitting(true)
                await onAllocate(bedId)
                setSubmitting(false)
                setBedId('')
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

function TransferBedDialog({
  open,
  onOpenChange,
  wardId,
  currentBedId,
  onTransfer,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  wardId: string
  currentBedId?: string
  onTransfer: (bedId: string, reason: string) => Promise<void>
}) {
  const [scope, setScope] = useState<'ward' | 'all'>('ward')
  const [bedId, setBedId] = useState('')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const bedsQuery = useQuery({
    queryKey: ['ipd', 'beds', 'transfer-options', scope, wardId],
    queryFn: () => listBeds({ limit: 100, wardId: scope === 'ward' ? wardId : undefined, status: 'AVAILABLE' as never }),
    enabled: open,
  })
  const options = (bedsQuery.data?.data ?? []).filter((b) => b.id !== currentBedId)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Transfer patient</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Select value={scope} onValueChange={(v) => setScope(v as 'ward' | 'all')}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ward">Beds in this ward</SelectItem>
              <SelectItem value="all">Beds in any ward</SelectItem>
            </SelectContent>
          </Select>
          <Select value={bedId} onValueChange={setBedId}>
            <SelectTrigger>
              <SelectValue placeholder="Select destination bed" />
            </SelectTrigger>
            <SelectContent>
              {options.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.bedNumber} — {b.ward.name} / {b.room.roomNumber}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Textarea placeholder="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!bedId || submitting}
            onClick={() => {
              void (async () => {
                setSubmitting(true)
                await onTransfer(bedId, reason)
                setSubmitting(false)
                setBedId('')
                setReason('')
              })()
            }}
          >
            {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Transfer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CancelAdmissionDialog({
  open,
  onOpenChange,
  isPending,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  isPending: boolean
  onConfirm: (reason: string) => void
}) {
  const [reason, setReason] = useState('')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel admission</DialogTitle>
        </DialogHeader>
        <Textarea placeholder="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Back
          </Button>
          <Button variant="destructive" onClick={() => onConfirm(reason)} disabled={isPending}>
            {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Confirm cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
