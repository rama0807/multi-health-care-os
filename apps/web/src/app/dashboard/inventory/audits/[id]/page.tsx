'use client'

import { StockAuditStatus } from '@medicore/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useParams } from 'next/navigation'
import { useState } from 'react'

import { PageLayout } from '@/components/layout/page-layout'
import { Button } from '@/components/ui/button'
import { Card, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { StatusBadge } from '@/components/ui/status-badge'
import { Table, TableBody, TableCell, TableContainer, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'
import { cancelStockAudit, completeStockAudit, getStockAudit, recordStockAuditCounts, startStockAudit } from '@/lib/api/procurement'
import { useAuth } from '@/lib/auth/auth-context'

function getErrorMessage(error: unknown): string {
  const axiosError = error as { response?: { data?: { error?: { message?: string } } } }
  return axiosError?.response?.data?.error?.message ?? 'Something went wrong. Please try again.'
}

export default function StockAuditDetailPage() {
  const params = useParams<{ id: string }>()
  const { hasPermission } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const canUpdate = hasPermission('inventory.audit.update')
  const canManage = hasPermission('inventory.audit.manage')

  const [counts, setCounts] = useState<Record<string, string>>({})

  const auditQuery = useQuery({ queryKey: ['inventory', 'audits', 'detail', params.id], queryFn: () => getStockAudit(params.id) })

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ['inventory', 'audits'] })
    void queryClient.invalidateQueries({ queryKey: ['inventory', 'stock'] })
  }

  const startMutation = useMutation({
    mutationFn: () => startStockAudit(params.id),
    onSuccess: () => {
      toast({ title: 'Audit started' })
      invalidate()
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Could not start', description: getErrorMessage(error) }),
  })
  const recordMutation = useMutation({
    mutationFn: (items: Array<{ stockAuditItemId: string; countedQuantity: number }>) => recordStockAuditCounts(params.id, { items }),
    onSuccess: () => {
      toast({ title: 'Counts saved' })
      invalidate()
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Could not save counts', description: getErrorMessage(error) }),
  })
  const completeMutation = useMutation({
    mutationFn: () => completeStockAudit(params.id),
    onSuccess: () => {
      toast({ title: 'Audit completed - variances applied to stock' })
      invalidate()
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Could not complete', description: getErrorMessage(error) }),
  })
  const cancelMutation = useMutation({
    mutationFn: () => cancelStockAudit(params.id),
    onSuccess: () => {
      toast({ title: 'Audit cancelled' })
      invalidate()
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Could not cancel', description: getErrorMessage(error) }),
  })

  if (auditQuery.isLoading) {
    return (
      <PageLayout
        breadcrumbs={[{ label: 'Inventory', href: '/dashboard/inventory' }, { label: 'Stock Audits', href: '/dashboard/inventory/audits' }, { label: '…' }]}
        title="…"
        loading
      >
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </PageLayout>
    )
  }

  if (auditQuery.isError || !auditQuery.data) {
    return (
      <PageLayout
        breadcrumbs={[{ label: 'Inventory', href: '/dashboard/inventory' }, { label: 'Stock Audits', href: '/dashboard/inventory/audits' }, { label: 'Not found' }]}
        title="Stock audit not found"
      >
        <EmptyState
          variant="error"
          title="Stock audit not found"
          description={getErrorMessage(auditQuery.error)}
          action={{ label: 'Back to list', href: '/dashboard/inventory/audits' }}
        />
      </PageLayout>
    )
  }

  const audit = auditQuery.data
  const canRecord = audit.status === StockAuditStatus.IN_PROGRESS
  const allCounted = audit.items.every((item) => item.countedQuantity !== null || counts[item.id] !== undefined)
  const canCancel = audit.status === StockAuditStatus.DRAFT || audit.status === StockAuditStatus.IN_PROGRESS

  return (
    <PageLayout
      breadcrumbs={[
        { label: 'Inventory', href: '/dashboard/inventory' },
        { label: 'Stock Audits', href: '/dashboard/inventory/audits' },
        { label: audit.auditNumber },
      ]}
      title={audit.auditNumber}
      badge={<StatusBadge status={audit.status} />}
      meta={<span>Store: {audit.store.name}</span>}
      actions={
        <>
          {canUpdate && audit.status === StockAuditStatus.DRAFT && (
            <Button size="sm" onClick={() => startMutation.mutate()} disabled={startMutation.isPending}>
              Start count
            </Button>
          )}
          {canManage && audit.status === StockAuditStatus.IN_PROGRESS && (
            <Button size="sm" onClick={() => completeMutation.mutate()} disabled={!allCounted || completeMutation.isPending}>
              {completeMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Complete - apply variances
            </Button>
          )}
          {canUpdate && canCancel && (
            <Button size="sm" variant="outline" onClick={() => cancelMutation.mutate()} disabled={cancelMutation.isPending}>
              Cancel
            </Button>
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
                <TableHead align="right">System qty</TableHead>
                <TableHead align="right">Counted qty</TableHead>
                <TableHead align="right">Variance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {audit.items.map((item) => {
                const variance =
                  item.countedQuantity !== null
                    ? item.varianceQuantity
                    : counts[item.id] !== undefined
                      ? Number(counts[item.id]) - item.systemQuantity
                      : null
                return (
                  <TableRow key={item.id}>
                    <TableCell>
                      {item.item.name} <span className="font-mono text-xs text-muted-foreground">({item.item.code})</span>
                    </TableCell>
                    <TableCell align="right">{item.systemQuantity}</TableCell>
                    <TableCell align="right">
                      {canRecord && item.countedQuantity === null ? (
                        <Input
                          className="h-8 w-24"
                          type="number"
                          value={counts[item.id] ?? ''}
                          onChange={(e) => setCounts((prev) => ({ ...prev, [item.id]: e.target.value }))}
                        />
                      ) : (
                        (item.countedQuantity ?? '-')
                      )}
                    </TableCell>
                    <TableCell align="right" className={variance !== null && variance !== 0 ? 'font-medium text-danger' : 'text-muted-foreground'}>
                      {variance ?? '-'}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </TableContainer>
        {canRecord && Object.keys(counts).length > 0 && (
          <CardFooter className="justify-end">
            <Button
              size="sm"
              onClick={() =>
                recordMutation.mutate(
                  Object.entries(counts).map(([stockAuditItemId, qty]) => ({
                    stockAuditItemId,
                    countedQuantity: Number(qty),
                  })),
                )
              }
              disabled={recordMutation.isPending}
            >
              {recordMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Save counts
            </Button>
          </CardFooter>
        )}
      </Card>

      {audit.notes && (
        <Card className="p-3 text-sm">
          <span className="font-semibold text-foreground">Notes: </span>
          {audit.notes}
        </Card>
      )}
    </PageLayout>
  )
}
