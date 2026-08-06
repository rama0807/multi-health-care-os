'use client'

import { PurchaseRequestStatus } from '@medicore/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Plus } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { PageLayout } from '@/components/layout/page-layout'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Pagination } from '@/components/ui/pagination'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { TableSkeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/ui/status-badge'
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { listInventoryItems, listInventoryStores } from '@/lib/api/inventory'
import { createPurchaseRequest, listPurchaseRequests } from '@/lib/api/procurement'
import { useAuth } from '@/lib/auth/auth-context'

function getErrorMessage(error: unknown): string {
  const axiosError = error as { response?: { data?: { error?: { message?: string } } } }
  return axiosError?.response?.data?.error?.message ?? 'Something went wrong. Please try again.'
}

function formatEnumLabel(value: string): string {
  return value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, ' ')
}

export default function PurchaseRequestsPage() {
  const router = useRouter()
  const { hasPermission } = useAuth()
  const canCreate = hasPermission('inventory.procurement.create')

  const [status, setStatus] = useState<PurchaseRequestStatus | 'ALL'>('ALL')
  const [page, setPage] = useState(1)
  const [createOpen, setCreateOpen] = useState(false)

  const query = useQuery({
    queryKey: ['inventory', 'purchase-requests', 'list', { status, page }],
    queryFn: () => listPurchaseRequests({ status: status === 'ALL' ? undefined : status, page, limit: 20 }),
  })

  const requests = query.data?.data ?? []
  const pagination = query.data?.pagination

  return (
    <PageLayout
      title="Purchase Requests"
      description="The first step of the procurement chain - request, approve, convert to a PO."
      actions={
        canCreate && (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            New request
          </Button>
        )
      }
    >
      <Select
        value={status}
        onValueChange={(v) => {
          setStatus(v as PurchaseRequestStatus | 'ALL')
          setPage(1)
        }}
      >
        <SelectTrigger className="w-48">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">All statuses</SelectItem>
          {Object.values(PurchaseRequestStatus).map((s) => (
            <SelectItem key={s} value={s}>
              {formatEnumLabel(s)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {query.isLoading ? (
        <TableSkeleton rows={8} columns={5} />
      ) : requests.length === 0 ? (
        <EmptyState
          variant={status === 'ALL' ? 'empty' : 'search'}
          title="No purchase requests yet"
          action={canCreate ? { label: 'New request', onClick: () => setCreateOpen(true) } : undefined}
        />
      ) : (
        <TableContainer className="max-h-[65vh]">
          <Table density="compact" container={false}>
            <TableHeader>
              <TableRow>
                <TableHead>Request #</TableHead>
                <TableHead>Store</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((r) => (
                <TableRow key={r.id} interactive onClick={() => router.push(`/dashboard/inventory/purchase-requests/${r.id}`)}>
                  <TableCell className="font-mono text-xs">
                    <Link
                      href={`/dashboard/inventory/purchase-requests/${r.id}`}
                      className="text-primary hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {r.requestNumber}
                    </Link>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.store.name}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.items.length} item(s)</TableCell>
                  <TableCell>
                    <StatusBadge status={r.status} />
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleDateString('en-IN')}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {pagination && pagination.totalPages > 1 && (
        <Pagination page={pagination.page} totalPages={pagination.totalPages} onPageChange={setPage} />
      )}

      <CreateRequestDialog open={createOpen} onOpenChange={setCreateOpen} />
    </PageLayout>
  )
}

function CreateRequestDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [storeId, setStoreId] = useState('')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<Array<{ itemId: string; quantity: string }>>([{ itemId: '', quantity: '' }])

  const storesQuery = useQuery({ queryKey: ['inventory', 'stores', true], queryFn: () => listInventoryStores(true) })
  const itemsQuery = useQuery({
    queryKey: ['inventory', 'items', 'active-for-pr'],
    queryFn: () => listInventoryItems({ isActive: true, limit: 200, sortBy: 'name', sortOrder: 'asc' }),
  })

  const validLines = lines.filter((l) => l.itemId && Number(l.quantity) > 0)

  const mutation = useMutation({
    mutationFn: () =>
      createPurchaseRequest({
        storeId,
        notes: notes || undefined,
        items: validLines.map((l) => ({ itemId: l.itemId, quantity: Number(l.quantity) })),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['inventory', 'purchase-requests'] })
      void queryClient.invalidateQueries({ queryKey: ['inventory', 'dashboard-stats'] })
      toast({ title: 'Purchase request created' })
      setLines([{ itemId: '', quantity: '' }])
      setNotes('')
      onOpenChange(false)
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Could not create request', description: getErrorMessage(error) }),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New purchase request</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Select value={storeId} onValueChange={setStoreId}>
            <SelectTrigger>
              <SelectValue placeholder="Requesting store" />
            </SelectTrigger>
            <SelectContent>
              {(storesQuery.data ?? []).map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

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
          <Button onClick={() => mutation.mutate()} disabled={!storeId || validLines.length === 0 || mutation.isPending}>
            {mutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
