'use client'

import { InventoryStoreType, StoreManagerRole, type InventoryStore } from '@medicore/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Plus, Users } from 'lucide-react'
import { useState } from 'react'

import { PageLayout } from '@/components/layout/page-layout'
import { Badge } from '@/components/ui/badge'
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
} from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'
import {
  assignStoreManager,
  createInventoryStore,
  deactivateInventoryStore,
  listInventoryStores,
  listStoreManagers,
  removeStoreManager,
  updateInventoryStore,
} from '@/lib/api/inventory'
import { useAuth } from '@/lib/auth/auth-context'

function getErrorMessage(error: unknown): string {
  const axiosError = error as { response?: { data?: { error?: { message?: string } } } }
  return axiosError?.response?.data?.error?.message ?? 'Something went wrong. Please try again.'
}

function formatEnumLabel(value: string): string {
  return value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, ' ')
}

export default function InventoryStoresPage() {
  const { hasPermission } = useAuth()
  const canCreate = hasPermission('inventory.stores.create')
  const canUpdate = hasPermission('inventory.stores.update')
  const canDelete = hasPermission('inventory.stores.delete')

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<InventoryStore | null>(null)
  const [managersFor, setManagersFor] = useState<InventoryStore | null>(null)

  const storesQuery = useQuery({ queryKey: ['inventory', 'stores', 'list'], queryFn: () => listInventoryStores() })
  const stores = storesQuery.data ?? []

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => deactivateInventoryStore(id),
    onSuccess: () => {
      void storesQuery.refetch()
    },
  })

  return (
    <PageLayout
      title="Stores"
      description="Central, ward, ICU, OT, and other stock-holding locations."
      actions={
        canCreate && (
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            Add store
          </Button>
        )
      }
    >
      {storesQuery.isLoading ? (
        <TableSkeleton rows={6} columns={6} />
      ) : stores.length === 0 ? (
        <EmptyState title="No stores yet" action={canCreate ? { label: 'Add store', onClick: () => setDialogOpen(true) } : undefined} />
      ) : (
        <TableContainer className="max-h-[70vh]">
          <Table density="compact" container={false}>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-48" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {stores.map((store) => (
                <TableRow key={store.id}>
                  <TableCell className="font-medium">{store.name}</TableCell>
                  <TableCell className="font-mono text-xs">{store.code}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{formatEnumLabel(store.type)}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{store.location ?? '—'}</TableCell>
                  <TableCell>
                    <StatusBadge status={store.isActive ? 'ACTIVE' : 'INACTIVE'} />
                  </TableCell>
                  <TableCell className="flex flex-wrap gap-1">
                    <Button variant="ghost" size="sm" onClick={() => setManagersFor(store)}>
                      <Users className="h-3.5 w-3.5" />
                      Managers
                    </Button>
                    {canUpdate && (
                      <Button variant="ghost" size="sm" onClick={() => setEditing(store)}>
                        Edit
                      </Button>
                    )}
                    {canDelete && store.isActive && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deactivateMutation.mutate(store.id)}
                        disabled={deactivateMutation.isPending}
                      >
                        Deactivate
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <StoreDialog open={dialogOpen} onOpenChange={setDialogOpen} />
      {editing && <StoreDialog open onOpenChange={(open) => !open && setEditing(null)} store={editing} />}
      {managersFor && <ManagersDialog store={managersFor} onOpenChange={(open) => !open && setManagersFor(null)} />}
    </PageLayout>
  )
}

function StoreDialog({
  open,
  onOpenChange,
  store,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  store?: InventoryStore
}) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const isEdit = Boolean(store)

  const [name, setName] = useState(store?.name ?? '')
  const [code, setCode] = useState(store?.code ?? '')
  const [type, setType] = useState<InventoryStoreType>(store?.type ?? InventoryStoreType.GENERAL)
  const [location, setLocation] = useState(store?.location ?? '')

  const mutation = useMutation({
    mutationFn: () => {
      const payload = { name, code, type, location: location || undefined }
      return isEdit ? updateInventoryStore(store!.id, payload) : createInventoryStore(payload)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['inventory', 'stores'] })
      void queryClient.invalidateQueries({ queryKey: ['inventory', 'dashboard-stats'] })
      toast({ title: isEdit ? 'Store updated' : 'Store added' })
      onOpenChange(false)
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Could not save store', description: getErrorMessage(error) }),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit store' : 'Add store'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <Input placeholder="Code" value={code} onChange={(e) => setCode(e.target.value)} />
          <Select value={type} onValueChange={(v) => setType(v as InventoryStoreType)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.values(InventoryStoreType).map((t) => (
                <SelectItem key={t} value={t}>
                  {formatEnumLabel(t)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input placeholder="Location" value={location} onChange={(e) => setLocation(e.target.value)} />
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

function ManagersDialog({ store, onOpenChange }: { store: InventoryStore; onOpenChange: (open: boolean) => void }) {
  const { hasPermission } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const canUpdate = hasPermission('inventory.stores.update')

  const [userId, setUserId] = useState('')
  const [role, setRole] = useState<StoreManagerRole>(StoreManagerRole.STAFF)

  const managersQuery = useQuery({
    queryKey: ['inventory', 'stores', store.id, 'managers'],
    queryFn: () => listStoreManagers(store.id),
  })

  const assignMutation = useMutation({
    mutationFn: () => assignStoreManager(store.id, { userId, role }),
    onSuccess: () => {
      setUserId('')
      void queryClient.invalidateQueries({ queryKey: ['inventory', 'stores', store.id, 'managers'] })
      toast({ title: 'Manager assigned' })
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Could not assign manager', description: getErrorMessage(error) }),
  })

  const removeMutation = useMutation({
    mutationFn: (managerId: string) => removeStoreManager(store.id, managerId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['inventory', 'stores', store.id, 'managers'] }),
    onError: (error) => toast({ variant: 'destructive', title: 'Could not remove manager', description: getErrorMessage(error) }),
  })

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Managers — {store.name}</DialogTitle>
        </DialogHeader>
        <div className="divide-y rounded-lg border">
          {managersQuery.isLoading ? (
            <div className="flex h-16 items-center justify-center">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : managersQuery.data?.length ? (
            managersQuery.data.map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-2 p-3 text-sm">
                <div>
                  <span className="font-medium">
                    {m.user.firstName} {m.user.lastName}
                  </span>
                  <span className="ml-2 text-xs text-muted-foreground">{m.user.email}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{formatEnumLabel(m.role)}</Badge>
                  {canUpdate && (
                    <Button variant="ghost" size="sm" onClick={() => removeMutation.mutate(m.id)} disabled={removeMutation.isPending}>
                      Remove
                    </Button>
                  )}
                </div>
              </div>
            ))
          ) : (
            <p className="p-4 text-sm text-muted-foreground">No managers assigned yet.</p>
          )}
        </div>
        {canUpdate && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Assign by internal user ID — no staff picker exists yet (see TECH_DEBT).
            </p>
            <div className="flex flex-wrap gap-2">
              <Input placeholder="User ID" value={userId} onChange={(e) => setUserId(e.target.value)} className="max-w-[14rem]" />
              <Select value={role} onValueChange={(v) => setRole(v as StoreManagerRole)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(StoreManagerRole).map((r) => (
                    <SelectItem key={r} value={r}>
                      {formatEnumLabel(r)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" onClick={() => assignMutation.mutate()} disabled={!userId.trim() || assignMutation.isPending}>
                {assignMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Assign
              </Button>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
