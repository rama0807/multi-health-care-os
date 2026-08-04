'use client'

import type {
  InventoryBrand,
  InventoryCategory,
  InventoryItemGroup,
  InventoryManufacturer,
  InventoryUnit,
} from '@medicore/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import {
  createInventoryBrand,
  createInventoryCategory,
  createInventoryItemGroup,
  createInventoryManufacturer,
  createInventoryUnit,
  listInventoryBrands,
  listInventoryCategories,
  listInventoryItemGroups,
  listInventoryManufacturers,
  listInventoryUnits,
  updateInventoryBrand,
  updateInventoryCategory,
  updateInventoryItemGroup,
  updateInventoryManufacturer,
  updateInventoryUnit,
} from '@/lib/api/inventory'
import { useAuth } from '@/lib/auth/auth-context'

function getErrorMessage(error: unknown): string {
  const axiosError = error as { response?: { data?: { error?: { message?: string } } } }
  return axiosError?.response?.data?.error?.message ?? 'Something went wrong. Please try again.'
}

const NO_MANUFACTURER = '__none__'

export default function InventoryLookupsPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Categories & Lookups</h1>
        <p className="text-sm text-muted-foreground">Shared item master reference data used across the inventory catalog.</p>
      </div>

      <Tabs defaultValue="categories">
        <TabsList>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="itemGroups">Item Groups</TabsTrigger>
          <TabsTrigger value="units">Units</TabsTrigger>
          <TabsTrigger value="manufacturers">Manufacturers</TabsTrigger>
          <TabsTrigger value="brands">Brands</TabsTrigger>
        </TabsList>
        <TabsContent value="categories">
          <CategoriesTab />
        </TabsContent>
        <TabsContent value="itemGroups">
          <ItemGroupsTab />
        </TabsContent>
        <TabsContent value="units">
          <UnitsTab />
        </TabsContent>
        <TabsContent value="manufacturers">
          <ManufacturersTab />
        </TabsContent>
        <TabsContent value="brands">
          <BrandsTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function LookupRow({
  name,
  subtitle,
  isActive,
  onToggle,
  toggling,
}: {
  name: string
  subtitle?: string | null
  isActive: boolean
  onToggle: () => void
  toggling: boolean
}) {
  const { hasPermission } = useAuth()
  const canManage = hasPermission('inventory.items.update')

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
      <div>
        <span className="font-medium">{name}</span>
        {subtitle && <span className="ml-2 text-xs text-muted-foreground">{subtitle}</span>}
      </div>
      <div className="flex items-center gap-2">
        <Badge variant={isActive ? 'success' : 'secondary'}>{isActive ? 'Active' : 'Inactive'}</Badge>
        {canManage && (
          <Button variant="outline" size="sm" onClick={onToggle} disabled={toggling}>
            {isActive ? 'Deactivate' : 'Activate'}
          </Button>
        )}
      </div>
    </div>
  )
}

