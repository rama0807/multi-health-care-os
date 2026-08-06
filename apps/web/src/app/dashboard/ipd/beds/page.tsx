'use client'

import { BedStatus, BedType, type BedWithDetails } from '@medicore/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Plus } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import { Suspense, useState } from 'react'

import { PageLayout } from '@/components/layout/page-layout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { StatusBadge, statusTone } from '@/components/ui/status-badge'
import { useToast } from '@/hooks/use-toast'
import { createBed, deactivateBed, listBeds, listRooms, listWards, updateBed } from '@/lib/api/ipd'
import { useAuth } from '@/lib/auth/auth-context'

function getErrorMessage(error: unknown): string {
  const axiosError = error as { response?: { data?: { error?: { message?: string } } } }
  return axiosError?.response?.data?.error?.message ?? 'Something went wrong. Please try again.'
}

function formatEnumLabel(value: string): string {
  return value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, ' ')
}

/** Same tone semantics as `<StatusBadge>`, rendered as a filled swatch instead of a pill. */
const TONE_SWATCH: Record<string, string> = {
  success: 'border-success-border bg-success-subtle text-success-subtle-foreground',
  info: 'border-info-border bg-info-subtle text-info-subtle-foreground',
  warning: 'border-warning-border bg-warning-subtle text-warning-subtle-foreground',
  danger: 'border-danger-border bg-danger-subtle text-danger-subtle-foreground',
  neutral: 'border-neutral-border bg-neutral-subtle text-neutral-subtle-foreground',
}

function bedSwatchClass(status: BedStatus): string {
  return TONE_SWATCH[statusTone(status)]
}

export default function BedsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-muted-foreground">Loading...</div>}>
      <BedGrid />
    </Suspense>
  )
}

