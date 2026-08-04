'use client'

import { StockTransferStatus, type InventoryStockWithRefs } from '@medicore/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Plus } from 'lucide-react'
import { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Pagination } from '@/components/ui/pagination'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import {
  adjustStock,
  cancelStockTransfer,
  createStockTransfer,
  dispatchStockTransfer,
  listInventoryItems,
  listInventoryStock,
  listInventoryStores,
  listStockTransfers,
  receiveStockTransfer,
  setOpeningStock,
  updateStockLevels,
} from '@/lib/api/inventory'
import { useAuth } from '@/lib/auth/auth-context'

function getErrorMessage(error: unknown): string {
  const axiosError = error as { response?: { data?: { error?: { message?: string } } } }
  return axiosError?.response?.data?.error?.message ?? 'Something went wrong. Please try again.'
}

function formatEnumLabel(value: string): string {
  return value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, ' ')
}

const NO_STORE = '__all__'

const TRANSFER_STATUS_BADGE: Record<StockTransferStatus, 'secondary' | 'outline' | 'success' | 'destructive'> = {
  [StockTransferStatus.DRAFT]: 'secondary',
  [StockTransferStatus.IN_TRANSIT]: 'outline',
  [StockTransferStatus.COMPLETED]: 'success',
  [StockTransferStatus.CANCELLED]: 'destructive',
}