function CategoriesTab() {
  const { hasPermission } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const canManage = hasPermission('inventory.items.create')

  const [name, setName] = useState('')
  const [code, setCode] = useState('')

  const query = useQuery({ queryKey: ['inventory', 'categories', 'all'], queryFn: () => listInventoryCategories() })

  const createMutation = useMutation({
    mutationFn: () => createInventoryCategory({ name, code }),
    onSuccess: () => {
      setName('')
      setCode('')
      void queryClient.invalidateQueries({ queryKey: ['inventory', 'categories'] })
      toast({ title: 'Category added' })
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Could not add category', description: getErrorMessage(error) }),
  })

  const toggleMutation = useMutation({
    mutationFn: (target: InventoryCategory) => updateInventoryCategory(target.id, { isActive: !target.isActive }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['inventory', 'categories'] }),
    onError: (error) => toast({ variant: 'destructive', title: 'Update failed', description: getErrorMessage(error) }),
  })

  return (
    <div className="space-y-3">
      {canManage && (
        <div className="flex flex-wrap gap-2 rounded-lg border bg-card p-3">
          <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} className="max-w-xs" />
          <Input placeholder="Code" value={code} onChange={(e) => setCode(e.target.value)} className="max-w-[10rem]" />
          <Button size="sm" onClick={() => createMutation.mutate()} disabled={!name.trim() || !code.trim() || createMutation.isPending}>
            {createMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Add
          </Button>
        </div>
      )}
      <div className="divide-y rounded-lg border bg-card">
        {query.isLoading ? (
          <div className="flex h-16 items-center justify-center">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : query.data?.length ? (
          query.data.map((c) => (
            <LookupRow
              key={c.id}
              name={c.name}
              subtitle={c.code}
              isActive={c.isActive}
              onToggle={() => toggleMutation.mutate(c)}
              toggling={toggleMutation.isPending}
            />
          ))
        ) : (
          <p className="p-4 text-sm text-muted-foreground">No categories yet.</p>
        )}
      </div>
    </div>
  )
}

function ItemGroupsTab() {
  const { hasPermission } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const canManage = hasPermission('inventory.items.create')

  const [name, setName] = useState('')
  const [code, setCode] = useState('')

  const query = useQuery({ queryKey: ['inventory', 'item-groups', 'all'], queryFn: () => listInventoryItemGroups() })

  const createMutation = useMutation({
    mutationFn: () => createInventoryItemGroup({ name, code }),
    onSuccess: () => {
      setName('')
      setCode('')
      void queryClient.invalidateQueries({ queryKey: ['inventory', 'item-groups'] })
      toast({ title: 'Item group added' })
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Could not add item group', description: getErrorMessage(error) }),
  })

  const toggleMutation = useMutation({
    mutationFn: (target: InventoryItemGroup) => updateInventoryItemGroup(target.id, { isActive: !target.isActive }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['inventory', 'item-groups'] }),
    onError: (error) => toast({ variant: 'destructive', title: 'Update failed', description: getErrorMessage(error) }),
  })

  return (
    <div className="space-y-3">
      {canManage && (
        <div className="flex flex-wrap gap-2 rounded-lg border bg-card p-3">
          <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} className="max-w-xs" />
          <Input placeholder="Code" value={code} onChange={(e) => setCode(e.target.value)} className="max-w-[10rem]" />
          <Button size="sm" onClick={() => createMutation.mutate()} disabled={!name.trim() || !code.trim() || createMutation.isPending}>
            {createMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Add
          </Button>
        </div>
      )}
      <div className="divide-y rounded-lg border bg-card">
        {query.isLoading ? (
          <div className="flex h-16 items-center justify-center">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : query.data?.length ? (
          query.data.map((g) => (
            <LookupRow
              key={g.id}
              name={g.name}
              subtitle={g.code}
              isActive={g.isActive}
              onToggle={() => toggleMutation.mutate(g)}
              toggling={toggleMutation.isPending}
            />
          ))
        ) : (
          <p className="p-4 text-sm text-muted-foreground">No item groups yet.</p>
        )}
      </div>
    </div>
  )
}

function UnitsTab() {
  const { hasPermission } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const canManage = hasPermission('inventory.items.create')

  const [name, setName] = useState('')
  const [symbol, setSymbol] = useState('')

  const query = useQuery({ queryKey: ['inventory', 'units', 'all'], queryFn: () => listInventoryUnits() })

  const createMutation = useMutation({
    mutationFn: () => createInventoryUnit({ name, symbol }),
    onSuccess: () => {
      setName('')
      setSymbol('')
      void queryClient.invalidateQueries({ queryKey: ['inventory', 'units'] })
      toast({ title: 'Unit added' })
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Could not add unit', description: getErrorMessage(error) }),
  })

  const toggleMutation = useMutation({
    mutationFn: (target: InventoryUnit) => updateInventoryUnit(target.id, { isActive: !target.isActive }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['inventory', 'units'] }),
    onError: (error) => toast({ variant: 'destructive', title: 'Update failed', description: getErrorMessage(error) }),
  })

  return (
    <div className="space-y-3">
      {canManage && (
        <div className="flex flex-wrap gap-2 rounded-lg border bg-card p-3">
          <Input placeholder="Name (e.g. Piece)" value={name} onChange={(e) => setName(e.target.value)} className="max-w-xs" />
          <Input placeholder="Symbol (e.g. pc)" value={symbol} onChange={(e) => setSymbol(e.target.value)} className="max-w-[10rem]" />
          <Button
            size="sm"
            onClick={() => createMutation.mutate()}
            disabled={!name.trim() || !symbol.trim() || createMutation.isPending}
          >
            {createMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Add
          </Button>
        </div>
      )}
      <div className="divide-y rounded-lg border bg-card">
        {query.isLoading ? (
          <div className="flex h-16 items-center justify-center">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : query.data?.length ? (
          query.data.map((u) => (
            <LookupRow
              key={u.id}
              name={u.name}
              subtitle={u.symbol}
              isActive={u.isActive}
              onToggle={() => toggleMutation.mutate(u)}
              toggling={toggleMutation.isPending}
            />
          ))
        ) : (
          <p className="p-4 text-sm text-muted-foreground">No units yet.</p>
        )}
      </div>
    </div>
  )
}

function ManufacturersTab() {
  const { hasPermission } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const canManage = hasPermission('inventory.items.create')

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')

  const query = useQuery({ queryKey: ['inventory', 'manufacturers', 'all'], queryFn: () => listInventoryManufacturers() })

  const createMutation = useMutation({
    mutationFn: () => createInventoryManufacturer({ name, phone: phone || undefined }),
    onSuccess: () => {
      setName('')
      setPhone('')
      void queryClient.invalidateQueries({ queryKey: ['inventory', 'manufacturers'] })
      toast({ title: 'Manufacturer added' })
    },
    onError: (error) =>
      toast({ variant: 'destructive', title: 'Could not add manufacturer', description: getErrorMessage(error) }),
  })

  const toggleMutation = useMutation({
    mutationFn: (target: InventoryManufacturer) => updateInventoryManufacturer(target.id, { isActive: !target.isActive }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['inventory', 'manufacturers'] }),
    onError: (error) => toast({ variant: 'destructive', title: 'Update failed', description: getErrorMessage(error) }),
  })

  return (
    <div className="space-y-3">
      {canManage && (
        <div className="flex flex-wrap gap-2 rounded-lg border bg-card p-3">
          <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} className="max-w-xs" />
          <Input placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} className="max-w-[10rem]" />
          <Button size="sm" onClick={() => createMutation.mutate()} disabled={!name.trim() || createMutation.isPending}>
            {createMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Add
          </Button>
        </div>
      )}
      <div className="divide-y rounded-lg border bg-card">
        {query.isLoading ? (
          <div className="flex h-16 items-center justify-center">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : query.data?.length ? (
          query.data.map((m) => (
            <LookupRow
              key={m.id}
              name={m.name}
              subtitle={m.phone}
              isActive={m.isActive}
              onToggle={() => toggleMutation.mutate(m)}
              toggling={toggleMutation.isPending}
            />
          ))
        ) : (
          <p className="p-4 text-sm text-muted-foreground">No manufacturers yet.</p>
        )}
      </div>
    </div>
  )
}

function BrandsTab() {
  const { hasPermission } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const canManage = hasPermission('inventory.items.create')

  const [name, setName] = useState('')
  const [manufacturerId, setManufacturerId] = useState(NO_MANUFACTURER)

  const query = useQuery({ queryKey: ['inventory', 'brands', 'all'], queryFn: () => listInventoryBrands() })
  const manufacturersQuery = useQuery({
    queryKey: ['inventory', 'manufacturers', true],
    queryFn: () => listInventoryManufacturers(true),
  })

  const createMutation = useMutation({
    mutationFn: () =>
      createInventoryBrand({ name, manufacturerId: manufacturerId === NO_MANUFACTURER ? undefined : manufacturerId }),
    onSuccess: () => {
      setName('')
      setManufacturerId(NO_MANUFACTURER)
      void queryClient.invalidateQueries({ queryKey: ['inventory', 'brands'] })
      toast({ title: 'Brand added' })
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Could not add brand', description: getErrorMessage(error) }),
  })

  const toggleMutation = useMutation({
    mutationFn: (target: InventoryBrand) => updateInventoryBrand(target.id, { isActive: !target.isActive }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['inventory', 'brands'] }),
    onError: (error) => toast({ variant: 'destructive', title: 'Update failed', description: getErrorMessage(error) }),
  })

  return (
    <div className="space-y-3">
      {canManage && (
        <div className="flex flex-wrap gap-2 rounded-lg border bg-card p-3">
          <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} className="max-w-xs" />
          <Select value={manufacturerId} onValueChange={setManufacturerId}>
            <SelectTrigger className="max-w-[12rem]">
              <SelectValue placeholder="Manufacturer" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_MANUFACTURER}>None</SelectItem>
              {(manufacturersQuery.data ?? []).map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={() => createMutation.mutate()} disabled={!name.trim() || createMutation.isPending}>
            {createMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Add
          </Button>
        </div>
      )}
      <div className="divide-y rounded-lg border bg-card">
        {query.isLoading ? (
          <div className="flex h-16 items-center justify-center">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : query.data?.length ? (
          query.data.map((b) => (
            <LookupRow
              key={b.id}
              name={b.name}
              isActive={b.isActive}
              onToggle={() => toggleMutation.mutate(b)}
              toggling={toggleMutation.isPending}
            />
          ))
        ) : (
          <p className="p-4 text-sm text-muted-foreground">No brands yet.</p>
        )}
      </div>
    </div>
  )
}
