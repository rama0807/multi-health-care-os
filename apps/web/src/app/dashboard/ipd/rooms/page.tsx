'use client'

import { RoomStatus, type RoomWithCounts } from '@medicore/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Plus } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

import { PageLayout } from '@/components/layout/page-layout'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { TableSkeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/ui/status-badge'
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'
import { createRoom, deactivateRoom, listRooms, listWards, updateRoom } from '@/lib/api/ipd'
import { useAuth } from '@/lib/auth/auth-context'

function getErrorMessage(error: unknown): string {
  const axiosError = error as { response?: { data?: { error?: { message?: string } } } }
  return axiosError?.response?.data?.error?.message ?? 'Something went wrong. Please try again.'
}

export default function RoomsPage() {
  const { hasPermission } = useAuth()
  const canCreate = hasPermission('ipd.rooms.create')
  const canUpdate = hasPermission('ipd.rooms.update')
  const canDelete = hasPermission('ipd.rooms.delete')

  const [wardId, setWardId] = useState('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)

  const wardsQuery = useQuery({ queryKey: ['ipd', 'wards', 'list', 'all'], queryFn: () => listWards({ limit: 100 }) })
  const roomsQuery = useQuery({
    queryKey: ['ipd', 'rooms', 'list', wardId],
    queryFn: () => listRooms({ limit: 100, wardId: wardId === 'all' ? undefined : wardId }),
  })
  const rooms = roomsQuery.data?.data ?? []

  return (
    <PageLayout
      breadcrumbs={[{ label: 'IPD', href: '/dashboard/ipd' }, { label: 'Rooms' }]}
      title="Rooms"
      description="Room inventory — capacity, per-day charges, and bed occupancy."
      actions={
        canCreate && (
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            Add room
          </Button>
        )
      }
    >
      <Select value={wardId} onValueChange={setWardId}>
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

      {roomsQuery.isLoading ? (
        <TableSkeleton rows={6} columns={canUpdate || canDelete ? 7 : 6} />
      ) : rooms.length === 0 ? (
        <EmptyState
          variant={wardId === 'all' ? 'empty' : 'search'}
          title="No rooms yet"
          action={canCreate ? { label: 'Add room', onClick: () => setDialogOpen(true) } : undefined}
        />
      ) : (
        <TableContainer className="max-h-[70vh]">
          <Table density="compact" container={false}>
            <TableHeader>
              <TableRow>
                <TableHead>Room</TableHead>
                <TableHead>Ward</TableHead>
                <TableHead align="right">Capacity</TableHead>
                <TableHead align="right">Charges/day</TableHead>
                <TableHead>Beds</TableHead>
                <TableHead>Status</TableHead>
                {(canUpdate || canDelete) && <TableHead className="w-32" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rooms.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.roomNumber}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.ward.name}</TableCell>
                  <TableCell align="right">{r.capacity}</TableCell>
                  <TableCell align="right">₹{r.chargesPerDay}</TableCell>
                  <TableCell>
                    <Link href={`/dashboard/ipd/beds?roomId=${r.id}`} className="text-xs text-primary hover:underline">
                      {r.occupiedBedCount}/{r.bedCount} occupied
                    </Link>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={r.status} />
                  </TableCell>
                  {(canUpdate || canDelete) && (
                    <TableCell className="flex gap-1">
                      {canUpdate && (
                        <Button variant="ghost" size="sm" onClick={() => setEditing(r.id)}>
                          Edit
                        </Button>
                      )}
                      {canDelete && r.status !== RoomStatus.INACTIVE && <DeactivateRoomButton room={r} />}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <RoomDialog open={dialogOpen} onOpenChange={setDialogOpen} wards={wardsQuery.data?.data ?? []} />
      {editing && (
        <RoomDialog
          open
          onOpenChange={(open) => !open && setEditing(null)}
          room={rooms.find((r) => r.id === editing)}
          wards={wardsQuery.data?.data ?? []}
        />
      )}
    </PageLayout>
  )
}

function DeactivateRoomButton({ room }: { room: RoomWithCounts }) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: () => deactivateRoom(room.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['ipd', 'rooms', 'list'] })
      toast({ title: 'Room deactivated' })
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Could not deactivate room', description: getErrorMessage(error) }),
  })

  return (
    <Button variant="ghost" size="sm" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
      {mutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
      Deactivate
    </Button>
  )
}

function RoomDialog({
  open,
  onOpenChange,
  room,
  wards,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  room?: RoomWithCounts
  wards: Array<{ id: string; name: string }>
}) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const isEdit = Boolean(room)

  const [roomNumber, setRoomNumber] = useState(room?.roomNumber ?? '')
  const [wardId, setWardId] = useState(room?.wardId ?? '')
  const [floor, setFloor] = useState(room?.floor ?? '')
  const [capacity, setCapacity] = useState(String(room?.capacity ?? 1))
  const [chargesPerDay, setChargesPerDay] = useState(room?.chargesPerDay ?? '')

  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        roomNumber,
        wardId,
        floor: floor || undefined,
        capacity: Number(capacity),
        chargesPerDay: Number(chargesPerDay),
      }
      return isEdit ? updateRoom(room!.id, payload) : createRoom(payload)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['ipd', 'rooms', 'list'] })
      toast({ title: isEdit ? 'Room updated' : 'Room added' })
      onOpenChange(false)
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Could not save room', description: getErrorMessage(error) }),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit room' : 'Add room'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Input placeholder="Room number" value={roomNumber} onChange={(e) => setRoomNumber(e.target.value)} />
          <Select value={wardId} onValueChange={setWardId}>
            <SelectTrigger>
              <SelectValue placeholder="Ward" />
            </SelectTrigger>
            <SelectContent>
              {wards.map((w) => (
                <SelectItem key={w.id} value={w.id}>
                  {w.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input placeholder="Floor" value={floor} onChange={(e) => setFloor(e.target.value)} />
          <div className="grid grid-cols-2 gap-2">
            <Input type="number" min={1} placeholder="Capacity" value={capacity} onChange={(e) => setCapacity(e.target.value)} />
            <Input type="number" min={0} placeholder="Charges/day (₹)" value={chargesPerDay} onChange={(e) => setChargesPerDay(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={!roomNumber.trim() || !wardId || !chargesPerDay || mutation.isPending}
          >
            {mutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {isEdit ? 'Save' : 'Add'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
