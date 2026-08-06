'use client'

import { StockAuditStatus } from '@medicore/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Plus } from 'lucide-react'
import Link from 'next/link'
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
import { listInventoryStores } from '@/lib/api/inventory'
import { createStockAudit, listStockAudits } from '@/lib/api/procurement'
import { useAuth } from '@/lib/auth/auth-context'

function getErrorMessage(error: unknown): string {
  const axiosError = error as { response?: { data?: { error?: { message?: string } } } }
  return axiosError?.response?.data?.error?.message ?? 'Something went wrong. Please try again.'
}

function formatEnumLabel(value: string): string {
  return value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, ' ')
}

export default function StockAuditsPage() {
  const { hasPermission } = useAuth()
  const canCreate = hasPermission('inventory.audit.create')

  const [status, setStatus] = useState<StockAuditStatus | 'ALL'>('ALL')
  const [page, setPage] = useState(1)
  const [createOpen, setCreateOpen] = useState(false)

  const query = useQuery({
    queryKey: ['inventory', 'audits', 'list', { status, page }],
    queryFn: () => listStockAudits({ status: status === 'ALL' ? undefined : status, page, limit: 20 }),
  })

  const audits = query.data?.data ?? []
  const pagination = query.data?.pagination

  return (
    <PageLayout
      title="Stock Audits"
      description="Cycle counting / physical verification against system stock, per store."
      actions={
        canCreate && (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            New audit
          </Button>
        )
      }
    >
      <Select
        value={status}
        onValueChange={(v) => {
          setStatus(v as StockAuditStatus | 'ALL')
          setPage(1)
        }}
      >
        <SelectTrigger className="w-48">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">All statuses</SelectItem>
          {Object.values(StockAuditStatus).map((s) => (
            <SelectItem key={s} value={s}>
              {formatEnumLabel(s)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {query.isLoading ? (
        <TableSkeleton rows={6} columns={5} />
      ) : audits.length === 0 ? (
        <EmptyState
          variant={status === 'ALL' ? 'empty' : 'search'}
          title="No stock audits yet"
          action={canCreate ? { label: 'New audit', onClick: () => setCreateOpen(true) } : undefined}
        />
      ) : (
        <TableContainer className="max-h-[65vh]">
          <Table density="compact" container={false}>
            <TableHeader>
              <TableRow>
                <TableHead>Audit #</TableHead>
                <TableHead>Store</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Scheduled</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {audits.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-mono text-xs">
                    <Link href={`/dashboard/inventory/audits/${a.id}`} className="text-primary hover:underline">
                      {a.auditNumber}
                    </Link>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{a.store.name}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{a.items.length} item(s)</TableCell>
                  <TableCell>
                    <StatusBadge status={a.status} />
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {a.scheduledDate ? new Date(a.scheduledDate).toLocaleDateString('en-IN') : '-'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {pagination && pagination.totalPages > 1 && (
        <Pagination page={pagination.page} totalPages={pagination.totalPages} onPageChange={setPage} />
      )}

      <CreateAuditDialog open={createOpen} onOpenChange={setCreateOpen} />
    </PageLayout>
  )
}

function CreateAuditDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [storeId, setStoreId] = useState('')
  const [scheduledDate, setScheduledDate] = useState('')
  const [notes, setNotes] = useState('')

  const storesQuery = useQuery({ queryKey: ['inventory', 'stores', true], queryFn: () => listInventoryStores(true) })

  const mutation = useMutation({
    mutationFn: () =>
      createStockAudit({
        storeId,
        scheduledDate: scheduledDate ? new Date(scheduledDate) : undefined,
        notes: notes || undefined,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['inventory', 'audits'] })
      toast({ title: 'Stock audit created - snapshotted current system stock' })
      onOpenChange(false)
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Could not create audit', description: getErrorMessage(error) }),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New stock audit</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
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
          <Input type="date" placeholder="Scheduled date (optional)" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} />
          <Textarea placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
          <p className="text-xs text-muted-foreground">
            Snapshots every item currently stocked at this store as the system-quantity baseline for counting.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={!storeId || mutation.isPending}>
            {mutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
