'use client'

import { PurchaseRequestStatus } from '@medicore/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useState } from 'react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
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

function formatEnumLabel(value: string): string {
  return value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, ' ')
}

const STATUS_BADGE: Record<PurchaseRequestStatus, 'secondary' | 'outline' | 'success' | 'destructive'> = {
  [PurchaseRequestStatus.DRAFT]: 'secondary',
  [PurchaseRequestStatus.SUBMITTED]: 'outline',
  [PurchaseRequestStatus.APPROVED]: 'success',
  [PurchaseRequestStatus.REJECTED]: 'destructive',
  [PurchaseRequestStatus.CONVERTED]: 'success',
  [PurchaseRequestStatus.CANCELLED]: 'destructive',
}

export default function PurchaseRequestDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
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
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (prQuery.isError || !prQuery.data) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Purchase request not found</AlertTitle>
        <AlertDescription>
          {getErrorMessage(prQuery.error)}{' '}
          <Button variant="link" className="h-auto p-0" onClick={() => router.push('/dashboard/inventory/purchase-requests')}>
            Back to list
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  const pr = prQuery.data
  const canCancel = [PurchaseRequestStatus.DRAFT, PurchaseRequestStatus.SUBMITTED, PurchaseRequestStatus.APPROVED].includes(pr.status)

  return (
    <div className="space-y-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-mono text-lg font-semibold text-foreground">{pr.requestNumber}</h1>
            <Badge variant={STATUS_BADGE[pr.status]}>{formatEnumLabel(pr.status)}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">Store: {pr.store.name}</p>
          {pr.rejectionReason && <p className="text-xs text-destructive">Rejected: {pr.rejectionReason}</p>}
        </div>
        {canUpdate && (
          <div className="flex flex-wrap gap-2">
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
          </div>
        )}
      </div>

      <div className="rounded-lg border bg-card">
        <div className="border-b p-3">
          <h3 className="text-sm font-semibold text-foreground">Items</h3>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead>Quantity</TableHead>
              <TableHead>Notes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pr.items.map((item) => (
              <TableRow key={item.id}>
                <TableCell>
                  {item.item.name} <span className="font-mono text-xs text-muted-foreground">({item.item.code})</span>
                </TableCell>
                <TableCell>{item.quantity}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{item.notes ?? '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {pr.notes && (
        <div className="rounded-lg border bg-card p-3 text-sm">
          <span className="font-semibold text-foreground">Notes: </span>
          {pr.notes}
        </div>
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
    </div>
  )
}
