'use client'

import { AssetStatus, InventoryItemType } from '@medicore/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Plus } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

import { PageLayout } from '@/components/layout/page-layout'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Pagination } from '@/components/ui/pagination'
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
import { listInventoryItems, listInventoryStores } from '@/lib/api/inventory'
import { createAsset, listAssets } from '@/lib/api/procurement'
import { useAuth } from '@/lib/auth/auth-context'

function getErrorMessage(error: unknown): string {
  const axiosError = error as { response?: { data?: { error?: { message?: string } } } }
  return axiosError?.response?.data?.error?.message ?? 'Something went wrong. Please try again.'
}

function formatEnumLabel(value: string): string {
  return value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, ' ')
}

export default function AssetsPage() {
  const { hasPermission } = useAuth()
  const canCreate = hasPermission('inventory.assets.create')

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<AssetStatus | 'ALL'>('ALL')
  const [page, setPage] = useState(1)
  const [createOpen, setCreateOpen] = useState(false)

  const query = useQuery({
    queryKey: ['inventory', 'assets', 'list', { search, status, page }],
    queryFn: () => listAssets({ search: search || undefined, status: status === 'ALL' ? undefined : status, page, limit: 20 }),
  })

  const assets = query.data?.data ?? []
  const pagination = query.data?.pagination

  return (
    <PageLayout
      title="Assets & Maintenance"
      description="Biomedical/equipment assets - assignment, calibration, and maintenance history."
      actions={
        canCreate && (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            Register asset
          </Button>
        )
      }
    >
      <div className="flex flex-wrap gap-2">
        <Input
          placeholder="Search by tag or serial number"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(1)
          }}
          className="max-w-xs"
        />
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v as AssetStatus | 'ALL')
            setPage(1)
          }}
        >
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            {Object.values(AssetStatus).map((s) => (
              <SelectItem key={s} value={s}>
                {formatEnumLabel(s)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {query.isLoading ? (
        <TableSkeleton rows={8} columns={6} />
      ) : assets.length === 0 ? (
        <EmptyState
          variant={search || status !== 'ALL' ? 'search' : 'empty'}
          title="No assets registered yet"
          action={canCreate ? { label: 'Register asset', onClick: () => setCreateOpen(true) } : undefined}
        />
      ) : (
        <TableContainer className="max-h-[65vh]">
          <Table density="compact" container={false}>
            <TableHeader>
              <TableRow>
                <TableHead>Asset tag</TableHead>
                <TableHead>Item</TableHead>
                <TableHead>Store</TableHead>
                <TableHead>Serial #</TableHead>
                <TableHead>Warranty expiry</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assets.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-mono text-xs">
                    <Link href={`/dashboard/inventory/assets/${a.id}`} className="text-primary hover:underline">
                      {a.assetTag}
                    </Link>
                  </TableCell>
                  <TableCell>{a.item.name}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{a.store.name}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{a.serialNumber ?? '-'}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {a.warrantyExpiryDate ? new Date(a.warrantyExpiryDate).toLocaleDateString('en-IN') : '-'}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={a.status} />
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

      <CreateAssetDialog open={createOpen} onOpenChange={setCreateOpen} />
    </PageLayout>
  )
}

function CreateAssetDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [itemId, setItemId] = useState('')
  const [storeId, setStoreId] = useState('')
  const [assetTag, setAssetTag] = useState('')
  const [serialNumber, setSerialNumber] = useState('')
  const [purchaseDate, setPurchaseDate] = useState('')
  const [purchasePrice, setPurchasePrice] = useState('')
  const [warrantyExpiryDate, setWarrantyExpiryDate] = useState('')

  const itemsQuery = useQuery({
    queryKey: ['inventory', 'items', 'asset-type'],
    queryFn: () => listInventoryItems({ isActive: true, itemType: InventoryItemType.ASSET, limit: 200, sortBy: 'name', sortOrder: 'asc' }),
  })
  const storesQuery = useQuery({ queryKey: ['inventory', 'stores', true], queryFn: () => listInventoryStores(true) })

  const mutation = useMutation({
    mutationFn: () =>
      createAsset({
        itemId,
        storeId,
        assetTag,
        serialNumber: serialNumber || undefined,
        purchaseDate: purchaseDate ? new Date(purchaseDate) : undefined,
        purchasePrice: purchasePrice ? Number(purchasePrice) : undefined,
        warrantyExpiryDate: warrantyExpiryDate ? new Date(warrantyExpiryDate) : undefined,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['inventory', 'assets'] })
      void queryClient.invalidateQueries({ queryKey: ['inventory', 'dashboard-stats'] })
      toast({ title: 'Asset registered' })
      onOpenChange(false)
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Could not register asset', description: getErrorMessage(error) }),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Register asset</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Select value={itemId} onValueChange={setItemId}>
            <SelectTrigger>
              <SelectValue placeholder="Item (from the Asset-type catalog)" />
            </SelectTrigger>
            <SelectContent>
              {(itemsQuery.data?.data ?? []).map((i) => (
                <SelectItem key={i.id} value={i.id}>
                  {i.name} ({i.code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={storeId} onValueChange={setStoreId}>
            <SelectTrigger>
              <SelectValue placeholder="Store" />
            </SelectTrigger>
            <SelectContent>
              {(storesQuery.data ?? []).map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="Asset tag" value={assetTag} onChange={(e) => setAssetTag(e.target.value)} />
            <Input placeholder="Serial number (optional)" value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Input type="date" placeholder="Purchase date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
            <Input type="number" placeholder="Purchase price (₹)" value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} />
            <Input type="date" placeholder="Warranty expiry" value={warrantyExpiryDate} onChange={(e) => setWarrantyExpiryDate(e.target.value)} />
          </div>
          {itemsQuery.data?.data.length === 0 && (
            <p className="text-xs text-muted-foreground">
              No Asset-type items in the catalog yet - add one on the Item Master page with type &quot;Asset&quot; first.
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={!itemId || !storeId || !assetTag.trim() || mutation.isPending}>
            {mutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Register
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
