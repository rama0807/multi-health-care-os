'use client'

import { InventoryItemType, type InventoryItemWithRefs } from '@medicore/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Plus } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

import { PageLayout } from '@/components/layout/page-layout'
import { Badge } from '@/components/ui/badge'
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
import {
  createInventoryItem,
  listInventoryBrands,
  listInventoryCategories,
  listInventoryItemGroups,
  listInventoryItems,
  listInventoryManufacturers,
  listInventoryUnits,
  updateInventoryItem,
} from '@/lib/api/inventory'
import { useAuth } from '@/lib/auth/auth-context'

function getErrorMessage(error: unknown): string {
  const axiosError = error as { response?: { data?: { error?: { message?: string } } } }
  return axiosError?.response?.data?.error?.message ?? 'Something went wrong. Please try again.'
}

function formatEnumLabel(value: string): string {
  return value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, ' ')
}

const NO_SELECTION = '__none__'

export default function InventoryItemsPage() {
  const { hasPermission } = useAuth()
  const canCreate = hasPermission('inventory.items.create')
  const canUpdate = hasPermission('inventory.items.update')

  const [search, setSearch] = useState('')
  const [itemType, setItemType] = useState<InventoryItemType | 'ALL'>('ALL')
  const [page, setPage] = useState(1)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<InventoryItemWithRefs | null>(null)

  const itemsQuery = useQuery({
    queryKey: ['inventory', 'items', 'list', { search, itemType, page }],
    queryFn: () =>
      listInventoryItems({
        search: search || undefined,
        itemType: itemType === 'ALL' ? undefined : itemType,
        page,
        limit: 20,
        sortBy: 'name',
        sortOrder: 'asc',
      }),
  })

  const items = itemsQuery.data?.data ?? []
  const pagination = itemsQuery.data?.pagination

  return (
    <PageLayout
      title="Item Master"
      description="Non-drug inventory catalog - equipment, consumables, and supplies."
      actions={
        <>
          <Button asChild variant="outline">
            <Link href="/dashboard/inventory/lookups">Categories & lookups</Link>
          </Button>
          {canCreate && (
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4" />
              Add item
            </Button>
          )}
        </>
      }
    >
      <div className="flex flex-wrap gap-2">
        <Input
          placeholder="Search by name, code, or barcode"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(1)
          }}
          className="max-w-xs"
        />
        <Select
          value={itemType}
          onValueChange={(v) => {
            setItemType(v as InventoryItemType | 'ALL')
            setPage(1)
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All types</SelectItem>
            {Object.values(InventoryItemType).map((t) => (
              <SelectItem key={t} value={t}>
                {formatEnumLabel(t)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {itemsQuery.isLoading ? (
        <TableSkeleton rows={8} columns={canUpdate ? 8 : 7} />
      ) : items.length === 0 ? (
        <EmptyState
          variant={search || itemType !== 'ALL' ? 'search' : 'empty'}
          title="No items yet"
          action={canCreate ? { label: 'Add item', onClick: () => setDialogOpen(true) } : undefined}
        />
      ) : (
        <TableContainer className="max-h-[65vh]">
          <Table density="compact" container={false}>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead align="right">Unit cost</TableHead>
                <TableHead>Status</TableHead>
                {canUpdate && <TableHead className="w-20" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell className="font-mono text-xs">{item.code}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{formatEnumLabel(item.itemType)}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{item.category?.name ?? '-'}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{item.unit?.symbol ?? '-'}</TableCell>
                  <TableCell align="right" className="text-xs">₹{item.unitCost}</TableCell>
                  <TableCell>
                    <StatusBadge status={item.isActive ? 'ACTIVE' : 'INACTIVE'} />
                  </TableCell>
                  {canUpdate && (
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => setEditing(item)}>
                        Edit
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {pagination && pagination.totalPages > 1 && (
        <Pagination page={pagination.page} totalPages={pagination.totalPages} onPageChange={setPage} />
      )}

      <ItemDialog open={dialogOpen} onOpenChange={setDialogOpen} />
      {editing && <ItemDialog open onOpenChange={(open) => !open && setEditing(null)} item={editing} />}
    </PageLayout>
  )
}

function ItemDialog({
  open,
  onOpenChange,
  item,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  item?: InventoryItemWithRefs
}) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const isEdit = Boolean(item)

  const [name, setName] = useState(item?.name ?? '')
  const [code, setCode] = useState(item?.code ?? '')
  const [itemType, setItemType] = useState<InventoryItemType>(item?.itemType ?? InventoryItemType.CONSUMABLE)
  const [categoryId, setCategoryId] = useState(item?.categoryId ?? NO_SELECTION)
  const [itemGroupId, setItemGroupId] = useState(item?.itemGroupId ?? NO_SELECTION)
  const [unitId, setUnitId] = useState(item?.unitId ?? NO_SELECTION)
  const [manufacturerId, setManufacturerId] = useState(item?.manufacturerId ?? NO_SELECTION)
  const [brandId, setBrandId] = useState(item?.brandId ?? NO_SELECTION)
  const [unitCost, setUnitCost] = useState(item?.unitCost ?? '0')
  const [gstPercent, setGstPercent] = useState(item?.gstPercent ?? '0')
  const [trackBatch, setTrackBatch] = useState(item?.trackBatch ?? false)
  const [trackExpiry, setTrackExpiry] = useState(item?.trackExpiry ?? false)

  const categoriesQuery = useQuery({ queryKey: ['inventory', 'categories', true], queryFn: () => listInventoryCategories(true) })
  const itemGroupsQuery = useQuery({ queryKey: ['inventory', 'item-groups', true], queryFn: () => listInventoryItemGroups(true) })
  const unitsQuery = useQuery({ queryKey: ['inventory', 'units', true], queryFn: () => listInventoryUnits(true) })
  const manufacturersQuery = useQuery({
    queryKey: ['inventory', 'manufacturers', true],
    queryFn: () => listInventoryManufacturers(true),
  })
  const brandsQuery = useQuery({ queryKey: ['inventory', 'brands', true], queryFn: () => listInventoryBrands(true) })

  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        name,
        code,
        itemType,
        categoryId: categoryId === NO_SELECTION ? undefined : categoryId,
        itemGroupId: itemGroupId === NO_SELECTION ? undefined : itemGroupId,
        unitId: unitId === NO_SELECTION ? undefined : unitId,
        manufacturerId: manufacturerId === NO_SELECTION ? undefined : manufacturerId,
        brandId: brandId === NO_SELECTION ? undefined : brandId,
        unitCost: Number(unitCost),
        gstPercent: Number(gstPercent),
        trackBatch,
        trackSerial: false,
        trackExpiry,
      }
      return isEdit ? updateInventoryItem(item!.id, payload) : createInventoryItem(payload)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['inventory', 'items'] })
      void queryClient.invalidateQueries({ queryKey: ['inventory', 'dashboard-stats'] })
      toast({ title: isEdit ? 'Item updated' : 'Item added' })
      onOpenChange(false)
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Could not save item', description: getErrorMessage(error) }),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit item' : 'Add item'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
            <Input placeholder="Code" value={code} onChange={(e) => setCode(e.target.value)} />
          </div>
          <Select value={itemType} onValueChange={(v) => setItemType(v as InventoryItemType)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.values(InventoryItemType).map((t) => (
                <SelectItem key={t} value={t}>
                  {formatEnumLabel(t)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="grid grid-cols-2 gap-2">
            <LookupSelect
              placeholder="Category"
              value={categoryId}
              onChange={setCategoryId}
              options={categoriesQuery.data ?? []}
            />
            <LookupSelect
              placeholder="Item group"
              value={itemGroupId}
              onChange={setItemGroupId}
              options={itemGroupsQuery.data ?? []}
            />
            <LookupSelect
              placeholder="Unit"
              value={unitId}
              onChange={setUnitId}
              options={(unitsQuery.data ?? []).map((u) => ({ id: u.id, name: `${u.name} (${u.symbol})` }))}
            />
            <LookupSelect
              placeholder="Manufacturer"
              value={manufacturerId}
              onChange={setManufacturerId}
              options={manufacturersQuery.data ?? []}
            />
            <LookupSelect placeholder="Brand" value={brandId} onChange={setBrandId} options={brandsQuery.data ?? []} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="Unit cost (₹)" type="number" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} />
            <Input placeholder="GST %" type="number" value={gstPercent} onChange={(e) => setGstPercent(e.target.value)} />
          </div>
          <div className="flex gap-4 pt-1 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={trackBatch} onChange={(e) => setTrackBatch(e.target.checked)} />
              Track batch
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={trackExpiry} onChange={(e) => setTrackExpiry(e.target.checked)} />
              Track expiry
            </label>
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

function LookupSelect({
  placeholder,
  value,
  onChange,
  options,
}: {
  placeholder: string
  value: string
  onChange: (value: string) => void
  options: Array<{ id: string; name: string }>
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NO_SELECTION}>None</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.id} value={o.id}>
            {o.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
