'use client'

import { DispenseStatus } from '@medicore/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Pill, Plus } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'
import { createDispenseOrder, dispenseComplete, listDispenseOrders } from '@/lib/api/pharmacy'
import { listPrescriptions } from '@/lib/api/prescriptions'
import { useAuth } from '@/lib/auth/auth-context'

function getErrorMessage(error: unknown): string {
  const axiosError = error as { response?: { data?: { error?: { message?: string } } } }
  return axiosError?.response?.data?.error?.message ?? 'Something went wrong. Please try again.'
}

function formatEnumLabel(value: string): string {
  return value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, ' ')
}

const STATUS_BADGE: Record<DispenseStatus, 'secondary' | 'success' | 'destructive' | 'outline'> = {
  [DispenseStatus.PENDING]: 'secondary',
  [DispenseStatus.PREPARING]: 'outline',
  [DispenseStatus.READY]: 'outline',
  [DispenseStatus.DISPENSED]: 'success',
  [DispenseStatus.CANCELLED]: 'destructive',
  [DispenseStatus.RETURNED]: 'destructive',
}

export default function PharmacyDispenseQueuePage() {
  const { hasPermission } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [status, setStatus] = useState<string>('all')
  const [dialogOpen, setDialogOpen] = useState(false)

  const canCreate = hasPermission('pharmacy.create')
  const canUpdate = hasPermission('pharmacy.update')

  const ordersQuery = useQuery({
    queryKey: ['pharmacy', 'dispense', 'list', { status }],
    queryFn: () =>
      listDispenseOrders({
        status: status === 'all' ? undefined : (status as DispenseStatus),
        limit: 100,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      }),
  })

  function invalidateOrders() {
    void queryClient.invalidateQueries({ queryKey: ['pharmacy', 'dispense', 'list'] })
  }

  const completeMutation = useMutation({
    mutationFn: (id: string) => dispenseComplete(id),
    onSuccess: () => {
      toast({ title: 'Dispensed' })
      invalidateOrders()
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Could not dispense', description: getErrorMessage(error) }),
  })

  const orders = ordersQuery.data?.data ?? []

  return (
    <div className="space-y-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Dispensing Queue</h1>
          <p className="text-sm text-muted-foreground">
            {ordersQuery.data ? `${ordersQuery.data.pagination.total} order${ordersQuery.data.pagination.total === 1 ? '' : 's'}` : 'Loading...'}
          </p>
        </div>
        {canCreate && (
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            New dispense
          </Button>
        )}
      </div>

      <Select value={status} onValueChange={setStatus}>
        <SelectTrigger className="sm:w-48">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          {Object.values(DispenseStatus).map((s) => (
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
              <TableHead>Dispense #</TableHead>
              <TableHead>Patient</TableHead>
              <TableHead>Prescription</TableHead>
              <TableHead>Prescribing doctor</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ordersQuery.isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                </TableCell>
              </TableRow>
            ) : ordersQuery.isError ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  Couldn&apos;t load dispense orders. {getErrorMessage(ordersQuery.error)}
                </TableCell>
              </TableRow>
            ) : orders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  No dispense orders found.
                </TableCell>
              </TableRow>
            ) : (
              orders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell>
                    <Link href={`/dashboard/pharmacy/${order.id}`} className="flex items-center gap-1.5 font-mono text-xs hover:underline">
                      <Pill className="h-3.5 w-3.5 text-muted-foreground" />
                      {order.dispenseNumber}
                    </Link>
                  </TableCell>
                  <TableCell>{order.patient.fullName}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{order.prescription.prescriptionNumber}</TableCell>
                  <TableCell>Dr. {order.prescription.doctorFullName}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_BADGE[order.status]}>{formatEnumLabel(order.status)}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-2">
                      {canUpdate && order.status === DispenseStatus.READY && (
                        <Button variant="outline" size="sm" onClick={() => completeMutation.mutate(order.id)} disabled={completeMutation.isPending}>
                          Dispense
                        </Button>
                      )}
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/dashboard/pharmacy/${order.id}`}>Open</Link>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <NewDispenseDialog open={dialogOpen} onOpenChange={setDialogOpen} onCreated={invalidateOrders} />
    </div>
  )
}

function NewDispenseDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => void
}) {
  const { toast } = useToast()
  const [prescriptionId, setPrescriptionId] = useState('')

  const prescriptionsQuery = useQuery({
    queryKey: ['prescriptions', 'list', 'active-for-dispense'],
    queryFn: () => listPrescriptions({ status: 'ACTIVE' as never, limit: 100 }),
    enabled: open,
  })

  const createMutation = useMutation({
    mutationFn: () => createDispenseOrder({ prescriptionId }),
    onSuccess: () => {
      toast({ title: 'Dispense order created' })
      setPrescriptionId('')
      onOpenChange(false)
      onCreated()
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Could not create dispense order', description: getErrorMessage(error) }),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New dispense</DialogTitle>
          <DialogDescription>Pick an active prescription to start dispensing.</DialogDescription>
        </DialogHeader>

        <Select value={prescriptionId} onValueChange={setPrescriptionId}>
          <SelectTrigger>
            <SelectValue placeholder="Select a prescription" />
          </SelectTrigger>
          <SelectContent>
            {prescriptionsQuery.data?.data.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.prescriptionNumber} — {p.patient.fullName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => createMutation.mutate()} disabled={!prescriptionId || createMutation.isPending}>
            {createMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
