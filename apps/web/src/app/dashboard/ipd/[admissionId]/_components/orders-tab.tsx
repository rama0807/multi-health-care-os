'use client'

import { IpdOrderStatus, NursingTaskStatus, type IpdOrder, type NursingTaskWithDetails } from '@medicore/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Loader2, Plus, XCircle } from 'lucide-react'
import { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { StatusBadge } from '@/components/ui/status-badge'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import {
  createIpdOrder,
  createNursingTask,
  discontinueIpdOrder,
  listIpdOrders,
  listNursingTasksForAdmission,
  updateNursingTaskStatus,
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

export function OrdersTab({
  admissionId,
  canOrder,
  canManageTasks,
}: {
  admissionId: string
  canOrder: boolean
  canManageTasks: boolean
}) {
  return (
    <div className="space-y-4">
      <IpdOrdersSection admissionId={admissionId} canOrder={canOrder} />
      <NursingTasksSection admissionId={admissionId} canManageTasks={canManageTasks} />
    </div>
  )
}

function IpdOrdersSection({ admissionId, canOrder }: { admissionId: string; canOrder: boolean }) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [category, setCategory] = useState('DIET')
  const [instructions, setInstructions] = useState('')

  const ordersQuery = useQuery({
    queryKey: ['ipd', 'orders', admissionId],
    queryFn: () => listIpdOrders(admissionId, { limit: 50 }),
  })

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ['ipd', 'orders', admissionId] })
  }

  const createMutation = useMutation({
    mutationFn: () => createIpdOrder(admissionId, { category: category as never, instructions }),
    onSuccess: () => {
      toast({ title: 'Order placed' })
      setOpen(false)
      setInstructions('')
      invalidate()
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Could not place order', description: getErrorMessage(error) }),
  })

  const discontinueMutation = useMutation({
    mutationFn: (orderId: string) => discontinueIpdOrder(admissionId, orderId, {}),
    onSuccess: () => {
      toast({ title: 'Order discontinued' })
      invalidate()
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Could not discontinue order', description: getErrorMessage(error) }),
  })

  const orders: IpdOrder[] = ordersQuery.data?.data ?? []

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Doctor orders - diet, fluid, activity, oxygen, isolation</h3>
        {canOrder && (
          <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
            <Plus className="h-3.5 w-3.5" />
            New order
          </Button>
        )}
      </div>
      {orders.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">No orders placed yet.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {orders.map((o) => (
            <li key={o.id} className="rounded-md border p-3 text-sm">
              <div className="flex items-center gap-2">
                <Badge variant="outline">{formatEnumLabel(o.category)}</Badge>
                <StatusBadge status={o.status} />
                <span className="ml-auto text-xs text-muted-foreground">{formatDateTime(o.startedAt)}</span>
              </div>
              <p className="mt-1 text-foreground">{o.instructions}</p>
              {o.status === IpdOrderStatus.ACTIVE && canOrder && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="mt-1"
                  disabled={discontinueMutation.isPending}
                  onClick={() => discontinueMutation.mutate(o.id)}
                >
                  <XCircle className="h-3.5 w-3.5" />
                  Discontinue
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New order</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DIET">Diet</SelectItem>
                <SelectItem value="FLUID">Fluid</SelectItem>
                <SelectItem value="ACTIVITY">Activity</SelectItem>
                <SelectItem value="OXYGEN">Oxygen</SelectItem>
                <SelectItem value="ISOLATION">Isolation precautions</SelectItem>
              </SelectContent>
            </Select>
            <Textarea placeholder="Instructions" value={instructions} onChange={(e) => setInstructions(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button disabled={!instructions || createMutation.isPending} onClick={() => createMutation.mutate()}>
              {createMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Place order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function NursingTasksSection({ admissionId, canManageTasks }: { admissionId: string; canManageTasks: boolean }) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [priority, setPriority] = useState('ROUTINE')

  const tasksQuery = useQuery({
    queryKey: ['ipd', 'nursing-tasks', admissionId],
    queryFn: () => listNursingTasksForAdmission(admissionId, { limit: 50 }),
  })

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ['ipd', 'nursing-tasks', admissionId] })
    void queryClient.invalidateQueries({ queryKey: ['ipd', 'nursing-tasks-queue'] })
    void queryClient.invalidateQueries({ queryKey: ['ipd', 'dashboard-stats'] })
  }

  const createMutation = useMutation({
    mutationFn: () => createNursingTask(admissionId, { title, priority: priority as never }),
    onSuccess: () => {
      toast({ title: 'Task created' })
      setOpen(false)
      setTitle('')
      invalidate()
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Could not create task', description: getErrorMessage(error) }),
  })

  const completeMutation = useMutation({
    mutationFn: (taskId: string) => updateNursingTaskStatus(taskId, { status: 'COMPLETED' as never }),
    onSuccess: () => {
      toast({ title: 'Task completed' })
      invalidate()
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Could not complete task', description: getErrorMessage(error) }),
  })

  const tasks: NursingTaskWithDetails[] = tasksQuery.data?.data ?? []

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Nursing tasks</h3>
        {canManageTasks && (
          <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
            <Plus className="h-3.5 w-3.5" />
            New task
          </Button>
        )}
      </div>
      {tasks.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">No nursing tasks yet.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {tasks.map((t) => (
            <li key={t.id} className="flex items-start justify-between gap-3 rounded-md border p-3 text-sm">
              <div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={t.priority} />
                  <StatusBadge status={t.status} />
                </div>
                <p className="mt-1 font-medium text-foreground">{t.title}</p>
                {t.description && <p className="text-muted-foreground">{t.description}</p>}
              </div>
              {canManageTasks && t.status !== NursingTaskStatus.COMPLETED && t.status !== NursingTaskStatus.CANCELLED && (
                <Button size="sm" variant="ghost" disabled={completeMutation.isPending} onClick={() => completeMutation.mutate(t.id)}>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Complete
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New nursing task</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Task title" value={title} onChange={(e) => setTitle(e.target.value)} />
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger>
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ROUTINE">Routine</SelectItem>
                <SelectItem value="URGENT">Urgent</SelectItem>
                <SelectItem value="STAT">STAT</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button disabled={!title || createMutation.isPending} onClick={() => createMutation.mutate()}>
              {createMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Create task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
