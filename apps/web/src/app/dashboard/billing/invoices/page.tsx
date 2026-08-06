'use client'

import { InvoiceStatus } from '@medicore/types'
import type { Patient } from '@medicore/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Plus, ReceiptText, Search, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { PageLayout } from '@/components/layout/page-layout'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
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
} from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'
import { createInvoice, listCharges, listInvoices } from '@/lib/api/billing'
import { listPatients } from '@/lib/api/patients'
import { useAuth } from '@/lib/auth/auth-context'

function getErrorMessage(error: unknown): string {
  const axiosError = error as { response?: { data?: { error?: { message?: string } } } }
  return axiosError?.response?.data?.error?.message ?? 'Something went wrong. Please try again.'
}

function formatEnumLabel(value: string): string {
  return value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, ' ')
}

export default function InvoicesListPage() {
  const { hasPermission } = useAuth()
  const [status, setStatus] = useState<string>('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const queryClient = useQueryClient()

  const canCreate = hasPermission('billing.create')

  const invoicesQuery = useQuery({
    queryKey: ['billing', 'invoices', 'list', { status }],
    queryFn: () =>
      listInvoices({
        status: status === 'all' ? undefined : (status as InvoiceStatus),
        limit: 100,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      }),
  })

  const invoices = invoicesQuery.data?.data ?? []

  return (
    <PageLayout
      title="Invoices"
      description={
        invoicesQuery.data
          ? `${invoicesQuery.data.pagination.total} invoice${invoicesQuery.data.pagination.total === 1 ? '' : 's'}`
          : undefined
      }
      actions={
        canCreate && (
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            New invoice
          </Button>
        )
      }
    >
      <Select value={status} onValueChange={setStatus}>
        <SelectTrigger className="w-48">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          {Object.values(InvoiceStatus).map((s) => (
            <SelectItem key={s} value={s}>
              {formatEnumLabel(s)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {invoicesQuery.isLoading ? (
        <TableSkeleton rows={8} columns={6} />
      ) : invoicesQuery.isError ? (
        <EmptyState variant="error" title="Couldn't load invoices" description={getErrorMessage(invoicesQuery.error)} />
      ) : invoices.length === 0 ? (
        <EmptyState variant="search" title="No invoices found" description="Try a different status filter." />
      ) : (
        <TableContainer className="max-h-[65vh]">
          <Table density="compact" container={false}>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Patient</TableHead>
                <TableHead>Status</TableHead>
                <TableHead align="right">Total</TableHead>
                <TableHead align="right">Balance due</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell>
                    <Link
                      href={`/dashboard/billing/invoices/${invoice.id}`}
                      className="flex items-center gap-1.5 font-mono text-xs hover:underline"
                    >
                      <ReceiptText className="h-3.5 w-3.5 text-muted-foreground" />
                      {invoice.invoiceNumber}
                    </Link>
                  </TableCell>
                  <TableCell>{invoice.patient.fullName}</TableCell>
                  <TableCell>
                    <StatusBadge status={invoice.status} />
                  </TableCell>
                  <TableCell align="right">₹{invoice.totalAmount}</TableCell>
                  <TableCell align="right">₹{invoice.balanceDue}</TableCell>
                  <TableCell>
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/dashboard/billing/invoices/${invoice.id}`}>Open</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <NewInvoiceDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={() => void queryClient.invalidateQueries({ queryKey: ['billing', 'invoices', 'list'] })}
      />
    </PageLayout>
  )
}

interface LineItemRow {
  itemName: string
  category: string
  quantity: string
  unitPrice: string
  discountPercent: string
  taxPercent: string
}

function emptyRow(): LineItemRow {
  return { itemName: '', category: 'Miscellaneous', quantity: '1', unitPrice: '', discountPercent: '0', taxPercent: '0' }
}

function NewInvoiceDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => void
}) {
  const { toast } = useToast()
  const router = useRouter()
  const [patient, setPatient] = useState<Patient | null>(null)
  const [selectedChargeIds, setSelectedChargeIds] = useState<string[]>([])
  const [rows, setRows] = useState<LineItemRow[]>([emptyRow()])

  const chargesQuery = useQuery({
    queryKey: ['billing', 'charges', 'pending-for-invoice', patient?.id],
    queryFn: () => listCharges({ patientId: patient!.id, status: 'PENDING' as never, limit: 50 }),
    enabled: !!patient,
  })

  function reset() {
    setPatient(null)
    setSelectedChargeIds([])
    setRows([emptyRow()])
  }

  const createMutation = useMutation({
    mutationFn: () => {
      const items = rows
        .filter((r) => r.itemName.trim() && r.unitPrice)
        .map((r) => ({
          itemName: r.itemName,
          category: r.category,
          quantity: Number(r.quantity) || 1,
          unitPrice: Number(r.unitPrice) || 0,
          discountPercent: Number(r.discountPercent) || 0,
          taxPercent: Number(r.taxPercent) || 0,
        }))
      return createInvoice({ patientId: patient!.id, type: 'OPD' as never, items, chargeIds: selectedChargeIds })
    },
    onSuccess: (invoice) => {
      toast({ title: 'Invoice created' })
      reset()
      onOpenChange(false)
      onCreated()
      router.push(`/dashboard/billing/invoices/${invoice.id}`)
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Could not create invoice', description: getErrorMessage(error) }),
  })

  const hasAnyLineItem = rows.some((r) => r.itemName.trim() && r.unitPrice) || selectedChargeIds.length > 0

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset()
        onOpenChange(next)
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>New invoice</DialogTitle>
          <DialogDescription>Pick a patient, then add manual line items and/or sweep their pending charges.</DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-4 overflow-y-auto">
          <PatientPicker selected={patient} onSelect={setPatient} />

          {patient && (
            <>
              {chargesQuery.data && chargesQuery.data.data.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-sm font-medium">Pending charges</p>
                  <div className="max-h-32 space-y-1 overflow-y-auto rounded-md border p-2">
                    {chargesQuery.data.data.map((charge) => (
                      <label key={charge.id} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={selectedChargeIds.includes(charge.id)}
                          onChange={(e) =>
                            setSelectedChargeIds((prev) =>
                              e.target.checked ? [...prev, charge.id] : prev.filter((id) => id !== charge.id),
                            )
                          }
                        />
                        <span>
                          {charge.description} — ₹{charge.totalAmount}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <p className="text-sm font-medium">Line items</p>
                <div className="space-y-2">
                  {rows.map((row, i) => (
                    <div key={i} className="grid grid-cols-12 gap-1.5">
                      <Input
                        className="col-span-4"
                        placeholder="Item name"
                        value={row.itemName}
                        onChange={(e) => setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, itemName: e.target.value } : r)))}
                      />
                      <Input
                        className="col-span-2"
                        placeholder="Category"
                        value={row.category}
                        onChange={(e) => setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, category: e.target.value } : r)))}
                      />
                      <Input
                        className="col-span-1"
                        placeholder="Qty"
                        type="number"
                        value={row.quantity}
                        onChange={(e) => setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, quantity: e.target.value } : r)))}
                      />
                      <Input
                        className="col-span-2"
                        placeholder="Price"
                        type="number"
                        value={row.unitPrice}
                        onChange={(e) => setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, unitPrice: e.target.value } : r)))}
                      />
                      <Input
                        className="col-span-1"
                        placeholder="Disc%"
                        type="number"
                        value={row.discountPercent}
                        onChange={(e) => setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, discountPercent: e.target.value } : r)))}
                      />
                      <Input
                        className="col-span-1"
                        placeholder="Tax%"
                        type="number"
                        value={row.taxPercent}
                        onChange={(e) => setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, taxPercent: e.target.value } : r)))}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="col-span-1"
                        onClick={() => setRows((prev) => prev.filter((_, idx) => idx !== i))}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
                <Button variant="outline" size="sm" onClick={() => setRows((prev) => [...prev, emptyRow()])}>
                  <Plus className="h-3.5 w-3.5" />
                  Add line item
                </Button>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => createMutation.mutate()} disabled={!patient || !hasAnyLineItem || createMutation.isPending}>
            {createMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function PatientPicker({ selected, onSelect }: { selected: Patient | null; onSelect: (patient: Patient | null) => void }) {
  const [query, setQuery] = useState('')

  const searchQuery = useQuery({
    queryKey: ['patients', 'search', query],
    queryFn: () => listPatients({ q: query, limit: 8 }),
    enabled: query.trim().length >= 2,
  })

  if (selected) {
    return (
      <div className="flex items-center justify-between rounded-md border p-2">
        <div>
          <p className="text-sm font-medium">{selected.fullName}</p>
          <p className="font-mono text-xs text-muted-foreground">
            {selected.uhid} · {selected.phone}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => onSelect(null)}>
          Change
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input className="pl-8" placeholder="Search by name, phone, or UHID..." value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      {query.trim().length >= 2 && (
        <div className="max-h-40 overflow-y-auto rounded-md border">
          {searchQuery.isLoading ? (
            <p className="p-2 text-xs text-muted-foreground">Searching...</p>
          ) : searchQuery.data?.data.length ? (
            searchQuery.data.data.map((p) => (
              <button
                type="button"
                key={p.id}
                onClick={() => onSelect(p)}
                className="flex w-full flex-col items-start p-2 text-left text-sm hover:bg-muted"
              >
                <span className="font-medium">{p.fullName}</span>
                <span className="font-mono text-xs text-muted-foreground">
                  {p.uhid} · {p.phone}
                </span>
              </button>
            ))
          ) : (
            <p className="p-2 text-xs text-muted-foreground">No patients found.</p>
          )}
        </div>
      )}
    </div>
  )
}