export default function InventoryStockPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Stock</h1>
        <p className="text-sm text-muted-foreground">Per-store stock levels, batches, adjustments, and store-to-store transfers.</p>
      </div>

      <Tabs defaultValue="levels">
        <TabsList>
          <TabsTrigger value="levels">Stock levels</TabsTrigger>
          <TabsTrigger value="transfers">Transfers</TabsTrigger>
        </TabsList>
        <TabsContent value="levels">
          <StockLevelsTab />
        </TabsContent>
        <TabsContent value="transfers">
          <TransfersTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function StockLevelsTab() {
  const { hasPermission } = useAuth()
  const canCreate = hasPermission('inventory.stock.create')
  const canUpdate = hasPermission('inventory.stock.update')

  const [storeId, setStoreId] = useState(NO_STORE)
  const [lowStockOnly, setLowStockOnly] = useState(false)
  const [expiringOnly, setExpiringOnly] = useState(false)
  const [page, setPage] = useState(1)
  const [openingDialogOpen, setOpeningDialogOpen] = useState(false)
  const [adjusting, setAdjusting] = useState<InventoryStockWithRefs | null>(null)
  const [editingLevels, setEditingLevels] = useState<InventoryStockWithRefs | null>(null)

  const storesQuery = useQuery({ queryKey: ['inventory', 'stores', true], queryFn: () => listInventoryStores(true) })

  const stockQuery = useQuery({
    queryKey: ['inventory', 'stock', 'list', { storeId, lowStockOnly, expiringOnly, page }],
    queryFn: () =>
      listInventoryStock({
        storeId: storeId === NO_STORE ? undefined : storeId,
        lowStockOnly: lowStockOnly || undefined,
        expiringWithinDays: expiringOnly ? 30 : undefined,
        page,
        limit: 20,
      }),
  })

  const stock = stockQuery.data?.data ?? []
  const pagination = stockQuery.data?.pagination

  return (
    <div className="space-y-3 pt-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={storeId}
            onValueChange={(v) => {
              setStoreId(v)
              setPage(1)
            }}
          >
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_STORE}>All stores</SelectItem>
              {(storesQuery.data ?? []).map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={lowStockOnly}
              onChange={(e) => {
                setLowStockOnly(e.target.checked)
                setPage(1)
              }}
            />
            Low stock only
          </label>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={expiringOnly}
              onChange={(e) => {
                setExpiringOnly(e.target.checked)
                setPage(1)
              }}
            />
            Expiring within 30 days
          </label>
        </div>
        {canCreate && (
          <Button size="sm" onClick={() => setOpeningDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            Set opening stock
          </Button>
        )}
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead>Store</TableHead>
              <TableHead>Current</TableHead>
              <TableHead>Reserved</TableHead>
              <TableHead>Available</TableHead>
              <TableHead>Reorder level</TableHead>
              <TableHead>Nearest expiry</TableHead>
              {canUpdate && <TableHead>Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {stockQuery.isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                </TableCell>
              </TableRow>
            ) : stock.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                  No stock records found.
                </TableCell>
              </TableRow>
            ) : (
              stock.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <div className="font-medium">{s.item.name}</div>
                    <div className="font-mono text-xs text-muted-foreground">{s.item.code}</div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{s.store.name}</TableCell>
                  <TableCell>{s.currentStock}</TableCell>
                  <TableCell>{s.reservedStock}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      {s.availableStock}
                      {s.currentStock <= s.reorderLevel && <Badge variant="destructive">Low</Badge>}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{s.reorderLevel}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {s.batches[0]?.expiryDate ? new Date(s.batches[0].expiryDate).toLocaleDateString('en-IN') : '—'}
                  </TableCell>
                  {canUpdate && (
                    <TableCell className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => setAdjusting(s)}>
                        Adjust
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setEditingLevels(s)}>
                        Levels
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {pagination && pagination.totalPages > 1 && (
        <Pagination page={pagination.page} totalPages={pagination.totalPages} onPageChange={setPage} />
      )}

      <OpeningStockDialog open={openingDialogOpen} onOpenChange={setOpeningDialogOpen} />
      {adjusting && <AdjustStockDialog stock={adjusting} onOpenChange={(open) => !open && setAdjusting(null)} />}
      {editingLevels && <LevelsDialog stock={editingLevels} onOpenChange={(open) => !open && setEditingLevels(null)} />}
    </div>
  )
}

function OpeningStockDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [itemId, setItemId] = useState('')
  const [storeId, setStoreId] = useState('')
  const [quantity, setQuantity] = useState('0')
  const [reorderLevel, setReorderLevel] = useState('0')
  const [minStock, setMinStock] = useState('0')
  const [maxStock, setMaxStock] = useState('0')
  const [batchNumber, setBatchNumber] = useState('')
  const [expiryDate, setExpiryDate] = useState('')

  const itemsQuery = useQuery({
    queryKey: ['inventory', 'items', 'active-for-stock'],
    queryFn: () => listInventoryItems({ isActive: true, limit: 200, sortBy: 'name', sortOrder: 'asc' }),
  })
  const storesQuery = useQuery({ queryKey: ['inventory', 'stores', true], queryFn: () => listInventoryStores(true) })

  const mutation = useMutation({
    mutationFn: () =>
      setOpeningStock({
        itemId,
        storeId,
        quantity: Number(quantity),
        reorderLevel: Number(reorderLevel),
        minStock: Number(minStock),
        maxStock: Number(maxStock),
        batchNumber: batchNumber || undefined,
        expiryDate: expiryDate ? new Date(expiryDate) : undefined,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['inventory', 'stock'] })
      void queryClient.invalidateQueries({ queryKey: ['inventory', 'dashboard-stats'] })
      toast({ title: 'Opening stock set' })
      onOpenChange(false)
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Could not set opening stock', description: getErrorMessage(error) }),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Set opening stock</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Select value={itemId} onValueChange={setItemId}>
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
          <Select value={storeId} onValueChange={setStoreId}>
            <SelectTrigger>
              <SelectValue placeholder="Store" />
            </SelectTrigger>
            <SelectContent>
              {(storesQuery.data ?? []).map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="Quantity" type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            <Input placeholder="Reorder level" type="number" value={reorderLevel} onChange={(e) => setReorderLevel(e.target.value)} />
            <Input placeholder="Min stock" type="number" value={minStock} onChange={(e) => setMinStock(e.target.value)} />
            <Input placeholder="Max stock" type="number" value={maxStock} onChange={(e) => setMaxStock(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="Batch number (optional)" value={batchNumber} onChange={(e) => setBatchNumber(e.target.value)} />
            <Input placeholder="Expiry date (optional)" type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={!itemId || !storeId || mutation.isPending}>
            {mutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function AdjustStockDialog({ stock, onOpenChange }: { stock: InventoryStockWithRefs; onOpenChange: (open: boolean) => void }) {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [type, setType] = useState<'DAMAGE' | 'LOSS' | 'EXPIRY' | 'CORRECTION'>('CORRECTION')
  const [quantityDelta, setQuantityDelta] = useState('')
  const [reason, setReason] = useState('')

  const mutation = useMutation({
    mutationFn: () =>
      adjustStock({
        itemId: stock.itemId,
        storeId: stock.storeId,
        type,
        quantityDelta: Number(quantityDelta),
        reason: reason || undefined,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['inventory', 'stock'] })
      void queryClient.invalidateQueries({ queryKey: ['inventory', 'dashboard-stats'] })
      toast({ title: 'Stock adjusted' })
      onOpenChange(false)
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Could not adjust stock', description: getErrorMessage(error) }),
  })

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adjust stock — {stock.item.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="CORRECTION">Correction (+/-)</SelectItem>
              <SelectItem value="DAMAGE">Damage</SelectItem>
              <SelectItem value="LOSS">Loss</SelectItem>
              <SelectItem value="EXPIRY">Expiry</SelectItem>
            </SelectContent>
          </Select>
          <Input
            placeholder={type === 'CORRECTION' ? 'Quantity delta (+/-)' : 'Quantity'}
            type="number"
            value={quantityDelta}
            onChange={(e) => setQuantityDelta(e.target.value)}
          />
          <Textarea placeholder="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={!quantityDelta || Number(quantityDelta) === 0 || mutation.isPending}
          >
            {mutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function LevelsDialog({ stock, onOpenChange }: { stock: InventoryStockWithRefs; onOpenChange: (open: boolean) => void }) {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [reorderLevel, setReorderLevel] = useState(String(stock.reorderLevel))
  const [minStock, setMinStock] = useState(String(stock.minStock))
  const [maxStock, setMaxStock] = useState(String(stock.maxStock))

  const mutation = useMutation({
    mutationFn: () =>
      updateStockLevels(stock.id, {
        reorderLevel: Number(reorderLevel),
        minStock: Number(minStock),
        maxStock: Number(maxStock),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['inventory', 'stock'] })
      toast({ title: 'Levels updated' })
      onOpenChange(false)
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Could not update levels', description: getErrorMessage(error) }),
  })

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Stock levels — {stock.item.name}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-3 gap-2">
          <Input placeholder="Reorder level" type="number" value={reorderLevel} onChange={(e) => setReorderLevel(e.target.value)} />
          <Input placeholder="Min stock" type="number" value={minStock} onChange={(e) => setMinStock(e.target.value)} />
          <Input placeholder="Max stock" type="number" value={maxStock} onChange={(e) => setMaxStock(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function TransfersTab() {
  const { hasPermission } = useAuth()
  const canCreate = hasPermission('inventory.stock.create')
  const canUpdate = hasPermission('inventory.stock.update')
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [status, setStatus] = useState<StockTransferStatus | 'ALL'>('ALL')
  const [page, setPage] = useState(1)
  const [createOpen, setCreateOpen] = useState(false)

  const transfersQuery = useQuery({
    queryKey: ['inventory', 'transfers', 'list', { status, page }],
    queryFn: () => listStockTransfers({ status: status === 'ALL' ? undefined : status, page, limit: 20 }),
  })

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ['inventory', 'transfers'] })
    void queryClient.invalidateQueries({ queryKey: ['inventory', 'stock'] })
  }

  const dispatchMutation = useMutation({
    mutationFn: (id: string) => dispatchStockTransfer(id),
    onSuccess: () => {
      toast({ title: 'Transfer dispatched' })
      invalidate()
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Could not dispatch', description: getErrorMessage(error) }),
  })
  const receiveMutation = useMutation({
    mutationFn: (id: string) => receiveStockTransfer(id),
    onSuccess: () => {
      toast({ title: 'Transfer received' })
      invalidate()
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Could not receive', description: getErrorMessage(error) }),
  })
  const cancelMutation = useMutation({
    mutationFn: (id: string) => cancelStockTransfer(id),
    onSuccess: () => {
      toast({ title: 'Transfer cancelled' })
      invalidate()
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Could not cancel', description: getErrorMessage(error) }),
  })

  const transfers = transfersQuery.data?.data ?? []
  const pagination = transfersQuery.data?.pagination

  return (
    <div className="space-y-3 pt-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v as StockTransferStatus | 'ALL')
            setPage(1)
          }}
        >
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            {Object.values(StockTransferStatus).map((s) => (
              <SelectItem key={s} value={s}>
                {formatEnumLabel(s)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {canCreate && (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            New transfer
          </Button>
        )}
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Transfer #</TableHead>
              <TableHead>Route</TableHead>
              <TableHead>Items</TableHead>
              <TableHead>Status</TableHead>
              {canUpdate && <TableHead>Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {transfersQuery.isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                </TableCell>
              </TableRow>
            ) : transfers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  No transfers yet.
                </TableCell>
              </TableRow>
            ) : (
              transfers.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-mono text-xs">{t.transferNumber}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">Store-to-store</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{t.items.length} item(s)</TableCell>
                  <TableCell>
                    <Badge variant={TRANSFER_STATUS_BADGE[t.status]}>{formatEnumLabel(t.status)}</Badge>
                  </TableCell>
                  {canUpdate && (
                    <TableCell className="flex flex-wrap gap-1">
                      {t.status === StockTransferStatus.DRAFT && (
                        <>
                          <Button variant="ghost" size="sm" onClick={() => dispatchMutation.mutate(t.id)}>
                            Dispatch
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => cancelMutation.mutate(t.id)}>
                            Cancel
                          </Button>
                        </>
                      )}
                      {t.status === StockTransferStatus.IN_TRANSIT && (
                        <>
                          <Button variant="ghost" size="sm" onClick={() => receiveMutation.mutate(t.id)}>
                            Receive
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => cancelMutation.mutate(t.id)}>
                            Cancel
                          </Button>
                        </>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {pagination && pagination.totalPages > 1 && (
        <Pagination page={pagination.page} totalPages={pagination.totalPages} onPageChange={setPage} />
      )}

      <CreateTransferDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  )
}

function CreateTransferDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [fromStoreId, setFromStoreId] = useState('')
  const [toStoreId, setToStoreId] = useState('')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<Array<{ itemId: string; quantity: string }>>([{ itemId: '', quantity: '' }])

  const storesQuery = useQuery({ queryKey: ['inventory', 'stores', true], queryFn: () => listInventoryStores(true) })
  const itemsQuery = useQuery({
    queryKey: ['inventory', 'items', 'active-for-transfer'],
    queryFn: () => listInventoryItems({ isActive: true, limit: 200, sortBy: 'name', sortOrder: 'asc' }),
  })

  const validLines = lines.filter((l) => l.itemId && Number(l.quantity) > 0)

  const mutation = useMutation({
    mutationFn: () =>
      createStockTransfer({
        fromStoreId,
        toStoreId,
        notes: notes || undefined,
        items: validLines.map((l) => ({ itemId: l.itemId, quantity: Number(l.quantity) })),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['inventory', 'transfers'] })
      toast({ title: 'Transfer created' })
      setLines([{ itemId: '', quantity: '' }])
      setNotes('')
      onOpenChange(false)
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Could not create transfer', description: getErrorMessage(error) }),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New stock transfer</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <Select value={fromStoreId} onValueChange={setFromStoreId}>
              <SelectTrigger>
                <SelectValue placeholder="From store" />
              </SelectTrigger>
              <SelectContent>
                {(storesQuery.data ?? []).map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={toStoreId} onValueChange={setToStoreId}>
              <SelectTrigger>
                <SelectValue placeholder="To store" />
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
              <div key={idx} className="flex gap-2">
                <Select
                  value={line.itemId}
                  onValueChange={(v) => setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, itemId: v } : l)))}
                >
                  <SelectTrigger className="flex-1">
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
                <Input
                  className="w-24"
                  type="number"
                  placeholder="Qty"
                  value={line.quantity}
                  onChange={(e) => setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, quantity: e.target.value } : l)))}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setLines((prev) => prev.filter((_, i) => i !== idx))}
                  disabled={lines.length === 1}
                >
                  ✕
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => setLines((prev) => [...prev, { itemId: '', quantity: '' }])}>
              <Plus className="h-3.5 w-3.5" />
              Add item
            </Button>
          </div>

          <Textarea placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={!fromStoreId || !toStoreId || fromStoreId === toStoreId || validLines.length === 0 || mutation.isPending}
          >
            {mutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
