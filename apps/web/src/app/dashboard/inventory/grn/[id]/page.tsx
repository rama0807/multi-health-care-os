'use client'

import { GrnStatus } from '@medicore/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useParams } from 'next/navigation'

import { PageLayout } from '@/components/layout/page-layout'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { StatusBadge } from '@/components/ui/status-badge'
import { Table, TableBody, TableCell, TableContainer, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'
import { cancelGoodsReceiptNote, completeGoodsReceiptNote, getGoodsReceiptNote } from '@/lib/api/procurement'
import { useAuth } from '@/lib/auth/auth-context'

function getErrorMessage(error: unknown): string {
  const axiosError = error as { response?: { data?: { error?: { message?: string } } } }
  return axiosError?.response?.data?.error?.message ?? 'Something went wrong. Please try again.'
}

export default function GrnDetailPage() {
  const params = useParams<{ id: string }>()
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
      <PageLayout
        breadcrumbs={[{ label: 'Inventory', href: '/dashboard/inventory' }, { label: 'Goods Receipt', href: '/dashboard/inventory/grn' }, { label: '…' }]}
        title="…"
        loading
      >
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </PageLayout>
    )
  }

  if (grnQuery.isError || !grnQuery.data) {
    return (
      <PageLayout
        breadcrumbs={[{ label: 'Inventory', href: '/dashboard/inventory' }, { label: 'Goods Receipt', href: '/dashboard/inventory/grn' }, { label: 'Not found' }]}
        title="GRN not found"
      >
        <EmptyState
          variant="error"
          title="GRN not found"
          description={getErrorMessage(grnQuery.error)}
          action={{ label: 'Back to list', href: '/dashboard/inventory/grn' }}
        />
      </PageLayout>
    )
  }

  const grn = grnQuery.data

  return (
    <PageLayout
      breadcrumbs={[
        { label: 'Inventory', href: '/dashboard/inventory' },
        { label: 'Goods Receipt', href: '/dashboard/inventory/grn' },
        { label: grn.grnNumber },
      ]}
      title={grn.grnNumber}
      badge={<StatusBadge status={grn.status} />}
      meta={<span>Against PO {grn.purchaseOrder.poNumber} · Store: {grn.store.name}</span>}
      actions={
        canUpdate &&
        grn.status === GrnStatus.DRAFT && (
          <>
            <Button size="sm" variant="outline" onClick={() => cancelMutation.mutate()} disabled={cancelMutation.isPending}>
              Cancel
            </Button>
            <Button size="sm" onClick={() => completeMutation.mutate()} disabled={completeMutation.isPending}>
              {completeMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Complete — update stock
            </Button>
          </>
        )
      }
    >
      <Card>
        <CardHeader>
          <CardTitle>Items received</CardTitle>
        </CardHeader>
        <TableContainer className="rounded-none border-0 border-y">
          <Table density="compact" container={false}>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead align="right">Quantity</TableHead>
                <TableHead>Batch</TableHead>
                <TableHead>Expiry</TableHead>
                <TableHead align="right">Unit price</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {grn.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    {item.item.name} <span className="font-mono text-xs text-muted-foreground">({item.item.code})</span>
                  </TableCell>
                  <TableCell align="right">{item.quantityReceived}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{item.batchNumber ?? '—'}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {item.expiryDate ? new Date(item.expiryDate).toLocaleDateString('en-IN') : '—'}
                  </TableCell>
                  <TableCell align="right" className="text-xs">₹{item.unitPrice}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      {grn.notes && (
        <Card className="p-3 text-sm">
          <span className="font-semibold text-foreground">Notes: </span>
          {grn.notes}
        </Card>
      )}
    </PageLayout>
  )
}
