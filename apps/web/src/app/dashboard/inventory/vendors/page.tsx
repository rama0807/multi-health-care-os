'use client'

import type { Vendor, VendorWithStats } from '@medicore/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Plus, Star } from 'lucide-react'
import { useState } from 'react'

import { PageLayout } from '@/components/layout/page-layout'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Pagination } from '@/components/ui/pagination'
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
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { createVendor, listVendors, rateVendor, updateVendor } from '@/lib/api/inventory'
import { useAuth } from '@/lib/auth/auth-context'

function getErrorMessage(error: unknown): string {
  const axiosError = error as { response?: { data?: { error?: { message?: string } } } }
  return axiosError?.response?.data?.error?.message ?? 'Something went wrong. Please try again.'
}

export default function VendorsPage() {
  const { hasPermission } = useAuth()
  const canCreate = hasPermission('inventory.vendors.create')
  const canUpdate = hasPermission('inventory.vendors.update')

  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<VendorWithStats | null>(null)
  const [rating, setRating] = useState<VendorWithStats | null>(null)

  const vendorsQuery = useQuery({
    queryKey: ['inventory', 'vendors', 'list', { search, page }],
    queryFn: () => listVendors({ search: search || undefined, page, limit: 20, sortBy: 'name', sortOrder: 'asc' }),
  })

  const vendors = vendorsQuery.data?.data ?? []
  const pagination = vendorsQuery.data?.pagination

  return (
    <PageLayout
      title="Vendors"
      description="Suppliers — contact details, GST/PAN, payment terms, ratings."
      actions={
        canCreate && (
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            Add vendor
          </Button>
        )
      }
    >
      <Input
        placeholder="Search by name, code, or GSTIN"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value)
          setPage(1)
        }}
        className="max-w-xs"
      />

      {vendorsQuery.isLoading ? (
        <TableSkeleton rows={8} columns={8} />
      ) : vendors.length === 0 ? (
        <EmptyState
          variant={search ? 'search' : 'empty'}
          title="No vendors yet"
          action={canCreate ? { label: 'Add vendor', onClick: () => setDialogOpen(true) } : undefined}
        />
      ) : (
        <TableContainer className="max-h-[65vh]">
          <Table density="compact" container={false}>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Payment terms</TableHead>
                <TableHead>Rating</TableHead>
                <TableHead align="right">Outstanding</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-32" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {vendors.map((v) => (
                <TableRow key={v.id}>
                  <TableCell className="font-medium">{v.name}</TableCell>
                  <TableCell className="font-mono text-xs">{v.code}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{v.phone ?? v.email ?? '—'}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{v.paymentTermsDays} days</TableCell>
                  <TableCell>
                    {v.averageRating ? (
                      <span className="flex items-center gap-1 text-xs">
                        <Star className="h-3.5 w-3.5 fill-warning text-warning" />
                        {v.averageRating.toFixed(1)} ({v.totalRatings})
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">No ratings</span>
                    )}
                  </TableCell>
                  <TableCell align="right" className="text-xs">₹{Number(v.outstandingBalance).toLocaleString('en-IN')}</TableCell>
                  <TableCell>
                    <StatusBadge status={v.isActive ? 'ACTIVE' : 'INACTIVE'} />
                  </TableCell>
                  <TableCell className="flex gap-1">
                    {canUpdate && (
                      <>
                        <Button variant="ghost" size="sm" onClick={() => setEditing(v)}>
                          Edit
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setRating(v)}>
                          Rate
                        </Button>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {pagination && pagination.totalPages > 1 && (
        <Pagination page={pagination.page} totalPages={pagination.totalPages} onPageChange={setPage} />
      )}

      <VendorDialog open={dialogOpen} onOpenChange={setDialogOpen} />
      {editing && <VendorDialog open onOpenChange={(open) => !open && setEditing(null)} vendor={editing} />}
      {rating && <RateVendorDialog vendor={rating} onOpenChange={(open) => !open && setRating(null)} />}
    </PageLayout>
  )
}

function VendorDialog({
  open,
  onOpenChange,
  vendor,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  vendor?: Vendor
}) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const isEdit = Boolean(vendor)

  const [name, setName] = useState(vendor?.name ?? '')
  const [code, setCode] = useState(vendor?.code ?? '')
  const [contactPerson, setContactPerson] = useState(vendor?.contactPerson ?? '')
  const [phone, setPhone] = useState(vendor?.phone ?? '')
  const [email, setEmail] = useState(vendor?.email ?? '')
  const [gstin, setGstin] = useState(vendor?.gstin ?? '')
  const [pan, setPan] = useState(vendor?.pan ?? '')
  const [paymentTermsDays, setPaymentTermsDays] = useState(String(vendor?.paymentTermsDays ?? 30))

  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        name,
        code,
        contactPerson: contactPerson || undefined,
        phone: phone || undefined,
        email: email || undefined,
        gstin: gstin || undefined,
        pan: pan || undefined,
        paymentTermsDays: Number(paymentTermsDays),
      }
      return isEdit ? updateVendor(vendor!.id, payload) : createVendor(payload)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['inventory', 'vendors'] })
      toast({ title: isEdit ? 'Vendor updated' : 'Vendor added' })
      onOpenChange(false)
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Could not save vendor', description: getErrorMessage(error) }),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit vendor' : 'Add vendor'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
            <Input placeholder="Code" value={code} onChange={(e) => setCode(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="Contact person" value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} />
            <Input placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <Input placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <div className="grid grid-cols-3 gap-2">
            <Input placeholder="GSTIN" value={gstin} onChange={(e) => setGstin(e.target.value)} />
            <Input placeholder="PAN" value={pan} onChange={(e) => setPan(e.target.value)} />
            <Input
              placeholder="Payment terms (days)"
              type="number"
              value={paymentTermsDays}
              onChange={(e) => setPaymentTermsDays(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={!name.trim() || !code.trim() || mutation.isPending}>
            {mutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {isEdit ? 'Save' : 'Add'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function RateVendorDialog({ vendor, onOpenChange }: { vendor: VendorWithStats; onOpenChange: (open: boolean) => void }) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [rating, setRating] = useState(5)
  const [comments, setComments] = useState('')

  const mutation = useMutation({
    mutationFn: () => rateVendor(vendor.id, { rating, comments: comments || undefined }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['inventory', 'vendors'] })
      toast({ title: 'Rating recorded' })
      onOpenChange(false)
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Could not record rating', description: getErrorMessage(error) }),
  })

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rate — {vendor.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" onClick={() => setRating(n)}>
                <Star className={`h-6 w-6 ${n <= rating ? 'fill-warning text-warning' : 'text-muted-foreground'}`} />
              </button>
            ))}
          </div>
          <Textarea placeholder="Comments (optional)" value={comments} onChange={(e) => setComments(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Submit rating
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
