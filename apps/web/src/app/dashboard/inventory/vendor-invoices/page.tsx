'use client'

import { VendorInvoiceStatus } from '@medicore/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Plus } from 'lucide-react'
import { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Pagination } from '@/components/ui/pagination'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { listVendors } from '@/lib/api/inventory'
import {
  createVendorInvoice,
  listVendorInvoices,
  recordVendorInvoicePayment,
  updateVendorInvoiceStatus,
} from '@/lib/api/procurement'
import { useAuth } from '@/lib/auth/auth-context'

function getErrorMessage(error: unknown): string {
  const axiosError = error as { response?: { data?: { error?: { message?: string } } } }
  return axiosError?.response?.data?.error?.message ?? 'Something went wrong. Please try again.'
}

function formatEnumLabel(value: string): string {
  return value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, ' ')
}

const STATUS_BADGE: Record<VendorInvoiceStatus, 'secondary' | 'outline' | 'success' | 'destructive'> = {
  [VendorInvoiceStatus.PENDING]: 'secondary',
  [VendorInvoiceStatus.VERIFIED]: 'outline',
  [VendorInvoiceStatus.PAID]: 'success',
  [VendorInvoiceStatus.DISPUTED]: 'destructive',
  [VendorInvoiceStatus.CANCELLED]: 'destructive',
}

