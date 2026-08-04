'use client'

import { GrnStatus, PurchaseOrderStatus } from '@medicore/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Plus } from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Pagination } from '@/components/ui/pagination'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { createGoodsReceiptNote, getPurchaseOrder, listGoodsReceiptNotes, listPurchaseOrders } from '@/lib/api/procurement'
import { useAuth } from '@/lib/auth/auth-context'

function getErrorMessage(error: unknown): string {
  const axiosError = error as { response?: { data?: { error?: { message?: string } } } }
  return axiosError?.response?.data?.error?.message ?? 'Something went wrong. Please try again.'
}

function formatEnumLabel(value: string): string {
  return value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, ' ')
}

const STATUS_BADGE: Record<GrnStatus, 'secondary' | 'success' | 'destructive'> = {
  [GrnStatus.DRAFT]: 'secondary',
  [GrnStatus.COMPLETED]: 'success',
  [GrnStatus.CANCELLED]: 'destructive',
}

export default function GoodsReceiptPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-muted-foreground">Loading...</div>}>
      <GoodsReceiptPageInner />
    </Suspense>
  )
}

function GoodsReceiptPageInner() {
  const { hasPermission } = useAuth()
  const canCreate = hasPermission('inventory.procurement.create')
  const searchParams = useSearchParams()
  const fromPo = searchParams.get('fromPo')

  const [status, setStatus] = useState<GrnStatus | 'ALL'>('ALL')
  const [page, setPage] = useState(1)
  const [createOpen, setCreateOpen] = useState(false)

  useEffect(() => {
    if (fromPo) setCreateOpen(true)
  }, [fromPo])

  const query = useQuery({
    queryKey: ['inventory', 'grn', 'list', { status, page }],
    queryFn: () => listGoodsReceiptNotes({ status: status === 'ALL' ? undefined : status, page, limit: 20 }),
  })

  const grns = query.data?.data ?? []
  const pagination = query.data?.pagination

  return (
    <div className="space-y-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Goods Receipt Notes</h1>
          <p className="text-sm text-muted-foreground">Physical receipt of goods against a sent purchase order — updates stock on completion.</p>
        </div>
        {canCreate && (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            New GRN
          </Button>
        )}
      </div>

      <Select
        value={status}
        onValueChange={(v) => {
          setStatus(v as GrnStatus | 'ALL')
          setPage(1)
        }}
      >
        <SelectTrigger className="w-48">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">All statuses</SelectItem>
          {Object.values(GrnStatus).map((s) => (
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
              <TableHead>GRN #</TableHead>
              <TableHead>Purchase order</TableHead>
              <TableHead>Store</TableHead>
              <TableHead>Items</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Received</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {query.isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                </TableCell>
              </TableRow>
            ) : grns.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  No goods receipt notes yet.
                </TableCell>
              </TableRow>
            ) : (
              grns.map((grn) => (
                <TableRow key={grn.id}>
                  <TableCell className="font-mono text-xs">
                    <Link href={`/dashboard/inventory/grn/${grn.id}`} className="text-primary hover:underline">
                      {grn.grnNumber}
                    </Link>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{grn.purchaseOrder.poNumber}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{grn.store.name}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{grn.items.length} item(s)</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_BADGE[grn.status]}>{formatEnumLabel(grn.status)}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{new Date(grn.receivedAt).toLocaleDateString('en-IN')}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {pagination && pagination.totalPages > 1 && (
        <Pagination page={pagination.page} totalPages={pagination.totalPages} onPageChange={setPage} />
      )}

      <CreateGrnDialog open={createOpen} onOpenChange={setCreateOpen} fromPoId={fromPo} />
    </div>
  )
}

function CreateGrnDialog({ open, onOpenChange, fromPoId }: { open: boolean; onOpenChange: (open: boolean) => void; fromPoId?: string | null }) {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [purchaseOrderId, setPurchaseOrderId] = useState(fromPoId ?? '')
  const [notes, setNotes] = useState('')
  const [receipts, setReceipts] = useState<Record<string, { quantityReceived: string; batchNumber: string; expiryDate: string; unitPrice: string }>>({})

  useEffect(() => {
    if (fromPoId) setPurchaseOrderId(fromPoId)
  }, [fromPoId])

  const eligiblePosQuery = useQuery({
    queryKey: ['inventory', 'purchase-orders', 'eligible-for-grn'],
    queryFn: () => listPurchaseOrders({ status: PurchaseOrderStatus.SENT, limit: 100 }),
    enabled: !fromPoId,
  })
  const poQuery = useQuery({
    queryKey: ['inventory', 'purchase-orders', 'detail', purchaseOrderId],
    queryFn: () => getPurchaseOrder(purchaseOrderId),
    enabled: Boolean(purchaseOrderId),
  })

  const remainingItems = (poQuery.data?.items ?? []).filter((item) => item.quantityReceived < item.quantityOrdered)

  const mutation = useMutation({
    mutationFn: () =>
      createGoodsReceiptNote({
        purchaseOrderId,
        notes: notes || undefined,
        items: remainingItems
          .filter((item) => Number(receipts[item.id]?.quantityReceived) > 0)
          .map((item) => ({
            purchaseOrderItemId: item.id,
            quantityReceived: Number(receipts[item.id].quantityReceived),
            batchNumber: receipts[item.id].batchNumber || undefined,
            expiryDate: receipts[item.id].expiryDate ? new Date(receipts[item.id].expiryDate) : undefined,
            unitPrice: Number(receipts[item.id].unitPrice || item.unitPrice),
          })),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['inventory', 'grn'] })
      void queryClient.invalidateQueries({ queryKey: ['inventory', 'purchase-orders'] })
      void queryClient.invalidateQueries({ queryKey: ['inventory', 'dashboard-stats'] })
      toast({ title: 'Goods receipt note created' })
      setReceipts({})
      setNotes('')
      onOpenChange(false)
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Could not create GRN', description: getErrorMessage(error) }),
  })

  const hasAnyLine = remainingItems.some((item) => Number(receipts[item.id]?.quantityReceived) > 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>New goods receipt note</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          {!fromPoId && (
            <Select value={purchaseOrderId} onValueChange={setPurchaseOrderId}>
              <SelectTrigger>
                <SelectValue placeholder="Purchase order (Sent)" />
              </SelectTrigger>
              <SelectContent>
                {(eligiblePosQuery.data?.data ?? []).map((po) => (
                  <SelectItem key={po.id} value={po.id}>
                    {po.poNumber} — {po.vendor.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {purchaseOrderId && remainingItems.length > 0 && (
            <div className="space-y-2 rounded-lg border p-2">
              {remainingItems.map((item) => (
                <div key={item.id} className="grid grid-cols-[1fr_4rem_5rem_5rem] items-center gap-1.5 text-xs">
                  <span className="truncate">
                    {item.item.name} (remaining {item.quantityOrdered - item.quantityReceived})
                  </span>
                  <Input
                    type="number"
                    placeholder="Qty"
                    value={receipts[item.id]?.quantityReceived ?? ''}
                    onChange={(e) =>
                      setReceipts((prev) => ({
                        ...prev,
                        [item.id]: { ...prev[item.id], quantityReceived: e.target.value, batchNumber: prev[item.id]?.batchNumber ?? '', expiryDate: prev[item.id]?.expiryDate ?? '', unitPrice: prev[item.id]?.unitPrice ?? '' },
                      }))
                    }
                  />
                  <Input
                    placeholder="Batch"
                    value={receipts[item.id]?.batchNumber ?? ''}
                    onChange={(e) =>
                      setReceipts((prev) => ({
                        ...prev,
                        [item.id]: { ...prev[item.id], batchNumber: e.target.value, quantityReceived: prev[item.id]?.quantityReceived ?? '', expiryDate: prev[item.id]?.expiryDate ?? '', unitPrice: prev[item.id]?.unitPrice ?? '' },
                      }))
                    }
                  />
                  <Input
                    type="date"
                    value={receipts[item.id]?.expiryDate ?? ''}
                    onChange={(e) =>
                      setReceipts((prev) => ({
                        ...prev,
                        [item.id]: { ...prev[item.id], expiryDate: e.target.value, quantityReceived: prev[item.id]?.quantityReceived ?? '', batchNumber: prev[item.id]?.batchNumber ?? '', unitPrice: prev[item.id]?.unitPrice ?? '' },
                      }))
                    }
                  />
                </div>
              ))}
            </div>
          )}
          {purchaseOrderId && remainingItems.length === 0 && (
            <p className="text-xs text-muted-foreground">This order has no remaining quantity to receive.</p>
          )}

          <Textarea placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={!purchaseOrderId || !hasAnyLine || mutation.isPending}>
            {mutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
