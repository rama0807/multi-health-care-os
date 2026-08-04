'use client'

import { WardStatus, WardType, type WardWithCounts } from '@medicore/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Plus } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'
import { createWard, deactivateWard, listWards, updateWard } from '@/lib/api/ipd'
import { useAuth } from '@/lib/auth/auth-context'

function getErrorMessage(error: unknown): string {
  const axiosError = error as { response?: { data?: { error?: { message?: string } } } }
  return axiosError?.response?.data?.error?.message ?? 'Something went wrong. Please try again.'
}

function formatEnumLabel(value: string): string {
  return value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, ' ')
}

const WARD_STATUS_BADGE: Record<WardStatus, 'success' | 'secondary' | 'warning'> = {
  ACTIVE: 'success',
  INACTIVE: 'secondary',
  UNDER_RENOVATION: 'warning',
}

export default function WardsPage() {
  const { hasPermission } = useAuth()
  const canCreate = hasPermission('ipd.wards.create')
  const canUpdate = hasPermission('ipd.wards.update')
  const canDelete = hasPermission('ipd.wards.delete')

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)

  const wardsQuery = useQuery({ queryKey: ['ipd', 'wards', 'list'], queryFn: () => listWards({ limit: 100 }) })
  const wards = wardsQuery.data?.data ?? []

  return (
    <div className="space-y-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Wards</h1>
          <p className="text-sm text-muted-foreground">Ward inventory — floor, block, type, and bed occupancy.</p>
        </div>
        {canCreate && (
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            Add ward
          </Button>
        )}
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Beds</TableHead>
              <TableHead>Status</TableHead>
              {(canUpdate || canDelete) && <TableHead>Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {wardsQuery.isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                </TableCell>
              </TableRow>
            ) : wards.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  No wards yet.
                </TableCell>
              </TableRow>
            ) : (
              wards.map((w) => (
                <TableRow key={w.id}>
                  <TableCell className="font-medium">{w.name}</TableCell>
                  <TableCell className="font-mono text-xs">{w.code}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{formatEnumLabel(w.type)}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {[w.floor && `Floor ${w.floor}`, w.block && `Block ${w.block}`].filter(Boolean).join(' · ') || '—'}
                  </TableCell>
                  <TableCell>
                    <Link href={`/dashboard/ipd/beds?wardId=${w.id}`} className="text-xs text-primary hover:underline">
                      {w.occupiedBedCount}/{w.bedCount} occupied
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant={WARD_STATUS_BADGE[w.status]}>{formatEnumLabel(w.status)}</Badge>
                  </TableCell>
                  {(canUpdate || canDelete) && (
                    <TableCell className="flex gap-1">
                      {canUpdate && (
                        <Button variant="ghost" size="sm" onClick={() => setEditing(w.id)}>
                          Edit
                        </Button>
                      )}
                      {canDelete && w.status !== WardStatus.INACTIVE && (
                        <DeactivateWardButton ward={w} />
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <WardDialog open={dialogOpen} onOpenChange={setDialogOpen} />
      {editing && (
        <WardDialog open onOpenChange={(open) => !open && setEditing(null)} ward={wards.find((w) => w.id === editing)} />
      )}
    </div>
  )
}

function DeactivateWardButton({ ward }: { ward: WardWithCounts }) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: () => deactivateWard(ward.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['ipd', 'wards', 'list'] })
      toast({ title: 'Ward deactivated' })
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Could not deactivate ward', description: getErrorMessage(error) }),
  })

  return (
    <Button variant="ghost" size="sm" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
      {mutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
      Deactivate
    </Button>
  )
}

function WardDialog({
  open,
  onOpenChange,
  ward,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  ward?: WardWithCounts
}) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const isEdit = Boolean(ward)

  const [name, setName] = useState(ward?.name ?? '')
  const [code, setCode] = useState(ward?.code ?? '')
  const [floor, setFloor] = useState(ward?.floor ?? '')
  const [block, setBlock] = useState(ward?.block ?? '')
  const [type, setType] = useState<WardType>(ward?.type ?? WardType.GENERAL)

  const mutation = useMutation({
    mutationFn: () => {
      const payload = { name, code, floor: floor || undefined, block: block || undefined, type }
      return isEdit ? updateWard(ward!.id, payload) : createWard(payload)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['ipd', 'wards', 'list'] })
      toast({ title: isEdit ? 'Ward updated' : 'Ward added' })
      onOpenChange(false)
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Could not save ward', description: getErrorMessage(error) }),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit ward' : 'Add ward'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <Input placeholder="Code" value={code} onChange={(e) => setCode(e.target.value)} />
          <Select value={type} onValueChange={(v) => setType(v as WardType)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.values(WardType).map((t) => (
                <SelectItem key={t} value={t}>
                  {formatEnumLabel(t)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="Floor" value={floor} onChange={(e) => setFloor(e.target.value)} />
            <Input placeholder="Block" value={block} onChange={(e) => setBlock(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={!name.trim() || !code.trim() || mutation.isPending}>
            {mutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {isEdit ? 'Save' : 'Add'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
