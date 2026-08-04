'use client'

import { GrnStatus } from '@medicore/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { useParams, useRouter } from 'next/navigation'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'
import { cancelGoodsReceiptNote, completeGoodsReceiptNote, getGoodsReceiptNote } from '@/lib/api/procurement'
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

export default function GrnDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const { hasPermission } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const canUpdate = hasPermission('inventory.procurement.update')

  const grnQuery = useQuery({ queryKey: ['inventory', 'grn', 'detail', params.id], queryFn: () => getGoodsReceiptNote(params.id) })

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ['inventory', 'grn'] })
    void queryClient.invalidateQueries({ queryKey: ['inventory', 'purchase-orders'] })
    void queryClient.invalidateQueries({ queryKey: ['inventory', 'stock'] })
    void queryClient.invalidateQueries({ queryKey: ['inventory', 'dashboard-stats'] })
  }

  const completeMutation = useMutation({
    mutationFn: () => completeGoodsReceiptNote(params.id),
    onSuccess: () => {
      toast({ title: 'GRN completed — stock updated' })
      invalidate()
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Could not complete', description: getErrorMessage(error) }),
  })
  const cancelMutation = useMutation({
    mutationFn: () => cancelGoodsReceiptNote(params.id),
    onSuccess: () => {
      toast({ title: 'GRN cancelled' })
      invalidate()
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Could not cancel', description: getErrorMessage(error) }),
  })

  if (grnQuery.isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (grnQuery.isError || !grnQuery.data) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>GRN not found</AlertTitle>
        <AlertDescription>
          {getErrorMessage(grnQuery.error)}{' '}
          <Button variant="link" className="h-auto p-0" onClick={() => router.push('/dashboard/inventory/grn')}>
            Back to list
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  const grn = grnQuery.data

  return (
    <div className="space-y-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-mono text-lg font-semibold text-foreground">{grn.grnNumber}</h1>
            <Badge variant={STATUS_BADGE[grn.status]}>{formatEnumLabel(grn.status)}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Against PO {grn.purchaseOrder.poNumber} · Store: {grn.store.name}
          </p>
        </div>
        {canUpdate && grn.status === GrnStatus.DRAFT && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => cancelMutation.mutate()} disabled={cancelMutation.isPending}>
              Cancel
            </Button>
            <Button size="sm" onClick={() => completeMutation.mutate()} disabled={completeMutation.isPending}>
              {completeMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Complete — update stock
            </Button>
          </div>
        )}
      </div>

      <div className="rounded-lg border bg-card">
        <div className="border-b p-3">
          <h3 className="text-sm font-semibold text-foreground">Items received</h3>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead>Quantity</TableHead>
              <TableHead>Batch</TableHead>
              <TableHead>Expiry</TableHead>
              <TableHead>Unit price</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {grn.items.map((item) => (
              <TableRow key={item.id}>
                <TableCell>
                  {item.item.name} <span className="font-mono text-xs text-muted-foreground">({item.item.code})</span>
                </TableCell>
                <TableCell>{item.quantityReceived}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{item.batchNumber ?? '—'}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {item.expiryDate ? new Date(item.expiryDate).toLocaleDateString('en-IN') : '—'}
                </TableCell>
                <TableCell className="text-xs">₹{item.unitPrice}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {grn.notes && (
        <div className="rounded-lg border bg-card p-3 text-sm">
          <span className="font-semibold text-foreground">Notes: </span>
          {grn.notes}
        </div>
      )}
    </div>
  )
}
