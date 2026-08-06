'use client'

import { DiscountApprovalStatus, DiscountType, InvoiceStatus, PaymentMode, RefundStatus } from '@medicore/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Download, Loader2, Plus, XCircle } from 'lucide-react'
import { useParams } from 'next/navigation'
import { useState } from 'react'

import { PageLayout } from '@/components/layout/page-layout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardToolbar } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { PageHeaderMeta } from '@/components/ui/page-header'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { StatusBadge } from '@/components/ui/status-badge'
import { Table, TableBody, TableCell, TableContainer, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import {
  applyInvoiceDiscount,
  approveInvoiceDiscount,
  approveRefund,
  cancelInvoice,
  downloadInvoicePdf,
  downloadReceiptPdf,
  finalizeInvoice,
  getInvoice,
  recordPayment,
  rejectInvoiceDiscount,
  rejectRefund,
  requestRefund,
} from '@/lib/api/billing'
import { useAuth } from '@/lib/auth/auth-context'

function getErrorMessage(error: unknown): string {
  const axiosError = error as { response?: { data?: { error?: { message?: string } } } }
  return axiosError?.response?.data?.error?.message ?? 'Something went wrong. Please try again.'
}

function formatEnumLabel(value: string): string {
  return value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, ' ')
}

export default function InvoiceDetailPage() {
  const params = useParams<{ invoiceId: string }>()
  const invoiceId = params.invoiceId
  const { hasPermission } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false)
  const [refundDialogOpen, setRefundDialogOpen] = useState(false)
  const [discountDialogOpen, setDiscountDialogOpen] = useState(false)
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState('')

  const canUpdate = hasPermission('billing.update')
  const canCreate = hasPermission('billing.create')
  const canManage = hasPermission('billing.manage')

  const invoiceQuery = useQuery({ queryKey: ['billing', 'invoices', invoiceId], queryFn: () => getInvoice(invoiceId) })
  const invoice = invoiceQuery.data

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ['billing', 'invoices', invoiceId] })
    void queryClient.invalidateQueries({ queryKey: ['billing', 'invoices', 'list'] })
  }

  const finalizeMutation = useMutation({
    mutationFn: () => finalizeInvoice(invoiceId),
    onSuccess: () => {
      toast({ title: 'Invoice finalized' })
      invalidate()
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Could not finalize', description: getErrorMessage(error) }),
  })

  const cancelMutation = useMutation({
    mutationFn: () => cancelInvoice(invoiceId, { reason: cancelReason }),
    onSuccess: () => {
      toast({ title: 'Invoice cancelled' })
      setCancelDialogOpen(false)
      setCancelReason('')
      invalidate()
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Could not cancel', description: getErrorMessage(error) }),
  })

  const approveDiscountMutation = useMutation({
    mutationFn: () => approveInvoiceDiscount(invoiceId),
    onSuccess: () => {
      toast({ title: 'Discount approved' })
      invalidate()
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Could not approve discount', description: getErrorMessage(error) }),
  })

  const rejectDiscountMutation = useMutation({
    mutationFn: () => rejectInvoiceDiscount(invoiceId, { reason: 'Not approved' }),
    onSuccess: () => {
      toast({ title: 'Discount rejected' })
      invalidate()
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Could not reject discount', description: getErrorMessage(error) }),
  })

  const approveRefundMutation = useMutation({
    mutationFn: (refundId: string) => approveRefund(refundId),
    onSuccess: () => {
      toast({ title: 'Refund approved' })
      invalidate()
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Could not approve refund', description: getErrorMessage(error) }),
  })

  const rejectRefundMutation = useMutation({
    mutationFn: (refundId: string) => rejectRefund(refundId, { reason: 'Not eligible' }),
    onSuccess: () => {
      toast({ title: 'Refund rejected' })
      invalidate()
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Could not reject refund', description: getErrorMessage(error) }),
  })

  if (invoiceQuery.isLoading) {
    return (
      <PageLayout
        breadcrumbs={[{ label: 'Billing', href: '/dashboard/billing' }, { label: 'Invoices', href: '/dashboard/billing/invoices' }, { label: '…' }]}
        title="…"
        loading
      >
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </PageLayout>
    )
  }
  if (invoiceQuery.isError || !invoice) {
    return (
      <PageLayout
        breadcrumbs={[{ label: 'Billing', href: '/dashboard/billing' }, { label: 'Invoices', href: '/dashboard/billing/invoices' }, { label: 'Not found' }]}
        title="Invoice not found"
      >
        <EmptyState
          variant="error"
          title="Couldn't load this invoice"
          description={getErrorMessage(invoiceQuery.error)}
          action={{ label: 'Back to invoices', href: '/dashboard/billing/invoices' }}
        />
      </PageLayout>
    )
  }

  const canPay = canCreate && (invoice.status === InvoiceStatus.ISSUED || invoice.status === InvoiceStatus.PARTIALLY_PAID)
  const canRefund =
    canCreate &&
    (invoice.status === InvoiceStatus.PAID ||
      invoice.status === InvoiceStatus.PARTIALLY_PAID ||
      invoice.status === InvoiceStatus.REFUNDED)

  return (
    <PageLayout
      breadcrumbs={[
        { label: 'Billing', href: '/dashboard/billing' },
        { label: 'Invoices', href: '/dashboard/billing/invoices' },
        { label: invoice.invoiceNumber },
      ]}
      title={invoice.invoiceNumber}
      badge={<StatusBadge status={invoice.status} />}
      meta={
        <PageHeaderMeta label="Patient">
          {invoice.patient.fullName} · {invoice.patient.uhid}
        </PageHeaderMeta>
      }
      actions={
        <>
          <Button variant="outline" onClick={() => void downloadInvoicePdf(invoice.id, invoice.invoiceNumber)}>
            <Download className="h-4 w-4" />
            PDF
          </Button>
          {canUpdate && invoice.status === InvoiceStatus.DRAFT && (
            <>
              <Button variant="outline" onClick={() => setDiscountDialogOpen(true)}>
                Apply discount
              </Button>
              <Button onClick={() => finalizeMutation.mutate()} disabled={finalizeMutation.isPending}>
                {finalizeMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Finalize
              </Button>
            </>
          )}
          {canUpdate &&
            (invoice.status === InvoiceStatus.DRAFT || invoice.status === InvoiceStatus.ISSUED) &&
            Number(invoice.paidAmount) === 0 && (
            <Button variant="destructive" onClick={() => setCancelDialogOpen(true)}>
              Cancel
            </Button>
          )}
        </>
      }
    >
      {invoice.discountApprovalStatus === DiscountApprovalStatus.PENDING && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-warning-border bg-warning-subtle p-3 text-sm text-warning-subtle-foreground">
          <span>
            Discount pending approval: {invoice.discountType === DiscountType.FLAT ? `₹${invoice.discountValue}` : `${invoice.discountValue}%`} -{' '}
            {invoice.discountReason}
          </span>
          {canManage && (
            <div className="ml-auto flex gap-2">
              <Button size="sm" onClick={() => approveDiscountMutation.mutate()} disabled={approveDiscountMutation.isPending}>
                <CheckCircle2 className="h-3.5 w-3.5" />
                Approve
              </Button>
              <Button size="sm" variant="outline" onClick={() => rejectDiscountMutation.mutate()} disabled={rejectDiscountMutation.isPending}>
                <XCircle className="h-3.5 w-3.5" />
                Reject
              </Button>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Line items</CardTitle>
          </CardHeader>
          <TableContainer className="rounded-none border-0 border-y">
            <Table density="compact" container={false}>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead align="right">Qty</TableHead>
                  <TableHead align="right">Price</TableHead>
                  <TableHead align="right">Disc%</TableHead>
                  <TableHead align="right">Tax%</TableHead>
                  <TableHead align="right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoice.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      {item.itemName}
                      <span className="ml-1 text-xs text-muted-foreground">({item.category})</span>
                    </TableCell>
                    <TableCell align="right">{item.quantity}</TableCell>
                    <TableCell align="right">₹{item.unitPrice}</TableCell>
                    <TableCell align="right">{item.discountPercent}%</TableCell>
                    <TableCell align="right">{item.taxPercent}%</TableCell>
                    <TableCell align="right">₹{item.totalPrice}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>

        <Card>
          <CardContent className="space-y-2 pt-4 text-sm">
            <Row label="Subtotal" value={`₹${invoice.subtotal}`} />
            <Row label="Discount" value={`-₹${invoice.discountAmount}`} />
            <Row label="Tax" value={`₹${invoice.taxAmount}`} />
            <Row label="Total" value={`₹${invoice.totalAmount}`} bold />
            <Row label="Paid" value={`₹${invoice.paidAmount}`} />
            <Row label="Balance due" value={`₹${invoice.balanceDue}`} bold />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardToolbar>
          <CardTitle>Payments</CardTitle>
          {canPay && (
            <Button size="sm" variant="outline" onClick={() => setPaymentDialogOpen(true)}>
              <Plus className="h-3.5 w-3.5" />
              Record payment
            </Button>
          )}
        </CardToolbar>
        {invoice.payments.length === 0 ? (
          <EmptyState compact title="No payments recorded yet" />
        ) : (
          <ul className="divide-y border-t">
            {invoice.payments.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                <span className="font-mono text-xs text-muted-foreground">{p.paymentNumber}</span>
                <span>₹{p.amount}</span>
                <Badge variant="outline">{formatEnumLabel(p.paymentMode)}</Badge>
                <span className="text-xs text-muted-foreground">{new Date(p.paidAt).toLocaleString('en-IN')}</span>
                <Button variant="ghost" size="sm" onClick={() => void downloadReceiptPdf(p.id, p.paymentNumber)}>
                  <Download className="h-3.5 w-3.5" />
                  Receipt
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardToolbar>
          <CardTitle>Refunds</CardTitle>
          {canRefund && (
            <Button size="sm" variant="outline" onClick={() => setRefundDialogOpen(true)}>
              <Plus className="h-3.5 w-3.5" />
              Request refund
            </Button>
          )}
        </CardToolbar>
        {invoice.refunds.length === 0 ? (
          <EmptyState compact title="No refunds recorded yet" />
        ) : (
          <ul className="divide-y border-t">
            {invoice.refunds.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                <span className="font-mono text-xs text-muted-foreground">{r.refundNumber}</span>
                <span>₹{r.amount}</span>
                <span className="text-xs text-muted-foreground">{r.reason}</span>
                <StatusBadge status={r.status} />
                {canManage && r.status === RefundStatus.PENDING && (
                  <div className="ml-auto flex gap-2">
                    <Button size="sm" onClick={() => approveRefundMutation.mutate(r.id)} disabled={approveRefundMutation.isPending}>
                      Approve
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => rejectRefundMutation.mutate(r.id)} disabled={rejectRefundMutation.isPending}>
                      Reject
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <RecordPaymentDialog
        open={paymentDialogOpen}
        onOpenChange={setPaymentDialogOpen}
        invoiceId={invoice.id}
        balanceDue={invoice.balanceDue}
        onRecorded={invalidate}
      />
      <RequestRefundDialog
        open={refundDialogOpen}
        onOpenChange={setRefundDialogOpen}
        invoiceId={invoice.id}
        onRequested={invalidate}
      />
      <ApplyDiscountDialog
        open={discountDialogOpen}
        onOpenChange={setDiscountDialogOpen}
        invoiceId={invoice.id}
        onApplied={invalidate}
      />

      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel invoice</DialogTitle>
            <DialogDescription>This releases any swept charges back to pending for re-billing.</DialogDescription>
          </DialogHeader>
          <Textarea placeholder="Reason" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>
              Back
            </Button>
            <Button variant="destructive" onClick={() => cancelMutation.mutate()} disabled={!cancelReason.trim() || cancelMutation.isPending}>
              {cancelMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Cancel invoice
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

function RecordPaymentDialog({
  open,
  onOpenChange,
  invoiceId,
  balanceDue,
  onRecorded,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  invoiceId: string
  balanceDue: string
  onRecorded: () => void
}) {
  const { toast } = useToast()
  const [amount, setAmount] = useState(balanceDue)
  const [mode, setMode] = useState<PaymentMode>(PaymentMode.CASH)
  const [reference, setReference] = useState('')

  const mutation = useMutation({
    mutationFn: () =>
      recordPayment(invoiceId, { amount: Number(amount), paymentMode: mode, referenceNumber: reference || undefined }),
    onSuccess: () => {
      toast({ title: 'Payment recorded' })
      onOpenChange(false)
      onRecorded()
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Could not record payment', description: getErrorMessage(error) }),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record payment</DialogTitle>
          <DialogDescription>Outstanding balance: ₹{balanceDue}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Input type="number" placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <Select value={mode} onValueChange={(v) => setMode(v as PaymentMode)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.values(PaymentMode)
                .filter((m) => m !== PaymentMode.INSURANCE)
                .map((m) => (
                  <SelectItem key={m} value={m}>
                    {formatEnumLabel(m)}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <Input placeholder="Reference / transaction no. (optional)" value={reference} onChange={(e) => setReference(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={!amount || Number(amount) <= 0 || mutation.isPending}>
            {mutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Record
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function RequestRefundDialog({
  open,
  onOpenChange,
  invoiceId,
  onRequested,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  invoiceId: string
  onRequested: () => void
}) {
  const { toast } = useToast()
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')

  const mutation = useMutation({
    mutationFn: () => requestRefund(invoiceId, { amount: Number(amount), reason }),
    onSuccess: (refund) => {
      toast({ title: refund.status === RefundStatus.COMPLETED ? 'Refund completed' : 'Refund requested - pending approval' })
      setAmount('')
      setReason('')
      onOpenChange(false)
      onRequested()
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Could not request refund', description: getErrorMessage(error) }),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request refund</DialogTitle>
          <DialogDescription>Partial or full - an admin approval may be required.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Input type="number" placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <Textarea placeholder="Reason" value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={!amount || Number(amount) <= 0 || !reason.trim() || mutation.isPending}>
            {mutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ApplyDiscountDialog({
  open,
  onOpenChange,
  invoiceId,
  onApplied,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  invoiceId: string
  onApplied: () => void
}) {
  const { toast } = useToast()
  const [type, setType] = useState<DiscountType>(DiscountType.PERCENTAGE)
  const [value, setValue] = useState('')
  const [reason, setReason] = useState('')

  const mutation = useMutation({
    mutationFn: () => applyInvoiceDiscount(invoiceId, { discountType: type, discountValue: Number(value), reason }),
    onSuccess: (updated) => {
      toast({
        title:
          updated.discountApprovalStatus === DiscountApprovalStatus.APPROVED
            ? 'Discount applied'
            : 'Discount requested - pending approval',
      })
      setValue('')
      setReason('')
      onOpenChange(false)
      onApplied()
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Could not apply discount', description: getErrorMessage(error) }),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Apply discount</DialogTitle>
          <DialogDescription>Requires approval unless you hold billing management permission.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Select value={type} onValueChange={(v) => setType(v as DiscountType)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={DiscountType.PERCENTAGE}>Percentage</SelectItem>
              <SelectItem value={DiscountType.FLAT}>Flat amount</SelectItem>
            </SelectContent>
          </Select>
          <Input
            type="number"
            placeholder={type === DiscountType.PERCENTAGE ? 'Discount %' : 'Discount ₹'}
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <Textarea placeholder="Reason" value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={!value || Number(value) <= 0 || !reason.trim() || mutation.isPending}>
            {mutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
