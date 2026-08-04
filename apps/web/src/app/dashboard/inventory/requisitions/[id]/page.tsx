'use client'

import { RequisitionStatus } from '@medicore/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { useParams, useRouter } from 'next/navigation'
import { useState } from 'react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
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

const STATUS_BADGE: Record<RequisitionStatus, 'secondary' | 'outline' | 'success' | 'destructive'> = {
  [RequisitionStatus.REQUESTED]: 'secondary',
  [RequisitionStatus.APPROVED]: 'outline',
  [RequisitionStatus.REJECTED]: 'destructive',
  [RequisitionStatus.ISSUED]: 'outline',
  [RequisitionStatus.PARTIALLY_ISSUED]: 'outline',
  [RequisitionStatus.RECEIVED]: 'success',
  [RequisitionStatus.CANCELLED]: 'destructive',
}

export default function StoreRequisitionDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
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
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (reqQuery.isError || !reqQuery.data) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Requisition not found</AlertTitle>
        <AlertDescription>
          {getErrorMessage(reqQuery.error)}{' '}
          <Button variant="link" className="h-auto p-0" onClick={() => router.push('/dashboard/inventory/requisitions')}>
            Back to list
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  const req = reqQuery.data
  const canIssue = req.status === RequisitionStatus.APPROVED || req.status === RequisitionStatus.PARTIALLY_ISSUED
  const canReceive = req.status === RequisitionStatus.ISSUED || req.status === RequisitionStatus.PARTIALLY_ISSUED
  const canCancel = req.status === RequisitionStatus.REQUESTED || req.status === RequisitionStatus.APPROVED

  return (
    <div className="space-y-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-mono text-lg font-semibold text-foreground">{req.requisitionNumber}</h1>
            <Badge variant={STATUS_BADGE[req.status]}>{formatEnumLabel(req.status)}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {req.fromStore.name} → {req.toStore.name} · {formatEnumLabel(req.priority)} priority
          </p>
          {req.rejectionReason && <p className="text-xs text-destructive">Rejected: {req.rejectionReason}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
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
              <TableHead>Requested</TableHead>
              <TableHead>Issued</TableHead>
              <TableHead>Received</TableHead>
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
                <TableCell>{item.quantityRequested}</TableCell>
                <TableCell>{item.quantityIssued}</TableCell>
                <TableCell>{item.quantityReceived}</TableCell>
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

        {canUpdate && canIssue && (
          <div className="flex justify-end border-t p-3">
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
          </div>
        )}
        {canUpdate && canReceive && (
          <div className="flex justify-end border-t p-3">
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
          </div>
        )}
      </div>

      {req.notes && (
        <div className="rounded-lg border bg-card p-3 text-sm">
          <span className="font-semibold text-foreground">Notes: </span>
          {req.notes}
        </div>
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
    </div>
  )
}
