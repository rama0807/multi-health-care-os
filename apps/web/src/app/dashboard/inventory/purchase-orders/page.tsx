'use client'

import { PurchaseOrderStatus } from '@medicore/types'
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
import { listInventoryItems, listInventoryStores, listVendors } from '@/lib/api/inventory'
import { createPurchaseOrder, getPurchaseRequest, listPurchaseOrders } from '@/lib/api/procurement'
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

export default function PurchaseOrdersPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-muted-foreground">Loading...</div>}>
      <PurchaseOrdersPageInner />
    </Suspense>
  )
}

function PurchaseOrdersPageInner() {
  const { hasPermission } = useAuth()
  const canCreate = hasPermission('inventory.procurement.create')
  const searchParams = useSearchParams()
  const fromPr = searchParams.get('fromPr')

  const [status, setStatus] = useState<PurchaseOrderStatus | 'ALL'>('ALL')
  const [page, setPage] = useState(1)
  const [createOpen, setCreateOpen] = useState(false)

  useEffect(() => {
    if (fromPr) setCreateOpen(true)
  }, [fromPr])

  const query = useQuery({
    queryKey: ['inventory', 'purchase-orders', 'list', { status, page }],
    queryFn: () => listPurchaseOrders({ status: status === 'ALL' ? undefined : status, page, limit: 20 }),
  })

  const orders = query.data?.data ?? []
  const pagination = query.data?.pagination

  return (
    <div className="space-y-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Purchase Orders</h1>
          <p className="text-sm text-muted-foreground">Orders placed with a vendor — optionally converted from an approved request.</p>
        </div>
        {canCreate && (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            New order
          </Button>
        )}
      </div>

      <Select
        value={status}
        onValueChange={(v) => {
          setStatus(v as PurchaseOrderStatus | 'ALL')
          setPage(1)
        }}
      >
        <SelectTrigger className="w-48">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">All statuses</SelectItem>
          {Object.values(PurchaseOrderStatus).map((s) => (
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
              <TableHead>PO #</TableHead>
              <TableHead>Vendor</TableHead>
              <TableHead>Store</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {query.isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                </TableCell>
              </TableRow>
            ) : orders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  No purchase orders yet.
                </TableCell>
              </TableRow>
            ) : (
              orders.map((po) => (
                <TableRow key={po.id}>
                  <TableCell className="font-mono text-xs">
                    <Link href={`/dashboard/inventory/purchase-orders/${po.id}`} className="text-primary hover:underline">
                      {po.poNumber}
                    </Link>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{po.vendor.name}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{po.store.name}</TableCell>
                  <TableCell className="text-xs">₹{Number(po.totalAmount).toLocaleString('en-IN')}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_BADGE[po.status]}>{formatEnumLabel(po.status)}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{new Date(po.createdAt).toLocaleDateString('en-IN')}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {pagination && pagination.totalPages > 1 && (
        <Pagination page={pagination.page} totalPages={pagination.totalPages} onPageChange={setPage} />
      )}

      <CreateOrderDialog open={createOpen} onOpenChange={setCreateOpen} fromPrId={fromPr} />
    </div>
  )
}

function CreateOrderDialog({
  open,
  onOpenChange,
  fromPrId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  fromPrId?: string | null
}) {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [vendorId, setVendorId] = useState('')
  const [storeId, setStoreId] = useState('')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<Array<{ itemId: string; itemLabel: string; quantityOrdered: string; unitPrice: string; taxPercent: string }>>([
    { itemId: '', itemLabel: '', quantityOrdered: '', unitPrice: '', taxPercent: '0' },
  ])

  const vendorsQuery = useQuery({ queryKey: ['inventory', 'vendors', 'active-for-po'], queryFn: () => listVendors({ isActive: true, limit: 100 }) })
  const storesQuery = useQuery({ queryKey: ['inventory', 'stores', true], queryFn: () => listInventoryStores(true) })
  const prQuery = useQuery({
    queryKey: ['inventory', 'purchase-requests', 'detail', fromPrId],
    queryFn: () => getPurchaseRequest(fromPrId!),
    enabled: Boolean(fromPrId),
  })

  useEffect(() => {
    if (prQuery.data) {
      setStoreId(prQuery.data.storeId)
      setLines(
        prQuery.data.items.map((item) => ({
          itemId: item.itemId,
          itemLabel: `${item.item.name} (${item.item.code})`,
          quantityOrdered: String(item.quantity),
          unitPrice: '',
          taxPercent: '0',
        })),
      )
    }
  }, [prQuery.data])

  const validLines = lines.filter((l) => l.itemId && Number(l.quantityOrdered) > 0 && l.unitPrice !== '')

  const mutation = useMutation({
    mutationFn: () =>
      createPurchaseOrder({
        vendorId,
        storeId,
        purchaseRequestId: fromPrId ?? undefined,
        notes: notes || undefined,
        items: validLines.map((l) => ({
          itemId: l.itemId,
          quantityOrdered: Number(l.quantityOrdered),
          unitPrice: Number(l.unitPrice),
          taxPercent: Number(l.taxPercent || 0),
        })),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['inventory', 'purchase-orders'] })
      void queryClient.invalidateQueries({ queryKey: ['inventory', 'purchase-requests'] })
      void queryClient.invalidateQueries({ queryKey: ['inventory', 'dashboard-stats'] })
      toast({ title: 'Purchase order created' })
      onOpenChange(false)
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Could not create order', description: getErrorMessage(error) }),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>New purchase order{fromPrId ? ' (from request)' : ''}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <Select value={vendorId} onValueChange={setVendorId}>
              <SelectTrigger>
                <SelectValue placeholder="Vendor" />
              </SelectTrigger>
              <SelectContent>
                {(vendorsQuery.data?.data ?? []).map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={storeId} onValueChange={setStoreId} disabled={Boolean(fromPrId)}>
              <SelectTrigger>
                <SelectValue placeholder="Delivery store" />
              </SelectTrigger>
              <SelectContent>
                {(storesQuery.data ?? []).map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            {lines.map((line, idx) => (
              <div key={idx} className="grid grid-cols-[1fr_4.5rem_5rem_4rem_auto] items-center gap-1.5">
                {fromPrId ? (
                  <span className="truncate text-xs">{line.itemLabel}</span>
                ) : (
                  <ItemPicker value={line.itemId} onChange={(itemId, label) => setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, itemId, itemLabel: label } : l)))} />
                )}
                <Input
                  type="number"
                  placeholder="Qty"
                  value={line.quantityOrdered}
                  disabled={Boolean(fromPrId)}
                  onChange={(e) => setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, quantityOrdered: e.target.value } : l)))}
                />
                <Input
                  type="number"
                  placeholder="Unit price"
                  value={line.unitPrice}
                  onChange={(e) => setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, unitPrice: e.target.value } : l)))}
                />
                <Input
                  type="number"
                  placeholder="Tax %"
                  value={line.taxPercent}
                  onChange={(e) => setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, taxPercent: e.target.value } : l)))}
                />
                {!fromPrId && (
                  <Button variant="ghost" size="sm" onClick={() => setLines((prev) => prev.filter((_, i) => i !== idx))} disabled={lines.length === 1}>
                    ✕
                  </Button>
                )}
              </div>
            ))}
            {!fromPrId && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLines((prev) => [...prev, { itemId: '', itemLabel: '', quantityOrdered: '', unitPrice: '', taxPercent: '0' }])}
              >
                <Plus className="h-3.5 w-3.5" />
                Add item
              </Button>
            )}
          </div>

          <Textarea placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={!vendorId || !storeId || validLines.length === 0 || mutation.isPending}>
            {mutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ItemPicker({ value, onChange }: { value: string; onChange: (itemId: string, label: string) => void }) {
  const itemsQuery = useQuery({
    queryKey: ['inventory', 'items', 'active-for-po-line'],
    queryFn: () => listInventoryItems({ isActive: true, limit: 200, sortBy: 'name', sortOrder: 'asc' }),
  })

  return (
    <Select
      value={value}
      onValueChange={(v) => {
        const item = itemsQuery.data?.data.find((i) => i.id === v)
        onChange(v, item ? `${item.name} (${item.code})` : '')
      }}
    >
      <SelectTrigger>
        <SelectValue placeholder="Item" />
      </SelectTrigger>
      <SelectContent>
        {(itemsQuery.data?.data ?? []).map((i) => (
          <SelectItem key={i.id} value={i.id}>
            {i.name} ({i.code})
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
