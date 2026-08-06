'use client'

import { PreAuthorizationStatus } from '@medicore/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useState } from 'react'

import { PageLayout } from '@/components/layout/page-layout'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
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
  TableRowActions,
} from '@/components/ui/table'
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
    <PageLayout
      breadcrumbs={[{ label: 'Insurance', href: '/dashboard/insurance' }, { label: 'Pre-Authorizations' }]}
      title="Pre-Authorizations"
      description="Cashless/TPA pre-authorization requests."
      actions={
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
      }
    >
      {preAuthQuery.isLoading ? (
        <TableSkeleton rows={8} columns={canUpdate ? 7 : 6} />
      ) : preAuths.length === 0 ? (
        <EmptyState
          variant={statusFilter === 'ALL' ? 'empty' : 'search'}
          title="No pre-authorizations yet"
          description={canCreate ? 'Start one from a patient encounter.' : undefined}
        />
      ) : (
        <TableContainer className="max-h-[65vh]">
          <Table density="compact" container={false}>
            <TableHeader>
              <TableRow>
                <TableHead>Auth #</TableHead>
                <TableHead>Patient</TableHead>
                <TableHead>Insurer</TableHead>
                <TableHead align="right">Requested</TableHead>
                <TableHead align="right">Approved</TableHead>
                <TableHead>Status</TableHead>
                {canUpdate && <TableHead className="w-56" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {preAuths.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono text-xs">{p.authNumber}</TableCell>
                  <TableCell className="text-sm">
                    {p.patient.fullName} <span className="text-xs text-muted-foreground">({p.patient.uhid})</span>
                  </TableCell>
                  <TableCell className="text-sm">{p.patientInsurance.provider.name}</TableCell>
                  <TableCell align="right">₹{p.requestedAmount}</TableCell>
                  <TableCell align="right">{p.approvedAmount ? `₹${p.approvedAmount}` : '-'}</TableCell>
                  <TableCell>
                    <StatusBadge status={p.status} />
                  </TableCell>
                  {canUpdate && (
                    <TableCell align="right">
                      <TableRowActions>
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
                      </TableRowActions>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

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
    </PageLayout>
  )
}
