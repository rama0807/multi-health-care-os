'use client'

import { PurchaseRequestStatus } from '@medicore/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useState } from 'react'

import { PageLayout } from '@/components/layout/page-layout'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { StatusBadge } from '@/components/ui/status-badge'
import { Table, TableBody, TableCell, TableContainer, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import {
  approvePurchaseRequest,
  cancelPurchaseRequest,
  getPurchaseRequest,
  rejectPurchaseRequest,
  submitPurchaseRequest,
} from '@/lib/api/procurement'
import { useAuth } from '@/lib/auth/auth-context'

function getErrorMessage(error: unknown): string {
  const axiosError = error as { response?: { data?: { error?: { message?: string } } } }
  return axiosError?.response?.data?.error?.message ?? 'Something went wrong. Please try again.'
}

export default function PurchaseRequestDetailPage() {
  const params = useParams<{ id: string }>()
  const { hasPermission } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const canUpdate = hasPermission('inventory.procurement.update')
  const canApprove = hasPermission('inventory.procurement.approve')

  const [rejectOpen, setRejectOpen] = useState(false)
  const [reason, setReason] = useState('')

  const prQuery = useQuery({ queryKey: ['inventory', 'purchase-requests', 'detail', params.id], queryFn: () => getPurchaseRequest(params.id) })

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ['inventory', 'purchase-requests'] })
  }

  const submitMutation = useMutation({
    mutationFn: () => submitPurchaseRequest(params.id),
    onSuccess: () => {
      toast({ title: 'Request submitted' })
      invalidate()
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Could not submit', description: getErrorMessage(error) }),
  })
  const approveMutation = useMutation({
    mutationFn: () => approvePurchaseRequest(params.id),
    onSuccess: () => {
      toast({ title: 'Request approved' })
      invalidate()
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Could not approve', description: getErrorMessage(error) }),
  })
  const rejectMutation = useMutation({
    mutationFn: () => rejectPurchaseRequest(params.id, { reason }),
    onSuccess: () => {
      toast({ title: 'Request rejected' })
      setRejectOpen(false)
      setReason('')
      invalidate()
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Could not reject', description: getErrorMessage(error) }),
  })
  const cancelMutation = useMutation({
    mutationFn: () => cancelPurchaseRequest(params.id),
    onSuccess: () => {
      toast({ title: 'Request cancelled' })
      invalidate()
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Could not cancel', description: getErrorMessage(error) }),
  })

  if (prQuery.isLoading) {
    return (
      <PageLayout
        breadcrumbs={[{ label: 'Inventory', href: '/dashboard/inventory' }, { label: 'Purchase Requests', href: '/dashboard/inventory/purchase-requests' }, { label: '…' }]}
        title="…"
        loading
      >
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </PageLayout>
    )
  }

  if (prQuery.isError || !prQuery.data) {
    return (
      <PageLayout
        breadcrumbs={[{ label: 'Inventory', href: '/dashboard/inventory' }, { label: 'Purchase Requests', href: '/dashboard/inventory/purchase-requests' }, { label: 'Not found' }]}
        title="Purchase request not found"
      >
        <EmptyState
          variant="error"
          title="Purchase request not found"
          description={getErrorMessage(prQuery.error)}
          action={{ label: 'Back to list', href: '/dashboard/inventory/purchase-requests' }}
        />
      </PageLayout>
    )
  }

  const pr = prQuery.data
  const canCancel = [PurchaseRequestStatus.DRAFT, PurchaseRequestStatus.SUBMITTED, PurchaseRequestStatus.APPROVED].includes(pr.status)

  return (
    <PageLayout
      breadcrumbs={[
        { label: 'Inventory', href: '/dashboard/inventory' },
        { label: 'Purchase Requests', href: '/dashboard/inventory/purchase-requests' },
        { label: pr.requestNumber },
      ]}
      title={pr.requestNumber}
      badge={<StatusBadge status={pr.status} />}
      description={pr.rejectionReason ? `Rejected: ${pr.rejectionReason}` : undefined}
      meta={<span>Store: {pr.store.name}</span>}
      actions={
        canUpdate && (
          <>
            {pr.status === PurchaseRequestStatus.DRAFT && (
              <Button size="sm" onClick={() => submitMutation.mutate()} disabled={submitMutation.isPending}>
                Submit
              </Button>
            )}
            {canApprove && pr.status === PurchaseRequestStatus.SUBMITTED && (
              <>
                <Button size="sm" onClick={() => approveMutation.mutate()} disabled={approveMutation.isPending}>
                  Approve
                </Button>
                <Button size="sm" variant="outline" onClick={() => setRejectOpen(true)}>
                  Reject
                </Button>
              </>
            )}
            {pr.status === PurchaseRequestStatus.APPROVED && (
              <Button size="sm" asChild>
                <Link href={`/dashboard/inventory/purchase-orders?fromPr=${pr.id}`}>Create purchase order</Link>
              </Button>
            )}
            {canCancel && (
              <Button size="sm" variant="outline" onClick={() => cancelMutation.mutate()} disabled={cancelMutation.isPending}>
                Cancel
              </Button>
            )}
          </>
        )
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
                <TableHead align="right">Quantity</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pr.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    {item.item.name} <span className="font-mono text-xs text-muted-foreground">({item.item.code})</span>
                  </TableCell>
                  <TableCell align="right">{item.quantity}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{item.notes ?? '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      {pr.notes && (
        <Card className="p-3 text-sm">
          <span className="font-semibold text-foreground">Notes: </span>
          {pr.notes}
        </Card>
      )}

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject request</DialogTitle>
            <DialogDescription>A reason is required.</DialogDescription>
          </DialogHeader>
          <Textarea placeholder="Reason" value={reason} onChange={(e) => setReason(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>
              Back
            </Button>
            <Button variant="destructive" onClick={() => rejectMutation.mutate()} disabled={!reason.trim() || rejectMutation.isPending}>
              {rejectMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Confirm reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageLayout>
  )
}