export default function VendorInvoicesPage() {
  const { hasPermission } = useAuth()
  const canManage = hasPermission('inventory.procurement.manage')

  const [status, setStatus] = useState<VendorInvoiceStatus | 'ALL'>('ALL')
  const [page, setPage] = useState(1)
  const [createOpen, setCreateOpen] = useState(false)
  const [payingId, setPayingId] = useState<string | null>(null)

  const query = useQuery({
    queryKey: ['inventory', 'vendor-invoices', 'list', { status, page }],
    queryFn: () => listVendorInvoices({ status: status === 'ALL' ? undefined : status, page, limit: 20 }),
  })
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const statusMutation = useMutation({
    mutationFn: ({ id, next }: { id: string; next: VendorInvoiceStatus }) => updateVendorInvoiceStatus(id, { status: next }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['inventory', 'vendor-invoices'] })
      toast({ title: 'Status updated' })
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Could not update status', description: getErrorMessage(error) }),
  })

  const invoices = query.data?.data ?? []
  const pagination = query.data?.pagination

  return (
    <div className="space-y-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Vendor Invoices</h1>
          <p className="text-sm text-muted-foreground">The final step of the procurement chain — billed against a PO/GRN, recorded payments.</p>
        </div>
        {canManage && (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            New invoice
          </Button>
        )}
      </div>

      <Select
        value={status}
        onValueChange={(v) => {
          setStatus(v as VendorInvoiceStatus | 'ALL')
          setPage(1)
        }}
      >
        <SelectTrigger className="w-48">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">All statuses</SelectItem>
          {Object.values(VendorInvoiceStatus).map((s) => (
            <SelectItem key={s} value={s}>
              {formatEnumLabel(s)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice #</TableHead>
              <TableHead>Vendor</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Paid</TableHead>
              <TableHead>Balance</TableHead>
              <TableHead>Status</TableHead>
              {canManage && <TableHead>Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {query.isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                </TableCell>
              </TableRow>
            ) : invoices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  No vendor invoices yet.
                </TableCell>
              </TableRow>
            ) : (
              invoices.map((inv) => {
                const balance = Number(inv.totalAmount) - Number(inv.paidAmount)
                const canPay = inv.status !== VendorInvoiceStatus.PAID && inv.status !== VendorInvoiceStatus.CANCELLED
                return (
                  <TableRow key={inv.id}>
                    <TableCell className="font-mono text-xs">{inv.invoiceNumber}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{inv.vendor.name}</TableCell>
                    <TableCell className="text-xs">₹{Number(inv.totalAmount).toLocaleString('en-IN')}</TableCell>
                    <TableCell className="text-xs">₹{Number(inv.paidAmount).toLocaleString('en-IN')}</TableCell>
                    <TableCell className="text-xs">₹{balance.toLocaleString('en-IN')}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_BADGE[inv.status]}>{formatEnumLabel(inv.status)}</Badge>
                    </TableCell>
                    {canManage && (
                      <TableCell className="flex flex-wrap gap-1">
                        {canPay && (
                          <Button variant="ghost" size="sm" onClick={() => setPayingId(inv.id)}>
                            Pay
                          </Button>
                        )}
                        {inv.status === VendorInvoiceStatus.PENDING && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => statusMutation.mutate({ id: inv.id, next: VendorInvoiceStatus.VERIFIED })}
                          >
                            Verify
                          </Button>
                        )}
                        {canPay && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => statusMutation.mutate({ id: inv.id, next: VendorInvoiceStatus.DISPUTED })}
                          >
                            Dispute
                          </Button>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {pagination && pagination.totalPages > 1 && (
        <Pagination page={pagination.page} totalPages={pagination.totalPages} onPageChange={setPage} />
      )}

      <CreateInvoiceDialog open={createOpen} onOpenChange={setCreateOpen} />
      {payingId && <PayInvoiceDialog invoiceId={payingId} onOpenChange={(open) => !open && setPayingId(null)} />}
    </div>
  )
}

function CreateInvoiceDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [vendorId, setVendorId] = useState('')
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [invoiceDate, setInvoiceDate] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [amount, setAmount] = useState('')
  const [taxAmount, setTaxAmount] = useState('0')
  const [notes, setNotes] = useState('')

  const vendorsQuery = useQuery({ queryKey: ['inventory', 'vendors', 'active-for-invoice'], queryFn: () => listVendors({ isActive: true, limit: 100 }) })

  const mutation = useMutation({
    mutationFn: () =>
      createVendorInvoice({
        vendorId,
        invoiceNumber,
        invoiceDate: new Date(invoiceDate),
        dueDate: dueDate ? new Date(dueDate) : undefined,
        amount: Number(amount),
        taxAmount: Number(taxAmount || 0),
        notes: notes || undefined,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['inventory', 'vendor-invoices'] })
      toast({ title: 'Vendor invoice recorded' })
      onOpenChange(false)
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Could not record invoice', description: getErrorMessage(error) }),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New vendor invoice</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Select value={vendorId} onValueChange={setVendorId}>
            <SelectTrigger>
              <SelectValue placeholder="Vendor" />
            </SelectTrigger>
            <SelectContent>
              {(vendorsQuery.data?.data ?? []).map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {v.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input placeholder="Vendor's invoice number" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />
          <div className="grid grid-cols-2 gap-2">
            <Input type="date" placeholder="Invoice date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
            <Input type="date" placeholder="Due date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Input type="number" placeholder="Amount (₹)" value={amount} onChange={(e) => setAmount(e.target.value)} />
            <Input type="number" placeholder="Tax amount (₹)" value={taxAmount} onChange={(e) => setTaxAmount(e.target.value)} />
          </div>
          <Textarea placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={!vendorId || !invoiceNumber.trim() || !invoiceDate || !amount || mutation.isPending}
          >
            {mutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function PayInvoiceDialog({ invoiceId, onOpenChange }: { invoiceId: string; onOpenChange: (open: boolean) => void }) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [amount, setAmount] = useState('')

  const mutation = useMutation({
    mutationFn: () => recordVendorInvoicePayment(invoiceId, { amount: Number(amount) }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['inventory', 'vendor-invoices'] })
      toast({ title: 'Payment recorded' })
      onOpenChange(false)
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Could not record payment', description: getErrorMessage(error) }),
  })

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record payment</DialogTitle>
        </DialogHeader>
        <Input type="number" placeholder="Amount (₹)" value={amount} onChange={(e) => setAmount(e.target.value)} />
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
