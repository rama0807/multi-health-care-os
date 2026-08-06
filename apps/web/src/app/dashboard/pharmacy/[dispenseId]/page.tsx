'use client'

import { DispenseStatus } from '@medicore/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'

import { PageLayout } from '@/components/layout/page-layout'
import { Button } from '@/components/ui/button'
import { Card, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { PageHeaderMeta } from '@/components/ui/page-header'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { StatusBadge } from '@/components/ui/status-badge'
import { Table, TableBody, TableCell, TableContainer, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import {
  cancelDispenseOrder,
  createDrugReturn,
  dispenseComplete,
  dispensePartial,
  getDispenseOrder,
  listDrugCatalog,
  markDispenseReady,
  prepareDispenseItems,
  rejectDispenseOrder,
} from '@/lib/api/pharmacy'
import { useAuth } from '@/lib/auth/auth-context'

function getErrorMessage(error: unknown): string {
  const axiosError = error as { response?: { data?: { error?: { message?: string } } } }
  return axiosError?.response?.data?.error?.message ?? 'Something went wrong. Please try again.'
}

export default function DispenseOrderDetailPage() {
  const params = useParams<{ dispenseId: string }>()
  const dispenseId = params.dispenseId
  const { hasPermission } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const canUpdate = hasPermission('pharmacy.update')

  const orderQuery = useQuery({ queryKey: ['pharmacy', 'dispense', 'detail', dispenseId], queryFn: () => getDispenseOrder(dispenseId) })
  const catalogQuery = useQuery({
    queryKey: ['pharmacy', 'catalog', 'active-for-dispense'],
    queryFn: () => listDrugCatalog({ isActive: true, limit: 200 }),
  })

  const [selectedDrug, setSelectedDrug] = useState<Record<string, string>>({})
  const [partialQty, setPartialQty] = useState<Record<string, string>>({})
  const [reasonDialog, setReasonDialog] = useState<'reject' | 'cancel' | null>(null)
  const [reason, setReason] = useState('')
  const [returnItemId, setReturnItemId] = useState('')
  const [returnQty, setReturnQty] = useState('')
  const [returnReason, setReturnReason] = useState('')

  useEffect(() => {
    if (!orderQuery.data) return
    setSelectedDrug((prev) => {
      const next = { ...prev }
      for (const item of orderQuery.data.items) {
        if (!(item.id in next)) next[item.id] = item.drugId ?? ''
      }
      return next
    })
  }, [orderQuery.data])

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ['pharmacy', 'dispense', 'detail', dispenseId] })
    void queryClient.invalidateQueries({ queryKey: ['pharmacy', 'dispense', 'list'] })
    void queryClient.invalidateQueries({ queryKey: ['pharmacy', 'catalog'] })
  }

  const prepareMutation = useMutation({
    mutationFn: (items: Array<{ dispenseItemId: string; drugId: string }>) => prepareDispenseItems(dispenseId, { items }),
    onSuccess: () => {
      toast({ title: 'Batch selection saved' })
      invalidate()
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Could not save batch selection', description: getErrorMessage(error) }),
  })

  const readyMutation = useMutation({
    mutationFn: () => markDispenseReady(dispenseId),
    onSuccess: () => {
      toast({ title: 'Order marked ready' })
      invalidate()
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Could not mark ready', description: getErrorMessage(error) }),
  })

  const partialMutation = useMutation({
    mutationFn: (items: Array<{ dispenseItemId: string; quantity: number }>) => dispensePartial(dispenseId, { items }),
    onSuccess: () => {
      toast({ title: 'Partially dispensed' })
      setPartialQty({})
      invalidate()
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Could not dispense', description: getErrorMessage(error) }),
  })

  const completeMutation = useMutation({
    mutationFn: () => dispenseComplete(dispenseId),
    onSuccess: () => {
      toast({ title: 'Dispensed' })
      invalidate()
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Could not complete dispense', description: getErrorMessage(error) }),
  })

  const rejectMutation = useMutation({
    mutationFn: () => rejectDispenseOrder(dispenseId, { reason: reason || undefined }),
    onSuccess: () => {
      toast({ title: 'Order rejected' })
      setReasonDialog(null)
      setReason('')
      invalidate()
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Could not reject order', description: getErrorMessage(error) }),
  })

  const cancelMutation = useMutation({
    mutationFn: () => cancelDispenseOrder(dispenseId, { reason: reason || undefined }),
    onSuccess: () => {
      toast({ title: 'Order cancelled' })
      setReasonDialog(null)
      setReason('')
      invalidate()
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Could not cancel order', description: getErrorMessage(error) }),
  })

  const returnMutation = useMutation({
    mutationFn: () => createDrugReturn(dispenseId, { dispenseItemId: returnItemId, quantityReturned: Number(returnQty), reason: returnReason }),
    onSuccess: () => {
      toast({ title: 'Return recorded' })
      setReturnItemId('')
      setReturnQty('')
      setReturnReason('')
      invalidate()
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Could not record return', description: getErrorMessage(error) }),
  })

  if (orderQuery.isLoading) {
    return (
      <PageLayout
        breadcrumbs={[{ label: 'Pharmacy', href: '/dashboard/pharmacy' }, { label: 'Dispensing Queue', href: '/dashboard/pharmacy/dispense' }, { label: '…' }]}
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
        breadcrumbs={[{ label: 'Pharmacy', href: '/dashboard/pharmacy' }, { label: 'Dispensing Queue', href: '/dashboard/pharmacy/dispense' }, { label: 'Not found' }]}
        title="Dispense order not found"
      >
        <EmptyState
          variant="error"
          title="Dispense order not found"
          description={getErrorMessage(orderQuery.error)}
          action={{ label: 'Back to queue', href: '/dashboard/pharmacy/dispense' }}
        />
      </PageLayout>
    )
  }

  const order = orderQuery.data
  const canEditBatches = order.status === DispenseStatus.PENDING || order.status === DispenseStatus.PREPARING
  const canCancelOrReject =
    order.status === DispenseStatus.PENDING || order.status === DispenseStatus.PREPARING || order.status === DispenseStatus.READY
  const allItemsAssigned = order.items.every((i) => Boolean(selectedDrug[i.id] || i.drugId))
  const canReturn = order.status === DispenseStatus.DISPENSED || order.status === DispenseStatus.RETURNED

  function returnedSoFar(itemId: string): number {
    return order.returns.filter((r) => r.dispenseItemId === itemId).reduce((sum, r) => sum + r.quantityReturned, 0)
  }

  return (
    <PageLayout
      breadcrumbs={[
        { label: 'Pharmacy', href: '/dashboard/pharmacy' },
        { label: 'Dispensing Queue', href: '/dashboard/pharmacy/dispense' },
        { label: order.dispenseNumber },
      ]}
      title={order.dispenseNumber}
      badge={<StatusBadge status={order.status} />}
      meta={
        <PageHeaderMeta label="Patient">
          {order.patient.fullName} ({order.patient.uhid}) · Prescription {order.prescription.prescriptionNumber} by Dr.{' '}
          {order.prescription.doctorFullName}
        </PageHeaderMeta>
      }
      actions={
        canUpdate &&
        canCancelOrReject && (
          <>
            <Button variant="outline" size="sm" onClick={() => setReasonDialog('reject')}>
              Reject
            </Button>
            <Button variant="outline" size="sm" onClick={() => setReasonDialog('cancel')}>
              Cancel
            </Button>
          </>
        )
      }
    >
      <Card>
        <CardHeader>
          <CardTitle>Items</CardTitle>
        </CardHeader>
        <TableContainer className="rounded-none border-0 border-y">
          <Table density="compact" container={false}>
            <TableHeader>
              <TableRow>
                <TableHead>Medication</TableHead>
                <TableHead>Requested</TableHead>
                <TableHead>Dispensed</TableHead>
                <TableHead>Batch</TableHead>
                {order.status === DispenseStatus.READY && <TableHead>Dispense now</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {order.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.medicationName}</TableCell>
                  <TableCell>{item.quantityRequested}</TableCell>
                  <TableCell>{item.quantityDispensed}</TableCell>
                  <TableCell>
                    {canEditBatches && canUpdate ? (
                      <Select
                        value={selectedDrug[item.id] ?? ''}
                        onValueChange={(value) => setSelectedDrug((prev) => ({ ...prev, [item.id]: value }))}
                      >
                        <SelectTrigger className="w-56">
                          <SelectValue placeholder="Select a batch" />
                        </SelectTrigger>
                        <SelectContent>
                          {catalogQuery.data?.data.map((drug) => (
                            <SelectItem key={drug.id} value={drug.id}>
                              {drug.genericName} · {drug.batchNumber} (avail {drug.availableStock})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : item.drug ? (
                      <span className="text-xs text-muted-foreground">
                        {item.drug.genericName} · Batch {item.drug.batchNumber}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Not selected</span>
                    )}
                  </TableCell>
                  {order.status === DispenseStatus.READY && (
                    <TableCell>
                      <Input
                        className="h-8 w-20"
                        type="number"
                        placeholder="Qty"
                        value={partialQty[item.id] ?? ''}
                        onChange={(e) => setPartialQty((prev) => ({ ...prev, [item.id]: e.target.value }))}
                      />
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {canEditBatches && canUpdate && (
          <CardFooter className="justify-end">
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                prepareMutation.mutate(
                  order.items
                    .filter((item) => selectedDrug[item.id])
                    .map((item) => ({ dispenseItemId: item.id, drugId: selectedDrug[item.id] })),
                )
              }
              disabled={prepareMutation.isPending}
            >
              {prepareMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Save batch selection
            </Button>
            {order.status === DispenseStatus.PREPARING && (
              <Button size="sm" onClick={() => readyMutation.mutate()} disabled={!allItemsAssigned || readyMutation.isPending}>
                Mark ready
              </Button>
            )}
          </CardFooter>
        )}

        {order.status === DispenseStatus.READY && canUpdate && (
          <CardFooter className="justify-end">
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                partialMutation.mutate(
                  Object.entries(partialQty)
                    .filter(([, qty]) => Number(qty) > 0)
                    .map(([dispenseItemId, qty]) => ({ dispenseItemId, quantity: Number(qty) })),
                )
              }
              disabled={Object.values(partialQty).every((q) => !q) || partialMutation.isPending}
            >
              Dispense partial
            </Button>
            <Button size="sm" onClick={() => completeMutation.mutate()} disabled={completeMutation.isPending}>
              {completeMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Complete dispense
            </Button>
          </CardFooter>
        )}
      </Card>

      {canReturn && (
        <Card>
          <CardHeader>
            <CardTitle>Returns</CardTitle>
          </CardHeader>
          {order.returns.length > 0 && (
            <ul className="divide-y">
              {order.returns.map((r) => (
                <li key={r.id} className="p-3 text-sm">
                  {order.items.find((i) => i.id === r.dispenseItemId)?.medicationName ?? 'Item'} — {r.quantityReturned} unit(s) returned:{' '}
                  {r.reason}
                  <div className="text-xs text-muted-foreground">{new Date(r.returnedAt).toLocaleString('en-IN')}</div>
                </li>
              ))}
            </ul>
          )}

          {canUpdate && (
            <div className="grid grid-cols-1 gap-2 border-t p-3 sm:grid-cols-4">
              <Select value={returnItemId} onValueChange={setReturnItemId}>
                <SelectTrigger>
                  <SelectValue placeholder="Item" />
                </SelectTrigger>
                <SelectContent>
                  {order.items
                    .filter((i) => i.quantityDispensed - returnedSoFar(i.id) > 0)
                    .map((i) => (
                      <SelectItem key={i.id} value={i.id}>
                        {i.medicationName} (returnable {i.quantityDispensed - returnedSoFar(i.id)})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <Input placeholder="Quantity" type="number" value={returnQty} onChange={(e) => setReturnQty(e.target.value)} />
              <Input placeholder="Reason *" value={returnReason} onChange={(e) => setReturnReason(e.target.value)} className="sm:col-span-1" />
              <Button
                onClick={() => returnMutation.mutate()}
                disabled={!returnItemId || !returnQty || !returnReason || returnMutation.isPending}
              >
                {returnMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Record return
              </Button>
            </div>
          )}
        </Card>
      )}

      <Dialog open={reasonDialog !== null} onOpenChange={(open) => !open && setReasonDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{reasonDialog === 'reject' ? 'Reject order' : 'Cancel order'}</DialogTitle>
            <DialogDescription>Optionally record a reason — this is kept on the order for audit.</DialogDescription>
          </DialogHeader>
          <Textarea placeholder="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setReasonDialog(null)}>
              Back
            </Button>
            <Button
              variant="destructive"
              onClick={() => (reasonDialog === 'reject' ? rejectMutation.mutate() : cancelMutation.mutate())}
              disabled={rejectMutation.isPending || cancelMutation.isPending}
            >
              Confirm {reasonDialog === 'reject' ? 'reject' : 'cancel'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageLayout>
  )
}
