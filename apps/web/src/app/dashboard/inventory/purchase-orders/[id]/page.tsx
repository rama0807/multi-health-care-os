'use client'

import { PurchaseOrderStatus } from '@medicore/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useState } from 'react'

import { PageLayout } from '@/components/layout/page-layout'
import { Button } from '@/components/ui/button'
import { Card, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { StatusBadge } from '@/components/ui/status-badge'
import { Table, TableBody, TableCell, TableContainer, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { approvePurchaseOrder, cancelPurchaseOrder, getPurchaseOrder, sendPurchaseOrder, submitPurchaseOrder } from '@/lib/api/procurement'
import { useAuth } from '@/lib/auth/auth-context'

function getErrorMessage(error: unknown): string {
  const axiosError = error as { response?: { data?: { error?: { message?: string } } } }
  return axiosError?.response?.data?.error?.message ?? 'Something went wrong. Please try again.'
}

export default function PurchaseOrderDetailPage() {
  const params = useParams<{ id: string }>()
  const { hasPermission } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const canUpdate = hasPermission('inventory.procurement.update')
  const canApprove = hasPermission('inventory.procurement.approve')

  const [cancelOpen, setCancelOpen] = useState(false)
  const [reason, setReason] = useState('')

  const poQuery = useQuery({ queryKey: ['inventory', 'purchase-orders', 'detail', params.id], queryFn: () => getPurchaseOrder(params.id) })

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ['inventory', 'purchase-orders'] })
  }

  const submitMutation = useMutation({
    mutationFn: () => submitPurchaseOrder(params.id),
    onSuccess: () => {
      toast({ title: 'Order submitted' })
      invalidate()
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Could not submit', description: getErrorMessage(error) }),
  })
  const approveMutation = useMutation({
    mutationFn: () => approvePurchaseOrder(params.id),
    onSuccess: () => {
      toast({ title: 'Order approved' })
      invalidate()
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Could not approve', description: getErrorMessage(error) }),
  })
  const sendMutation = useMutation({
    mutationFn: () => sendPurchaseOrder(params.id),
    onSuccess: () => {
      toast({ title: 'Order sent to vendor' })
      invalidate()
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Could not send', description: getErrorMessage(error) }),
  })
  const cancelMutation = useMutation({
    mutationFn: () => cancelPurchaseOrder(params.id, { reason }),
    onSuccess: () => {
      toast({ title: 'Order cancelled' })
      setCancelOpen(false)
      setReason('')
      invalidate()
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Could not cancel', description: getErrorMessage(error) }),
  })

  if (poQuery.isLoading) {
    return (
      <PageLayout
        breadcrumbs={[{ label: 'Inventory', href: '/dashboard/inventory' }, { label: 'Purchase Orders', href: '/dashboard/inventory/purchase-orders' }, { label: '…' }]}
        title="…"
        loading
      >
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </PageLayout>
    )
  }

  if (poQuery.isError || !poQuery.data) {
    return (
      <PageLayout
        breadcrumbs={[{ label: 'Inventory', href: '/dashboard/inventory' }, { label: 'Purchase Orders', href: '/dashboard/inventory/purchase-orders' }, { label: 'Not found' }]}
        title="Purchase order not found"
      >
        <EmptyState
          variant="error"
          title="Purchase order not found"
          description={getErrorMessage(poQuery.error)}
          action={{ label: 'Back to list', href: '/dashboard/inventory/purchase-orders' }}
        />
      </PageLayout>
    )
  }

  const po = poQuery.data
  const canCancel = [
    PurchaseOrderStatus.DRAFT,
    PurchaseOrderStatus.SUBMITTED,
    PurchaseOrderStatus.APPROVED,
    PurchaseOrderStatus.SENT,
  ].includes(po.status)
  const canReceive = po.status === PurchaseOrderStatus.SENT || po.status === PurchaseOrderStatus.PARTIALLY_RECEIVED

  return (
    <PageLayout
      breadcrumbs={[
        { label: 'Inventory', href: '/dashboard/inventory' },
        { label: 'Purchase Orders', href: '/dashboard/inventory/purchase-orders' },
        { label: po.poNumber },
      ]}
      title={po.poNumber}
      badge={<StatusBadge status={po.status} />}
      description={po.cancelReason ? `Cancelled: ${po.cancelReason}` : undefined}
      meta={<span>{po.vendor.name} → {po.store.name}</span>}
      actions={
        <>
          {canReceive && (
            <Button size="sm" asChild>
              <Link href={`/dashboard/inventory/grn?fromPo=${po.id}`}>Record goods receipt</Link>
            </Button>
          )}
          {canUpdate && (
            <>
              {po.status === PurchaseOrderStatus.DRAFT && (
                <Button size="sm" variant="outline" onClick={() => submitMutation.mutate()} disabled={submitMutation.isPending}>
                  Submit
                </Button>
              )}
              {canApprove && po.status === PurchaseOrderStatus.SUBMITTED && (
                <Button size="sm" variant="outline" onClick={() => approveMutation.mutate()} disabled={approveMutation.isPending}>
                  Approve
                </Button>
              )}
              {po.status === PurchaseOrderStatus.APPROVED && (
                <Button size="sm" variant="outline" onClick={() => sendMutation.mutate()} disabled={sendMutation.isPending}>
                  Send to vendor
                </Button>
              )}
              {canCancel && (
                <Button size="sm" variant="outline" onClick={() => setCancelOpen(true)}>
                  Cancel
                </Button>
              )}
            </>
          )}
        </>
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
                <TableHead>Item</TableHead>
                <TableHead align="right">Ordered</TableHead>
                <TableHead align="right">Received</TableHead>
                <TableHead align="right">Unit price</TableHead>
                <TableHead align="right">Tax %</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {po.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    {item.item.name} <span className="font-mono text-xs text-muted-foreground">({item.item.code})</span>
                  </TableCell>
                  <TableCell align="right">{item.quantityOrdered}</TableCell>
                  <TableCell align="right">{item.quantityReceived}</TableCell>
                  <TableCell align="right" className="text-xs">₹{item.unitPrice}</TableCell>
                  <TableCell align="right" className="text-xs">{item.taxPercent}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <CardFooter className="justify-end font-semibold">
          Total: ₹{Number(po.totalAmount).toLocaleString('en-IN')}
        </CardFooter>
      </Card>

      {po.notes && (
        <Card className="p-3 text-sm">
          <span className="font-semibold text-foreground">Notes: </span>
          {po.notes}
        </Card>
      )}

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel order</DialogTitle>
            <DialogDescription>A reason is required.</DialogDescription>
          </DialogHeader>
          <Textarea placeholder="Reason" value={reason} onChange={(e) => setReason(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)}>
              Back
            </Button>
            <Button variant="destructive" onClick={() => cancelMutation.mutate()} disabled={!reason.trim() || cancelMutation.isPending}>
              {cancelMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Confirm cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageLayout>
  )
}
