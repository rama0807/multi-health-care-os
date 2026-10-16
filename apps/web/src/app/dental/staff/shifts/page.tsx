'use client'

import type { CreateShiftDto, Shift } from '@medicore/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Moon, Plus } from 'lucide-react'
import { useState } from 'react'

import { PageLayout } from '@/components/layout/page-layout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { TableSkeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableContainer, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'
import { createShift, deactivateShift, listShifts, updateShift } from '@/lib/api/shifts'
import { useAuth } from '@/lib/auth/auth-context'

function getErrorMessage(error: unknown): string {
  const axiosError = error as { response?: { data?: { error?: { message?: string } } } }
  return axiosError?.response?.data?.error?.message ?? 'Something went wrong. Please try again.'
}

export default function ShiftsPage() {
  const { hasPermission } = useAuth()
  const canCreate = hasPermission('shifts.create')
  const canUpdate = hasPermission('shifts.update')
  const canDelete = hasPermission('shifts.delete')

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Shift | null>(null)

  const shiftsQuery = useQuery({ queryKey: ['shifts', 'list'], queryFn: () => listShifts() })
  const shifts = shiftsQuery.data ?? []

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => deactivateShift(id),
    onSuccess: () => void shiftsQuery.refetch(),
    onError: (error: unknown) => alert(getErrorMessage(error)),
  })

  return (
    <PageLayout
      title="Shifts"
      description="Shift definitions used by the weekly roster and attendance rules."
      actions={
        canCreate && (
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            Add shift
          </Button>
        )
      }
    >
      {shiftsQuery.isLoading ? (
        <TableSkeleton rows={6} columns={7} />
      ) : shifts.length === 0 ? (
        <EmptyState title="No shifts defined yet" action={canCreate ? { label: 'Add shift', onClick: () => setDialogOpen(true) } : undefined} />
      ) : (
        <TableContainer>
          <Table container={false}>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Timing</TableHead>
                <TableHead>Break</TableHead>
                <TableHead>Grace</TableHead>
                <TableHead>Status</TableHead>
                {(canUpdate || canDelete) && <TableHead />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {shifts.map((shift) => (
                <TableRow key={shift.id}>
                  <TableCell className="font-medium">
                    <span className="flex items-center gap-1.5">
                      {shift.isNightShift && <Moon className="h-3.5 w-3.5 text-muted-foreground" />}
                      {shift.name}
                    </span>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{shift.code}</TableCell>
                  <TableCell>
                    {shift.startTime} – {shift.endTime}
                  </TableCell>
                  <TableCell>{shift.breakMinutes} min</TableCell>
                  <TableCell>{shift.gracePeriodMinutes} min</TableCell>
                  <TableCell>
                    <Badge variant={shift.isActive ? 'success' : 'neutral'}>{shift.isActive ? 'Active' : 'Inactive'}</Badge>
                  </TableCell>
                  {(canUpdate || canDelete) && (
                    <TableCell className="flex gap-1">
                      {canUpdate && (
                        <Button variant="ghost" size="sm" onClick={() => setEditing(shift)}>
                          Edit
                        </Button>
                      )}
                      {canDelete && shift.isActive && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deactivateMutation.mutate(shift.id)}
                          disabled={deactivateMutation.isPending}
                        >
                          Deactivate
                        </Button>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <ShiftDialog open={dialogOpen} onOpenChange={setDialogOpen} />
      {editing && <ShiftDialog open onOpenChange={(open) => !open && setEditing(null)} shift={editing} />}
    </PageLayout>
  )
}

function ShiftDialog({
  open,
  onOpenChange,
  shift,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  shift?: Shift
}) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const isEdit = Boolean(shift)

  const [name, setName] = useState(shift?.name ?? '')
  const [code, setCode] = useState(shift?.code ?? '')
  const [startTime, setStartTime] = useState(shift?.startTime ?? '09:00')
  const [endTime, setEndTime] = useState(shift?.endTime ?? '17:00')
  const [breakMinutes, setBreakMinutes] = useState(shift?.breakMinutes ?? 30)
  const [gracePeriodMinutes, setGracePeriodMinutes] = useState(shift?.gracePeriodMinutes ?? 15)
  const [isNightShift, setIsNightShift] = useState(shift?.isNightShift ?? false)

  const mutation = useMutation({
    mutationFn: () => {
      const payload: CreateShiftDto = { name, code, startTime, endTime, breakMinutes, gracePeriodMinutes, isNightShift }
      return isEdit ? updateShift(shift!.id, payload) : createShift(payload)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['shifts'] })
      toast({ title: isEdit ? 'Shift updated' : 'Shift added' })
      onOpenChange(false)
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Could not save shift', description: getErrorMessage(error) }),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit shift' : 'Add shift'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input placeholder="Name (e.g. Morning)" value={name} onChange={(e) => setName(e.target.value)} />
          <Input placeholder="Code (e.g. MORN)" value={code} onChange={(e) => setCode(e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Start time</label>
              <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">End time</label>
              <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Break (minutes)</label>
              <Input type="number" min={0} value={breakMinutes} onChange={(e) => setBreakMinutes(Number(e.target.value))} />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Grace period (minutes)</label>
              <Input
                type="number"
                min={0}
                max={120}
                value={gracePeriodMinutes}
                onChange={(e) => setGracePeriodMinutes(Number(e.target.value))}
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={isNightShift} onCheckedChange={(v) => setIsNightShift(Boolean(v))} />
            Night shift (crosses midnight)
          </label>
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