function BedGrid() {
  const searchParams = useSearchParams()
  const { hasPermission } = useAuth()
  const canCreate = hasPermission('ipd.beds.create')
  const canUpdate = hasPermission('ipd.beds.update')
  const canDelete = hasPermission('ipd.beds.delete')

  const [wardId, setWardId] = useState(searchParams.get('wardId') ?? 'all')
  const [roomId, setRoomId] = useState(searchParams.get('roomId') ?? 'all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedBed, setSelectedBed] = useState<BedWithDetails | null>(null)

  const wardsQuery = useQuery({ queryKey: ['ipd', 'wards', 'list', 'all'], queryFn: () => listWards({ limit: 100 }) })
  const roomsQuery = useQuery({
    queryKey: ['ipd', 'rooms', 'list', wardId],
    queryFn: () => listRooms({ limit: 100, wardId: wardId === 'all' ? undefined : wardId }),
  })
  const bedsQuery = useQuery({
    queryKey: ['ipd', 'beds', 'list', wardId, roomId],
    queryFn: () =>
      listBeds({
        limit: 200,
        wardId: wardId === 'all' ? undefined : wardId,
        roomId: roomId === 'all' ? undefined : roomId,
      }),
  })
  const beds = bedsQuery.data?.data ?? []

  const grouped = beds.reduce<Record<string, BedWithDetails[]>>((acc, bed) => {
    const key = `${bed.ward.name} — ${bed.room.roomNumber}`
    acc[key] = acc[key] ? [...acc[key], bed] : [bed]
    return acc
  }, {})

  return (
    <PageLayout
      breadcrumbs={[{ label: 'IPD', href: '/dashboard/ipd' }, { label: 'Bed Grid' }]}
      title="Bed Grid"
      description="Live bed status across every ward and room."
      actions={
        canCreate && (
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            Add bed
          </Button>
        )
      }
    >
      <div className="flex flex-wrap gap-2">
        <Select
          value={wardId}
          onValueChange={(v) => {
            setWardId(v)
            setRoomId('all')
          }}
        >
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Filter by ward" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All wards</SelectItem>
            {wardsQuery.data?.data.map((w) => (
              <SelectItem key={w.id} value={w.id}>
                {w.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={roomId} onValueChange={setRoomId}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Filter by room" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All rooms</SelectItem>
            {roomsQuery.data?.data.map((r) => (
              <SelectItem key={r.id} value={r.id}>
                {r.roomNumber}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-wrap gap-3 text-xs">
        {Object.values(BedStatus).map((s) => (
          <div key={s} className="flex items-center gap-1.5">
            <span className={`h-3 w-3 rounded-sm border ${bedSwatchClass(s)}`} />
            {formatEnumLabel(s)}
          </div>
        ))}
      </div>

      {bedsQuery.isLoading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : beds.length === 0 ? (
        <EmptyState variant="search" title="No beds found" description="Try a different ward or room filter." />
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([groupLabel, groupBeds]) => (
            <Card key={groupLabel} className="p-4">
              <h3 className="mb-3 text-sm font-semibold text-foreground">{groupLabel}</h3>
              <div className="flex flex-wrap gap-2">
                {groupBeds.map((bed) => (
                  <button
                    key={bed.id}
                    type="button"
                    onClick={() => setSelectedBed(bed)}
                    className={`flex w-28 flex-col items-start rounded-md border-2 p-2 text-left text-xs transition-opacity duration-fast hover:opacity-80 ${bedSwatchClass(bed.status)}`}
                  >
                    <span className="font-semibold">{bed.bedNumber}</span>
                    <span>{formatEnumLabel(bed.type)}</span>
                    <span className="mt-1 font-medium">{formatEnumLabel(bed.status)}</span>
                    {bed.currentAdmission && <span className="mt-1 truncate">{bed.currentAdmission.patientName}</span>}
                  </button>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}

      <AddBedDialog open={dialogOpen} onOpenChange={setDialogOpen} rooms={roomsQuery.data?.data ?? []} />
      {selectedBed && (
        <BedDetailDialog
          bed={selectedBed}
          onOpenChange={(open) => !open && setSelectedBed(null)}
          canUpdate={canUpdate}
          canDelete={canDelete}
        />
      )}
    </PageLayout>
  )
}

function AddBedDialog({
  open,
  onOpenChange,
  rooms,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  rooms: Array<{ id: string; roomNumber: string }>
}) {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [bedNumber, setBedNumber] = useState('')
  const [roomId, setRoomId] = useState('')
  const [type, setType] = useState<BedType>(BedType.GENERAL)

  const mutation = useMutation({
    mutationFn: () => createBed({ bedNumber, roomId, type }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['ipd', 'beds', 'list'] })
      void queryClient.invalidateQueries({ queryKey: ['ipd', 'rooms', 'list'] })
      void queryClient.invalidateQueries({ queryKey: ['ipd', 'wards', 'list'] })
      toast({ title: 'Bed added' })
      onOpenChange(false)
      setBedNumber('')
      setRoomId('')
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Could not add bed', description: getErrorMessage(error) }),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add bed</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Input placeholder="Bed number" value={bedNumber} onChange={(e) => setBedNumber(e.target.value)} />
          <Select value={roomId} onValueChange={setRoomId}>
            <SelectTrigger>
              <SelectValue placeholder="Room" />
            </SelectTrigger>
            <SelectContent>
              {rooms.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.roomNumber}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={type} onValueChange={(v) => setType(v as BedType)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.values(BedType).map((t) => (
                <SelectItem key={t} value={t}>
                  {formatEnumLabel(t)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={!bedNumber.trim() || !roomId || mutation.isPending}>
            {mutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const MANUAL_BED_STATUSES: BedStatus[] = [
  BedStatus.AVAILABLE,
  BedStatus.CLEANING,
  BedStatus.MAINTENANCE,
  BedStatus.BLOCKED,
]

function BedDetailDialog({
  bed,
  onOpenChange,
  canUpdate,
  canDelete,
}: {
  bed: BedWithDetails
  onOpenChange: (open: boolean) => void
  canUpdate: boolean
  canDelete: boolean
}) {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const statusMutation = useMutation({
    mutationFn: (status: BedStatus) => updateBed(bed.id, { status }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['ipd', 'beds', 'list'] })
      toast({ title: 'Bed status updated' })
      onOpenChange(false)
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Could not update bed', description: getErrorMessage(error) }),
  })

  const deactivateMutation = useMutation({
    mutationFn: () => deactivateBed(bed.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['ipd', 'beds', 'list'] })
      toast({ title: 'Bed blocked' })
      onOpenChange(false)
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Could not block bed', description: getErrorMessage(error) }),
  })

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Bed {bed.bedNumber} · {bed.room.roomNumber} · {bed.ward.name}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-2 text-sm">
          <p>
            Type: <Badge variant="outline">{formatEnumLabel(bed.type)}</Badge>
          </p>
          <p>
            Status: <StatusBadge status={bed.status} />
          </p>
          <p className="text-xs text-muted-foreground">Charges: ₹{bed.room.chargesPerDay}/day</p>
          {bed.currentAdmission ? (
            <div className="rounded-md border bg-muted/50 p-2 text-xs">
              <p className="font-medium text-foreground">{bed.currentAdmission.patientName}</p>
              <p className="text-muted-foreground">Admission {bed.currentAdmission.admissionNumber}</p>
              <a
                href={`/dashboard/ipd/${bed.currentAdmission.id}`}
                className="text-primary hover:underline"
              >
                View admission →
              </a>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No current admission.</p>
          )}

          {canUpdate && bed.status !== BedStatus.OCCUPIED && (
            <div className="flex flex-wrap gap-1.5 pt-2">
              {MANUAL_BED_STATUSES.filter((s) => s !== bed.status).map((s) => (
                <Button
                  key={s}
                  size="sm"
                  variant="outline"
                  onClick={() => statusMutation.mutate(s)}
                  disabled={statusMutation.isPending}
                >
                  Mark {formatEnumLabel(s)}
                </Button>
              ))}
            </div>
          )}
        </div>
        <DialogFooter>
          {canDelete && bed.status !== BedStatus.OCCUPIED && bed.status !== BedStatus.BLOCKED && (
            <Button variant="destructive" onClick={() => deactivateMutation.mutate()} disabled={deactivateMutation.isPending}>
              {deactivateMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Block bed
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
