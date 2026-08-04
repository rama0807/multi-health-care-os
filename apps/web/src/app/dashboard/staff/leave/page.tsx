'use client'

import { LeaveStatus, type LeaveTypeConfig } from '@medicore/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Plus } from 'lucide-react'
import { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import {
  approveStaffLeave,
  createHoliday,
  listHolidays,
  listLeaveTypes,
  listStaffLeave,
  rejectStaffLeave,
  upsertLeaveType,
} from '@/lib/api/leave'
import { useAuth } from '@/lib/auth/auth-context'

function getErrorMessage(error: unknown): string {
  const axiosError = error as { response?: { data?: { error?: { message?: string } } } }
  return axiosError?.response?.data?.error?.message ?? 'Something went wrong. Please try again.'
}

function formatEnumLabel(value: string): string {
  return value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, ' ')
}

export default function LeavePage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Leave Management</h1>
        <p className="text-sm text-muted-foreground">Leave requests, leave type quotas, and the holiday calendar.</p>
      </div>

      <Tabs defaultValue="requests">
        <TabsList>
          <TabsTrigger value="requests">Requests</TabsTrigger>
          <TabsTrigger value="types">Leave types</TabsTrigger>
          <TabsTrigger value="holidays">Holidays</TabsTrigger>
        </TabsList>
        <TabsContent value="requests">
          <RequestsTab />
        </TabsContent>
        <TabsContent value="types">
          <LeaveTypesTab />
        </TabsContent>
        <TabsContent value="holidays">
          <HolidaysTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function RequestsTab() {
  const { hasPermission } = useAuth()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const canApprove = hasPermission('leave.approve')

  const [status, setStatus] = useState<LeaveStatus | 'ALL'>(LeaveStatus.PENDING)

  const leaveQuery = useQuery({
    queryKey: ['leave', 'list', 'org', status],
    queryFn: () => listStaffLeave({ status: status === 'ALL' ? undefined : status, limit: 50 }),
  })

  const approveMutation = useMutation({
    mutationFn: (id: string) => approveStaffLeave(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['leave'] })
      toast({ title: 'Leave approved' })
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Could not approve leave', description: getErrorMessage(error) }),
  })

  const rejectMutation = useMutation({
    mutationFn: (id: string) => rejectStaffLeave(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['leave'] })
      toast({ title: 'Leave rejected' })
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Could not reject leave', description: getErrorMessage(error) }),
  })

  return (
    <div className="space-y-4">
      <Select value={status} onValueChange={(v) => setStatus(v as LeaveStatus | 'ALL')}>
        <SelectTrigger className="w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">All statuses</SelectItem>
          {Object.values(LeaveStatus).map((s) => (
            <SelectItem key={s} value={s}>
              {formatEnumLabel(s)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Staff</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Dates</TableHead>
              <TableHead>Days</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leaveQuery.isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                </TableCell>
              </TableRow>
            ) : leaveQuery.data?.data.length ? (
              leaveQuery.data.data.map((leave) => (
                <TableRow key={leave.id}>
                  <TableCell className="font-medium">{leave.staff?.fullName ?? leave.staffId}</TableCell>
                  <TableCell>{formatEnumLabel(leave.leaveType)}</TableCell>
                  <TableCell>
                    {leave.startDate} → {leave.endDate}
                  </TableCell>
                  <TableCell>{leave.days}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{formatEnumLabel(leave.status)}</Badge>
                  </TableCell>
                  <TableCell className="flex gap-1">
                    {canApprove && leave.status === LeaveStatus.PENDING && (
                      <>
                        <Button variant="ghost" size="sm" onClick={() => approveMutation.mutate(leave.id)}>
                          Approve
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => rejectMutation.mutate(leave.id)}>
                          Reject
                        </Button>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  No leave requests found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

function LeaveTypesTab() {
  const { hasPermission } = useAuth()
  const canManage = hasPermission('leave.manage')

  const typesQuery = useQuery({ queryKey: ['leave', 'types'], queryFn: listLeaveTypes })

  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Leave type</TableHead>
            <TableHead>Annual days</TableHead>
            <TableHead>Paid</TableHead>
            <TableHead>Active</TableHead>
            {canManage && <TableHead>Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {typesQuery.isLoading ? (
            <TableRow>
              <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                <Loader2 className="mx-auto h-5 w-5 animate-spin" />
              </TableCell>
            </TableRow>
          ) : (
            typesQuery.data?.map((config) => <LeaveTypeRow key={config.leaveType} config={config} canManage={canManage} />)
          )}
        </TableBody>
      </Table>
    </div>
  )
}

function LeaveTypeRow({ config, canManage }: { config: LeaveTypeConfig; canManage: boolean }) {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const [annualDays, setAnnualDays] = useState(config.annualDays)
  const [isPaid, setIsPaid] = useState(config.isPaid)
  const [isActive, setIsActive] = useState(config.isActive)

  const mutation = useMutation({
    mutationFn: () => upsertLeaveType({ leaveType: config.leaveType, annualDays, isPaid, isActive }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['leave', 'types'] })
      toast({ title: 'Leave type saved' })
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Could not save leave type', description: getErrorMessage(error) }),
  })

  return (
    <TableRow>
      <TableCell className="font-medium">{formatEnumLabel(config.leaveType)}</TableCell>
      <TableCell>
        {canManage ? (
          <Input type="number" min={0} max={365} value={annualDays} onChange={(e) => setAnnualDays(Number(e.target.value))} className="w-20" />
        ) : (
          annualDays
        )}
      </TableCell>
      <TableCell>
        {canManage ? <Checkbox checked={isPaid} onCheckedChange={(v) => setIsPaid(Boolean(v))} /> : isPaid ? 'Yes' : 'No'}
      </TableCell>
      <TableCell>
        {canManage ? <Checkbox checked={isActive} onCheckedChange={(v) => setIsActive(Boolean(v))} /> : isActive ? 'Yes' : 'No'}
      </TableCell>
      {canManage && (
        <TableCell>
          <Button variant="ghost" size="sm" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Save
          </Button>
        </TableCell>
      )}
    </TableRow>
  )
}

function HolidaysTab() {
  const { hasPermission } = useAuth()
  const canManage = hasPermission('leave.manage')

  const [dialogOpen, setDialogOpen] = useState(false)
  const year = new Date().getFullYear()

  const holidaysQuery = useQuery({ queryKey: ['leave', 'holidays', year], queryFn: () => listHolidays(year) })

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        {canManage && (
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="h-3.5 w-3.5" />
            Add holiday
          </Button>
        )}
      </div>
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Optional</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {holidaysQuery.isLoading ? (
              <TableRow>
                <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                </TableCell>
              </TableRow>
            ) : holidaysQuery.data?.length ? (
              holidaysQuery.data.map((h) => (
                <TableRow key={h.id}>
                  <TableCell className="font-medium">{h.name}</TableCell>
                  <TableCell>{h.date}</TableCell>
                  <TableCell>{h.isOptional ? 'Yes' : 'No'}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                  No holidays configured for {year} yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <AddHolidayDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  )
}

function AddHolidayDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [name, setName] = useState('')
  const [date, setDate] = useState('')
  const [isOptional, setIsOptional] = useState(false)

  const mutation = useMutation({
    mutationFn: () => createHoliday({ name, date, isOptional }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['leave', 'holidays'] })
      toast({ title: 'Holiday added' })
      setName('')
      setDate('')
      onOpenChange(false)
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Could not add holiday', description: getErrorMessage(error) }),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add holiday</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={isOptional} onCheckedChange={(v) => setIsOptional(Boolean(v))} />
            Optional holiday
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={!name.trim() || !date || mutation.isPending}>
            {mutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
