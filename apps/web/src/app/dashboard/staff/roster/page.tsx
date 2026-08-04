'use client'

import type { ShiftRoster } from '@medicore/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Loader2, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'
import { assignShiftRoster, listShiftRoster, listShifts } from '@/lib/api/shifts'
import { listStaff } from '@/lib/api/staff'
import { useAuth } from '@/lib/auth/auth-context'

function getErrorMessage(error: unknown): string {
  const axiosError = error as { response?: { data?: { error?: { message?: string } } } }
  return axiosError?.response?.data?.error?.message ?? 'Something went wrong. Please try again.'
}

function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function startOfWeek(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d
}

export default function RosterPage() {
  const { hasPermission } = useAuth()
  const canAssign = hasPermission('shifts.roster.create')

  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()))
  const [dialogOpen, setDialogOpen] = useState(false)

  const weekDates = useMemo(
    () => Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart)
      d.setDate(d.getDate() + i)
      return d
    }),
    [weekStart],
  )
  const from = toDateString(weekDates[0])
  const to = toDateString(weekDates[6])

  const staffQuery = useQuery({ queryKey: ['staff', 'list', 'roster-picker'], queryFn: () => listStaff({ limit: 100 }) })
  const staff = staffQuery.data?.data ?? []

  const rosterQuery = useQuery({ queryKey: ['shifts', 'roster', from, to], queryFn: () => listShiftRoster({ from, to }) })
  const rosterByStaffAndDate = useMemo(() => {
    const map = new Map<string, ShiftRoster>()
    for (const entry of rosterQuery.data ?? []) map.set(`${entry.staffId}-${entry.date}`, entry)
    return map
  }, [rosterQuery.data])

  return (
    <div className="space-y-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Weekly Roster</h1>
          <p className="text-sm text-muted-foreground">Shift assignments per staff member for the selected week.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setWeekStart((w) => new Date(w.getFullYear(), w.getMonth(), w.getDate() - 7))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            {from} – {to}
          </span>
          <Button variant="outline" size="sm" onClick={() => setWeekStart((w) => new Date(w.getFullYear(), w.getMonth(), w.getDate() + 7))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          {canAssign && (
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4" />
              Assign
            </Button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="sticky left-0 bg-card">Staff</TableHead>
              {weekDates.map((d) => (
                <TableHead key={toDateString(d)} className="whitespace-nowrap text-center">
                  {d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {staffQuery.isLoading || rosterQuery.isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                </TableCell>
              </TableRow>
            ) : staff.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                  No staff members yet.
                </TableCell>
              </TableRow>
            ) : (
              staff.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="sticky left-0 bg-card font-medium">{s.fullName}</TableCell>
                  {weekDates.map((d) => {
                    const entry = rosterByStaffAndDate.get(`${s.id}-${toDateString(d)}`)
                    return (
                      <TableCell key={toDateString(d)} className="text-center text-xs">
                        {!entry ? (
                          <span className="text-muted-foreground">—</span>
                        ) : entry.isOff ? (
                          <Badge variant="secondary">Off</Badge>
                        ) : (
                          <Badge variant="outline">{entry.shift?.code ?? '—'}</Badge>
                        )}
                      </TableCell>
                    )
                  })}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <AssignDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  )
}

function AssignDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [staffId, setStaffId] = useState('')
  const [date, setDate] = useState(toDateString(new Date()))
  const [shiftId, setShiftId] = useState('')
  const [isOff, setIsOff] = useState(false)

  const staffQuery = useQuery({ queryKey: ['staff', 'list', 'roster-picker'], queryFn: () => listStaff({ limit: 100 }) })
  const shiftsQuery = useQuery({ queryKey: ['shifts', 'list'], queryFn: () => listShifts({ isActive: true }) })

  const mutation = useMutation({
    mutationFn: () => assignShiftRoster({ staffId, date, shiftId: isOff ? undefined : shiftId, isOff }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['shifts', 'roster'] })
      toast({ title: 'Roster updated' })
      onOpenChange(false)
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Could not assign shift', description: getErrorMessage(error) }),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign shift</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Select value={staffId} onValueChange={setStaffId}>
            <SelectTrigger>
              <SelectValue placeholder="Select staff member" />
            </SelectTrigger>
            <SelectContent>
              {staffQuery.data?.data.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.fullName} ({s.employeeId})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={isOff} onCheckedChange={(v) => setIsOff(Boolean(v))} />
            Day off (week-off)
          </label>
          {!isOff && (
            <Select value={shiftId} onValueChange={setShiftId}>
              <SelectTrigger>
                <SelectValue placeholder="Select shift" />
              </SelectTrigger>
              <SelectContent>
                {shiftsQuery.data?.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name} ({s.startTime}–{s.endTime})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={!staffId || !date || (!isOff && !shiftId) || mutation.isPending}>
            {mutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Assign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
