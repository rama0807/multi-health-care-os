'use client'

import { PurchaseOrderStatus } from '@medicore/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useState } from 'react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { approvePurchaseOrder, cancelPurchaseOrder, getPurchaseOrder, sendPurchaseOrder, submitPurchaseOrder } from '@/lib/api/procurement'
import { useAuth } from '@/lib/auth/auth-context'

function getErrorMessage(error: unknown): string {
  const axiosError = error as { response?: { data?: { error?: { message?: string } } } }
  return axiosError?.response?.data?.error?.message ?? 'Something went wrong. Please try again.'
}

function formatEnumLabel(value: string): string {
  return value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, ' ')
}

const STATUS_BADGE: Record<PurchaseOrderStatus, 'secondary' | 'outline' | 'success' | 'destructive'> = {
  [PurchaseOrderStatus.DRAFT]: 'secondary',
  [PurchaseOrderStatus.SUBMITTED]: 'outline',
  [PurchaseOrderStatus.APPROVED]: 'outline',
  [PurchaseOrderStatus.SENT]: 'outline',
  [PurchaseOrderStatus.PARTIALLY_RECEIVED]: 'outline',
  [PurchaseOrderStatus.RECEIVED]: 'success',
  [PurchaseOrderStatus.CANCELLED]: 'destructive',
}

export default function PurchaseOrderDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
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
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (poQuery.isError || !poQuery.data) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Purchase order not found</AlertTitle>
        <AlertDescription>
          {getErrorMessage(poQuery.error)}{' '}
          <Button variant="link" className="h-auto p-0" onClick={() => router.push('/dashboard/inventory/purchase-orders')}>
            Back to list
          </Button>
        </AlertDescription>
      </Alert>
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
    <div className="space-y-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-mono text-lg font-semibold text-foreground">{po.poNumber}</h1>
            <Badge variant={STATUS_BADGE[po.status]}>{formatEnumLabel(po.status)}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {po.vendor.name} → {po.store.name}
          </p>
          {po.cancelReason && <p className="text-xs text-destructive">Cancelled: {po.cancelReason}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
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
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        <div className="border-b p-3">
          <h3 className="text-sm font-semibold text-foreground">Items</h3>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead>Ordered</TableHead>
              <TableHead>Received</TableHead>
              <TableHead>Unit price</TableHead>
              <TableHead>Tax %</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {po.items.map((item) => (
              <TableRow key={item.id}>
                <TableCell>
                  {item.item.name} <span className="font-mono text-xs text-muted-foreground">({item.item.code})</span>
                </TableCell>
                <TableCell>{item.quantityOrdered}</TableCell>
                <TableCell>{item.quantityReceived}</TableCell>
                <TableCell className="text-xs">₹{item.unitPrice}</TableCell>
                <TableCell className="text-xs">{item.taxPercent}%</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="flex justify-end border-t p-3 text-sm font-semibold">
          Total: ₹{Number(po.totalAmount).toLocaleString('en-IN')}
        </div>
      </div>

      {po.notes && (
        <div className="rounded-lg border bg-card p-3 text-sm">
          <span className="font-semibold text-foreground">Notes: </span>
          {po.notes}
        </div>
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
    </div>
  )
}
