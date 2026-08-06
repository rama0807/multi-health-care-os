'use client'

import { InsuranceClaimStatus } from '@medicore/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Download, FileText, Loader2, Upload, XCircle } from 'lucide-react'
import { useParams } from 'next/navigation'
import { useState } from 'react'

import { PageLayout } from '@/components/layout/page-layout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardToolbar } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { PageHeaderMeta } from '@/components/ui/page-header'
import { StatusBadge } from '@/components/ui/status-badge'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import {
  closeInsuranceClaim,
  decideInsuranceClaim,
  getInsuranceClaim,
  markInsuranceClaimUnderReview,
  settleInsuranceClaim,
  submitInsuranceClaim,
  uploadClaimDocument,
} from '@/lib/api/insurance'
import { useAuth } from '@/lib/auth/auth-context'

function getErrorMessage(error: unknown): string {
  const axiosError = error as { response?: { data?: { error?: { message?: string } } } }
  return axiosError?.response?.data?.error?.message ?? 'Something went wrong. Please try again.'
}

function formatEnumLabel(value: string): string {
  return value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, ' ')
}

export default function InsuranceClaimDetailPage() {
  const params = useParams<{ claimId: string }>()
  const claimId = params.claimId
  const { hasPermission } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const canCreate = hasPermission('insurance.claims.create')
  const canUpdate = hasPermission('insurance.claims.update')
  const canSettle = hasPermission('insurance.settlement.manage')

  const [decideOpen, setDecideOpen] = useState<'APPROVED' | 'PARTIALLY_APPROVED' | 'REJECTED' | null>(null)
  const [approvedAmount, setApprovedAmount] = useState('')
  const [rejectionReason, setRejectionReason] = useState('')
  const [settleOpen, setSettleOpen] = useState(false)
  const [insuranceShare, setInsuranceShare] = useState('')
  const [patientShare, setPatientShare] = useState('0')
  const [adjustmentAmount, setAdjustmentAmount] = useState('0')
  const [writeOffAmount, setWriteOffAmount] = useState('0')
  const [file, setFile] = useState<File | null>(null)

  const claimQuery = useQuery({ queryKey: ['insurance', 'claims', claimId], queryFn: () => getInsuranceClaim(claimId) })
  const claim = claimQuery.data

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ['insurance', 'claims', claimId] })
    void queryClient.invalidateQueries({ queryKey: ['insurance', 'claims', 'list'] })
  }

  const submitMutation = useMutation({
    mutationFn: () => submitInsuranceClaim(claimId),
    onSuccess: () => {
      toast({ title: 'Claim submitted' })
      invalidate()
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Could not submit', description: getErrorMessage(error) }),
  })

  const reviewMutation = useMutation({
    mutationFn: () => markInsuranceClaimUnderReview(claimId),
    onSuccess: () => {
      toast({ title: 'Marked under review' })
      invalidate()
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Could not update', description: getErrorMessage(error) }),
  })

  const decideMutation = useMutation({
    mutationFn: () => {
      if (!decideOpen) throw new Error('No decision selected')
      return decideInsuranceClaim(claimId, {
        status: decideOpen,
        approvedAmount: decideOpen === 'REJECTED' ? undefined : Number(approvedAmount),
        rejectionReason: decideOpen === 'REJECTED' ? rejectionReason : undefined,
      })
    },
    onSuccess: () => {
      toast({ title: 'Decision recorded' })
      setDecideOpen(null)
      setApprovedAmount('')
      setRejectionReason('')
      invalidate()
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Could not record decision', description: getErrorMessage(error) }),
  })

  const settleMutation = useMutation({
    mutationFn: () =>
      settleInsuranceClaim(claimId, {
        insuranceShare: Number(insuranceShare),
        patientShare: Number(patientShare),
        adjustmentAmount: Number(adjustmentAmount),
        writeOffAmount: Number(writeOffAmount),
      }),
    onSuccess: () => {
      toast({ title: 'Claim settled' })
      setSettleOpen(false)
      invalidate()
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Could not settle claim', description: getErrorMessage(error) }),
  })

  const closeMutation = useMutation({
    mutationFn: () => closeInsuranceClaim(claimId, {}),
    onSuccess: () => {
      toast({ title: 'Claim closed' })
      invalidate()
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Could not close claim', description: getErrorMessage(error) }),
  })

  const uploadMutation = useMutation({
    mutationFn: () => {
      if (!file) throw new Error('Choose a file first')
      return uploadClaimDocument(claimId, file)
    },
    onSuccess: () => {
      toast({ title: 'Document uploaded' })
      setFile(null)
      invalidate()
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Upload failed', description: getErrorMessage(error) }),
  })

  if (claimQuery.isLoading) {
    return (
      <PageLayout
        breadcrumbs={[{ label: 'Insurance', href: '/dashboard/insurance' }, { label: 'Claims', href: '/dashboard/insurance/claims' }, { label: '…' }]}
        title="…"
        loading
      >
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </PageLayout>
    )
  }
  if (claimQuery.isError || !claim) {
    return (
      <PageLayout
        breadcrumbs={[{ label: 'Insurance', href: '/dashboard/insurance' }, { label: 'Claims', href: '/dashboard/insurance/claims' }, { label: 'Not found' }]}
        title="Claim not found"
      >
        <EmptyState
          variant="error"
          title="Couldn't load this claim"
          description={getErrorMessage(claimQuery.error)}
          action={{ label: 'Back to claims', href: '/dashboard/insurance/claims' }}
        />
      </PageLayout>
    )
  }

  const timeline = [
    { label: 'Filed', at: claim.createdAt },
    { label: 'Submitted', at: claim.submittedAt },
    { label: 'Settled', at: claim.settledAt },
    { label: 'Closed', at: claim.closedAt },
  ].filter((t) => t.at)

  return (
    <PageLayout
      breadcrumbs={[
        { label: 'Insurance', href: '/dashboard/insurance' },
        { label: 'Claims', href: '/dashboard/insurance/claims' },
        { label: claim.claimNumber },
      ]}
      title={claim.claimNumber}
      badge={<StatusBadge status={claim.status} />}
      meta={
        <PageHeaderMeta label="Patient">
          {claim.patient.fullName} · {claim.patient.uhid} · {claim.insuranceProvider} ({claim.policyNumber})
        </PageHeaderMeta>
      }
      actions={
        <>
          {canCreate && claim.status === InsuranceClaimStatus.DRAFT && (
            <Button onClick={() => submitMutation.mutate()} disabled={submitMutation.isPending}>
              {submitMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Submit
            </Button>
          )}
          {canUpdate && claim.status === InsuranceClaimStatus.SUBMITTED && (
            <Button variant="outline" onClick={() => reviewMutation.mutate()} disabled={reviewMutation.isPending}>
              Mark under review
            </Button>
          )}
          {canUpdate && claim.status === InsuranceClaimStatus.UNDER_REVIEW && (
            <>
              <Button onClick={() => setDecideOpen('APPROVED')}>
                <CheckCircle2 className="h-3.5 w-3.5" />
                Approve
              </Button>
              <Button variant="outline" onClick={() => setDecideOpen('PARTIALLY_APPROVED')}>
                Partially approve
              </Button>
              <Button variant="destructive" onClick={() => setDecideOpen('REJECTED')}>
                <XCircle className="h-3.5 w-3.5" />
                Reject
              </Button>
            </>
          )}
          {canSettle &&
            (claim.status === InsuranceClaimStatus.APPROVED || claim.status === InsuranceClaimStatus.PARTIALLY_APPROVED) && (
            <Button onClick={() => setSettleOpen(true)}>Settle</Button>
          )}
          {canUpdate &&
            (claim.status === InsuranceClaimStatus.REJECTED ||
              claim.status === InsuranceClaimStatus.SETTLED ||
              claim.status === InsuranceClaimStatus.PARTIALLY_SETTLED) && (
            <Button variant="outline" onClick={() => closeMutation.mutate()} disabled={closeMutation.isPending}>
              Close
            </Button>
          )}
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Settlement</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            <Row label="Claimed amount" value={`₹${claim.claimedAmount}`} bold />
            <Row label="Approved amount" value={claim.approvedAmount ? `₹${claim.approvedAmount}` : '-'} />
            <Row label="Rejected amount" value={claim.rejectedAmount ? `₹${claim.rejectedAmount}` : '-'} />
            <Row label="Insurance share" value={claim.insuranceShare ? `₹${claim.insuranceShare}` : '-'} />
            <Row label="Patient share" value={claim.patientShare ? `₹${claim.patientShare}` : '-'} />
            <Row label="Adjustment" value={`₹${claim.adjustmentAmount}`} />
            <Row label="Write-off" value={`₹${claim.writeOffAmount}`} />
            <Row label="Outstanding" value={claim.outstandingAmount ? `₹${claim.outstandingAmount}` : '-'} bold />
            <Row label="Payment status" value={formatEnumLabel(claim.paymentStatus)} />
            {claim.rejectionReason && <Row label="Rejection reason" value={claim.rejectionReason} />}
            <div className="border-t pt-2 text-xs text-muted-foreground">
              Invoice {claim.invoice.invoiceNumber} · Total ₹{claim.invoice.totalAmount} · Balance due ₹{claim.invoice.balanceDue}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Timeline</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ul className="space-y-2 text-sm">
              {timeline.map((t) => (
                <li key={t.label} className="flex justify-between text-muted-foreground">
                  <span>{t.label}</span>
                  <span>{new Date(t.at as Date).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardToolbar>
          <CardTitle>Documents</CardTitle>
          {canUpdate && (
            <div className="flex items-center gap-2">
              <Input
                type="file"
                accept="application/pdf,image/png,image/jpeg,image/webp"
                className="h-8 w-56 text-xs"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              <Button size="sm" variant="outline" onClick={() => uploadMutation.mutate()} disabled={!file || uploadMutation.isPending}>
                {uploadMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                Upload
              </Button>
            </div>
          )}
        </CardToolbar>
        {claim.documents.length === 0 ? (
          <EmptyState compact title="No documents attached yet" />
        ) : (
          <ul className="divide-y border-t">
            {claim.documents.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span>{d.fileName}</span>
                  <Badge variant="outline">{formatEnumLabel(d.type)}</Badge>
                  {d.autoAttached && <Badge variant="neutral">Auto-attached</Badge>}
                </div>
                <a href={d.fileUrl} target="_blank" rel="noreferrer">
                  <Button variant="ghost" size="sm">
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                </a>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Dialog open={Boolean(decideOpen)} onOpenChange={(open) => !open && setDecideOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{decideOpen === 'REJECTED' ? 'Reject claim' : 'Approve claim'}</DialogTitle>
          </DialogHeader>
          {decideOpen === 'REJECTED' ? (
            <Textarea placeholder="Rejection reason" value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} />
          ) : (
            <Input
              type="number"
              placeholder="Approved amount ₹"
              value={approvedAmount}
              onChange={(e) => setApprovedAmount(e.target.value)}
            />
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDecideOpen(null)}>
              Cancel
            </Button>
            <Button
              variant={decideOpen === 'REJECTED' ? 'destructive' : 'default'}
              onClick={() => decideMutation.mutate()}
              disabled={decideMutation.isPending || (decideOpen === 'REJECTED' ? !rejectionReason.trim() : !approvedAmount)}
            >
              {decideMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={settleOpen} onOpenChange={setSettleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Settle claim</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Input type="number" placeholder="Insurance share ₹" value={insuranceShare} onChange={(e) => setInsuranceShare(e.target.value)} />
            <Input type="number" placeholder="Patient share ₹" value={patientShare} onChange={(e) => setPatientShare(e.target.value)} />
            <Input type="number" placeholder="Adjustment ₹" value={adjustmentAmount} onChange={(e) => setAdjustmentAmount(e.target.value)} />
            <Input type="number" placeholder="Write-off ₹" value={writeOffAmount} onChange={(e) => setWriteOffAmount(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSettleOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => settleMutation.mutate()} disabled={!insuranceShare || settleMutation.isPending}>
              {settleMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Settle
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageLayout>
  )
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  )
}
