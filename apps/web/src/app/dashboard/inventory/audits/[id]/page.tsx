'use client'

import { StockAuditStatus } from '@medicore/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { useParams, useRouter } from 'next/navigation'
import { useState } from 'react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'
import { cancelStockAudit, completeStockAudit, getStockAudit, recordStockAuditCounts, startStockAudit } from '@/lib/api/procurement'
import { useAuth } from '@/lib/auth/auth-context'

function getErrorMessage(error: unknown): string {
  const axiosError = error as { response?: { data?: { error?: { message?: string } } } }
  return axiosError?.response?.data?.error?.message ?? 'Something went wrong. Please try again.'
}

function formatEnumLabel(value: string): string {
  return value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, ' ')
}

const STATUS_BADGE: Record<StockAuditStatus, 'secondary' | 'outline' | 'success' | 'destructive'> = {
  [StockAuditStatus.DRAFT]: 'secondary',
  [StockAuditStatus.IN_PROGRESS]: 'outline',
  [StockAuditStatus.COMPLETED]: 'success',
  [StockAuditStatus.CANCELLED]: 'destructive',
}

export default function StockAuditDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
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
      toast({ title: 'Audit completed — variances applied to stock' })
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
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (auditQuery.isError || !auditQuery.data) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Stock audit not found</AlertTitle>
        <AlertDescription>
          {getErrorMessage(auditQuery.error)}{' '}
          <Button variant="link" className="h-auto p-0" onClick={() => router.push('/dashboard/inventory/audits')}>
            Back to list
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  const audit = auditQuery.data
  const canRecord = audit.status === StockAuditStatus.IN_PROGRESS
  const allCounted = audit.items.every((item) => item.countedQuantity !== null || counts[item.id] !== undefined)
  const canCancel = audit.status === StockAuditStatus.DRAFT || audit.status === StockAuditStatus.IN_PROGRESS

  return (
    <div className="space-y-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-mono text-lg font-semibold text-foreground">{audit.auditNumber}</h1>
            <Badge variant={STATUS_BADGE[audit.status]}>{formatEnumLabel(audit.status)}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">Store: {audit.store.name}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canUpdate && audit.status === StockAuditStatus.DRAFT && (
            <Button size="sm" onClick={() => startMutation.mutate()} disabled={startMutation.isPending}>
              Start count
            </Button>
          )}
          {canManage && audit.status === StockAuditStatus.IN_PROGRESS && (
            <Button size="sm" onClick={() => completeMutation.mutate()} disabled={!allCounted || completeMutation.isPending}>
              {completeMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Complete — apply variances
            </Button>
          )}
          {canUpdate && canCancel && (
            <Button size="sm" variant="outline" onClick={() => cancelMutation.mutate()} disabled={cancelMutation.isPending}>
              Cancel
            </Button>
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
              <TableHead>System qty</TableHead>
              <TableHead>Counted qty</TableHead>
              <TableHead>Variance</TableHead>
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
                  <TableCell>{item.systemQuantity}</TableCell>
                  <TableCell>
                    {canRecord && item.countedQuantity === null ? (
                      <Input
                        className="h-8 w-24"
                        type="number"
                        value={counts[item.id] ?? ''}
                        onChange={(e) => setCounts((prev) => ({ ...prev, [item.id]: e.target.value }))}
                      />
                    ) : (
                      (item.countedQuantity ?? '—')
                    )}
                  </TableCell>
                  <TableCell className={variance !== null && variance !== 0 ? 'font-medium text-destructive' : 'text-muted-foreground'}>
                    {variance ?? '—'}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
        {canRecord && Object.keys(counts).length > 0 && (
          <div className="flex justify-end border-t p-3">
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
          </div>
        )}
      </div>

      {audit.notes && (
        <div className="rounded-lg border bg-card p-3 text-sm">
          <span className="font-semibold text-foreground">Notes: </span>
          {audit.notes}
        </div>
      )}
    </div>
  )
}
