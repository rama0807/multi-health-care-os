'use client'

import { RequisitionStatus } from '@medicore/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useParams } from 'next/navigation'
import { useState } from 'react'

import { PageLayout } from '@/components/layout/page-layout'
import { Button } from '@/components/ui/button'
import { Card, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { StatusBadge } from '@/components/ui/status-badge'
import { Table, TableBody, TableCell, TableContainer, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import {
  approveStoreRequisition,
  cancelStoreRequisition,
  getStoreRequisition,
  issueStoreRequisition,
  receiveStoreRequisition,
  rejectStoreRequisition,
} from '@/lib/api/procurement'
import { useAuth } from '@/lib/auth/auth-context'

function getErrorMessage(error: unknown): string {
  const axiosError = error as { response?: { data?: { error?: { message?: string } } } }
  return axiosError?.response?.data?.error?.message ?? 'Something went wrong. Please try again.'
}

function formatEnumLabel(value: string): string {
  return value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, ' ')
}

export default function StoreRequisitionDetailPage() {
  const params = useParams<{ id: string }>()
  const { hasPermission } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const canUpdate = hasPermission('inventory.requests.update')
  const canApprove = hasPermission('inventory.requests.approve')

  const [rejectOpen, setRejectOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [issueQty, setIssueQty] = useState<Record<string, string>>({})
  const [receiveQty, setReceiveQty] = useState<Record<string, string>>({})

  const reqQuery = useQuery({
    queryKey: ['inventory', 'requisitions', 'detail', params.id],
    queryFn: () => getStoreRequisition(params.id),
  })

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ['inventory', 'requisitions'] })
    void queryClient.invalidateQueries({ queryKey: ['inventory', 'stock'] })
  }

  const approveMutation = useMutation({
    mutationFn: () => approveStoreRequisition(params.id),
    onSuccess: () => {
      toast({ title: 'Requisition approved' })
      invalidate()
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Could not approve', description: getErrorMessage(error) }),
  })
  const rejectMutation = useMutation({
    mutationFn: () => rejectStoreRequisition(params.id, { reason }),
    onSuccess: () => {
      toast({ title: 'Requisition rejected' })
      setRejectOpen(false)
      setReason('')
      invalidate()
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Could not reject', description: getErrorMessage(error) }),
  })
  const issueMutation = useMutation({
    mutationFn: (items: Array<{ storeRequisitionItemId: string; quantityIssued: number }>) => issueStoreRequisition(params.id, { items }),
    onSuccess: () => {
      toast({ title: 'Items issued' })
      setIssueQty({})
      invalidate()
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Could not issue', description: getErrorMessage(error) }),
  })
  const receiveMutation = useMutation({
    mutationFn: (items: Array<{ storeRequisitionItemId: string; quantityReceived: number }>) => receiveStoreRequisition(params.id, { items }),
    onSuccess: () => {
      toast({ title: 'Items received' })
      setReceiveQty({})
      invalidate()
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Could not receive', description: getErrorMessage(error) }),
  })
  const cancelMutation = useMutation({
    mutationFn: () => cancelStoreRequisition(params.id),
    onSuccess: () => {
      toast({ title: 'Requisition cancelled' })
      invalidate()
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Could not cancel', description: getErrorMessage(error) }),
  })

  if (reqQuery.isLoading) {
    return (
      <PageLayout
        breadcrumbs={[{ label: 'Inventory', href: '/dashboard/inventory' }, { label: 'Requisitions', href: '/dashboard/inventory/requisitions' }, { label: '…' }]}
        title="…"
        loading
      >
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </PageLayout>
    )
  }

  if (reqQuery.isError || !reqQuery.data) {
    return (
      <PageLayout
        breadcrumbs={[{ label: 'Inventory', href: '/dashboard/inventory' }, { label: 'Requisitions', href: '/dashboard/inventory/requisitions' }, { label: 'Not found' }]}
        title="Requisition not found"
      >
        <EmptyState
          variant="error"
          title="Requisition not found"
          description={getErrorMessage(reqQuery.error)}
          action={{ label: 'Back to list', href: '/dashboard/inventory/requisitions' }}
        />
      </PageLayout>
    )
  }

  const req = reqQuery.data
  const canIssue = req.status === RequisitionStatus.APPROVED || req.status === RequisitionStatus.PARTIALLY_ISSUED
  const canReceive = req.status === RequisitionStatus.ISSUED || req.status === RequisitionStatus.PARTIALLY_ISSUED
  const canCancel = req.status === RequisitionStatus.REQUESTED || req.status === RequisitionStatus.APPROVED

  return (
    <PageLayout
      breadcrumbs={[
        { label: 'Inventory', href: '/dashboard/inventory' },
        { label: 'Requisitions', href: '/dashboard/inventory/requisitions' },
        { label: req.requisitionNumber },
      ]}
      title={req.requisitionNumber}
      badge={<StatusBadge status={req.status} />}
      description={req.rejectionReason ? `Rejected: ${req.rejectionReason}` : undefined}
      meta={<span>{req.fromStore.name} → {req.toStore.name} · {formatEnumLabel(req.priority)} priority</span>}
      actions={
        <>
          {canUpdate && canApprove && req.status === RequisitionStatus.REQUESTED && (
            <>
              <Button size="sm" onClick={() => approveMutation.mutate()} disabled={approveMutation.isPending}>
                Approve
              </Button>
              <Button size="sm" variant="outline" onClick={() => setRejectOpen(true)}>
                Reject
              </Button>
            </>
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
                <TableHead align="right">Requested</TableHead>
                <TableHead align="right">Issued</TableHead>
                <TableHead align="right">Received</TableHead>
                {canUpdate && canIssue && <TableHead>Issue now</TableHead>}
                {canUpdate && canReceive && <TableHead>Receive now</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {req.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    {item.item.name} <span className="font-mono text-xs text-muted-foreground">({item.item.code})</span>
                  </TableCell>
                  <TableCell align="right">{item.quantityRequested}</TableCell>
                  <TableCell align="right">{item.quantityIssued}</TableCell>
                  <TableCell align="right">{item.quantityReceived}</TableCell>
                  {canUpdate && canIssue && (
                    <TableCell>
                      {item.quantityIssued < item.quantityRequested && (
                        <Input
                          className="h-8 w-20"
                          type="number"
                          placeholder={`≤${item.quantityRequested - item.quantityIssued}`}
                          value={issueQty[item.id] ?? ''}
                          onChange={(e) => setIssueQty((prev) => ({ ...prev, [item.id]: e.target.value }))}
                        />
                      )}
                    </TableCell>
                  )}
                  {canUpdate && canReceive && (
                    <TableCell>
                      {item.quantityReceived < item.quantityIssued && (
                        <Input
                          className="h-8 w-20"
                          type="number"
                          placeholder={`≤${item.quantityIssued - item.quantityReceived}`}
                          value={receiveQty[item.id] ?? ''}
                          onChange={(e) => setReceiveQty((prev) => ({ ...prev, [item.id]: e.target.value }))}
                        />
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {canUpdate && canIssue && (
          <CardFooter className="justify-end">
            <Button
              size="sm"
              onClick={() =>
                issueMutation.mutate(
                  Object.entries(issueQty)
                    .filter(([, qty]) => Number(qty) > 0)
                    .map(([storeRequisitionItemId, qty]) => ({ storeRequisitionItemId, quantityIssued: Number(qty) })),
                )
              }
              disabled={Object.values(issueQty).every((q) => !q) || issueMutation.isPending}
            >
              {issueMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Issue selected
            </Button>
          </CardFooter>
        )}
        {canUpdate && canReceive && (
          <CardFooter className="justify-end">
            <Button
              size="sm"
              onClick={() =>
                receiveMutation.mutate(
                  Object.entries(receiveQty)
                    .filter(([, qty]) => Number(qty) > 0)
                    .map(([storeRequisitionItemId, qty]) => ({ storeRequisitionItemId, quantityReceived: Number(qty) })),
                )
              }
              disabled={Object.values(receiveQty).every((q) => !q) || receiveMutation.isPending}
            >
              {receiveMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Receive selected
            </Button>
          </CardFooter>
        )}
      </Card>

      {req.notes && (
        <Card className="p-3 text-sm">
          <span className="font-semibold text-foreground">Notes: </span>
          {req.notes}
        </Card>
      )}

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject requisition</DialogTitle>
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
