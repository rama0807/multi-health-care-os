'use client'

import { PreAuthorizationStatus } from '@medicore/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'
import {
  cancelPreAuthorization,
  decidePreAuthorization,
  listPreAuthorizations,
  markPreAuthorizationUnderReview,
  submitPreAuthorization,
} from '@/lib/api/insurance'
import { useAuth } from '@/lib/auth/auth-context'

function getErrorMessage(error: unknown): string {
  const axiosError = error as { response?: { data?: { error?: { message?: string } } } }
  return axiosError?.response?.data?.error?.message ?? 'Something went wrong. Please try again.'
}

function formatEnumLabel(value: string): string {
  return value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, ' ')
}

const STATUS_BADGE: Record<string, 'secondary' | 'success' | 'destructive' | 'warning' | 'outline'> = {
  DRAFT: 'secondary',
  SUBMITTED: 'outline',
  UNDER_REVIEW: 'warning',
  APPROVED: 'success',
  PARTIALLY_APPROVED: 'warning',
  REJECTED: 'destructive',
  CANCELLED: 'secondary',
}

export default function PreAuthorizationQueuePage() {
  const { hasPermission } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const canCreate = hasPermission('insurance.preauth.create')
  const canUpdate = hasPermission('insurance.preauth.update')

  const [statusFilter, setStatusFilter] = useState<PreAuthorizationStatus | 'ALL'>('ALL')
  const [decideTarget, setDecideTarget] = useState<{ id: string; approve: boolean } | null>(null)
  const [approvedAmount, setApprovedAmount] = useState('')
  const [rejectionReason, setRejectionReason] = useState('')

  const preAuthQuery = useQuery({
    queryKey: ['insurance', 'preauth', 'list', statusFilter],
    queryFn: () => listPreAuthorizations({ limit: 100, status: statusFilter === 'ALL' ? undefined : statusFilter }),
  })
  const preAuths = preAuthQuery.data?.data ?? []

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ['insurance', 'preauth', 'list'] })
  }

  const submitMutation = useMutation({
    mutationFn: (id: string) => submitPreAuthorization(id),
    onSuccess: () => {
      toast({ title: 'Pre-authorization submitted' })
      invalidate()
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Could not submit', description: getErrorMessage(error) }),
  })

  const reviewMutation = useMutation({
    mutationFn: (id: string) => markPreAuthorizationUnderReview(id),
    onSuccess: () => {
      toast({ title: 'Marked under review' })
      invalidate()
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Could not update', description: getErrorMessage(error) }),
  })

  const cancelMutation = useMutation({
    mutationFn: (id: string) => cancelPreAuthorization(id, {}),
    onSuccess: () => {
      toast({ title: 'Pre-authorization cancelled' })
      invalidate()
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Could not cancel', description: getErrorMessage(error) }),
  })

  const decideMutation = useMutation({
    mutationFn: () => {
      if (!decideTarget) throw new Error('No target')
      return decidePreAuthorization(decideTarget.id, {
        status: decideTarget.approve ? 'APPROVED' : 'REJECTED',
        approvedAmount: decideTarget.approve ? Number(approvedAmount) : undefined,
        rejectionReason: decideTarget.approve ? undefined : rejectionReason,
      })
    },
    onSuccess: () => {
      toast({ title: 'Decision recorded' })
      setDecideTarget(null)
      setApprovedAmount('')
      setRejectionReason('')
      invalidate()
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Could not record decision', description: getErrorMessage(error) }),
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Pre-Authorizations</h1>
          <p className="text-sm text-muted-foreground">Cashless/TPA pre-authorization requests.</p>
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as PreAuthorizationStatus | 'ALL')}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            {Object.values(PreAuthorizationStatus).map((s) => (
              <SelectItem key={s} value={s}>
                {formatEnumLabel(s)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Auth #</TableHead>
              <TableHead>Patient</TableHead>
              <TableHead>Insurer</TableHead>
              <TableHead>Requested</TableHead>
              <TableHead>Approved</TableHead>
              <TableHead>Status</TableHead>
              {canUpdate && <TableHead>Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {preAuthQuery.isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                </TableCell>
              </TableRow>
            ) : preAuths.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  {canCreate ? 'No pre-authorizations yet — start one from a patient encounter.' : 'No pre-authorizations yet.'}
                </TableCell>
              </TableRow>
            ) : (
              preAuths.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono text-xs">{p.authNumber}</TableCell>
                  <TableCell className="text-sm">
                    {p.patient.fullName} <span className="text-xs text-muted-foreground">({p.patient.uhid})</span>
                  </TableCell>
                  <TableCell className="text-sm">{p.patientInsurance.provider.name}</TableCell>
                  <TableCell>₹{p.requestedAmount}</TableCell>
                  <TableCell>{p.approvedAmount ? `₹${p.approvedAmount}` : '—'}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_BADGE[p.status]}>{formatEnumLabel(p.status)}</Badge>
                  </TableCell>
                  {canUpdate && (
                    <TableCell>
                      <div className="flex flex-wrap gap-1.5">
                        {p.status === PreAuthorizationStatus.DRAFT && (
                          <>
                            <Button size="sm" variant="outline" onClick={() => submitMutation.mutate(p.id)}>
                              Submit
                            </Button>
                            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => cancelMutation.mutate(p.id)}>
                              Cancel
                            </Button>
                          </>
                        )}
                        {p.status === PreAuthorizationStatus.SUBMITTED && (
                          <Button size="sm" variant="outline" onClick={() => reviewMutation.mutate(p.id)}>
                            Mark under review
                          </Button>
                        )}
                        {p.status === PreAuthorizationStatus.UNDER_REVIEW && (
                          <>
                            <Button size="sm" onClick={() => setDecideTarget({ id: p.id, approve: true })}>
                              Approve
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => setDecideTarget({ id: p.id, approve: false })}>
                              Reject
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={Boolean(decideTarget)} onOpenChange={(open) => !open && setDecideTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{decideTarget?.approve ? 'Approve pre-authorization' : 'Reject pre-authorization'}</DialogTitle>
          </DialogHeader>
          {decideTarget?.approve ? (
            <Input
              type="number"
              placeholder="Approved amount ₹"
              value={approvedAmount}
              onChange={(e) => setApprovedAmount(e.target.value)}
            />
          ) : (
            <Input placeholder="Rejection reason" value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} />
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDecideTarget(null)}>
              Cancel
            </Button>
            <Button
              variant={decideTarget?.approve ? 'default' : 'destructive'}
              onClick={() => decideMutation.mutate()}
              disabled={
                decideMutation.isPending ||
                (decideTarget?.approve ? !approvedAmount : !rejectionReason.trim())
              }
            >
              {decideMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
