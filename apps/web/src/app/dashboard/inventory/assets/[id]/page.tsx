'use client'

import { AssetMaintenanceStatus, AssetMaintenanceType } from '@medicore/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useParams } from 'next/navigation'
import { useState } from 'react'

import { PageLayout } from '@/components/layout/page-layout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { StatusBadge } from '@/components/ui/status-badge'
import { Table, TableBody, TableCell, TableContainer, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { listDepartments } from '@/lib/api/hospitals'
import { listInventoryStores, listVendors } from '@/lib/api/inventory'
import {
  assignAsset,
  completeAssetMaintenanceRecord,
  createAssetMaintenanceRecord,
  getAsset,
  listAssetAssignments,
  listAssetMaintenanceRecords,
} from '@/lib/api/procurement'
import { useAuth } from '@/lib/auth/auth-context'

function getErrorMessage(error: unknown): string {
  const axiosError = error as { response?: { data?: { error?: { message?: string } } } }
  return axiosError?.response?.data?.error?.message ?? 'Something went wrong. Please try again.'
}

function formatEnumLabel(value: string): string {
  return value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, ' ')
}

export default function AssetDetailPage() {
  const params = useParams<{ id: string }>()
  const { hasPermission } = useAuth()
  const canUpdate = hasPermission('inventory.assets.update')

  const [assignOpen, setAssignOpen] = useState(false)
  const [maintenanceOpen, setMaintenanceOpen] = useState(false)
  const [completing, setCompleting] = useState<string | null>(null)

  const assetQuery = useQuery({ queryKey: ['inventory', 'assets', 'detail', params.id], queryFn: () => getAsset(params.id) })
  const assignmentsQuery = useQuery({
    queryKey: ['inventory', 'assets', params.id, 'assignments'],
    queryFn: () => listAssetAssignments(params.id),
  })
  const maintenanceQuery = useQuery({
    queryKey: ['inventory', 'assets', params.id, 'maintenance'],
    queryFn: () => listAssetMaintenanceRecords(params.id),
  })

  if (assetQuery.isLoading) {
    return (
      <PageLayout
        breadcrumbs={[{ label: 'Inventory', href: '/dashboard/inventory' }, { label: 'Assets', href: '/dashboard/inventory/assets' }, { label: '…' }]}
        title="…"
        loading
      >
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </PageLayout>
    )
  }

  if (assetQuery.isError || !assetQuery.data) {
    return (
      <PageLayout
        breadcrumbs={[{ label: 'Inventory', href: '/dashboard/inventory' }, { label: 'Assets', href: '/dashboard/inventory/assets' }, { label: 'Not found' }]}
        title="Asset not found"
      >
        <EmptyState
          variant="error"
          title="Asset not found"
          description={getErrorMessage(assetQuery.error)}
          action={{ label: 'Back to list', href: '/dashboard/inventory/assets' }}
        />
      </PageLayout>
    )
  }

  const asset = assetQuery.data

  return (
    <PageLayout
      breadcrumbs={[
        { label: 'Inventory', href: '/dashboard/inventory' },
        { label: 'Assets', href: '/dashboard/inventory/assets' },
        { label: asset.assetTag },
      ]}
      title={<span className="font-mono">{asset.assetTag}</span>}
      badge={<StatusBadge status={asset.status} />}
      meta={
        <span>
          {asset.item.name} · Store: {asset.store.name}
          {asset.serialNumber && <> · S/N {asset.serialNumber}</>}
        </span>
      }
      actions={
        canUpdate && (
          <>
            <Button size="sm" variant="outline" onClick={() => setAssignOpen(true)}>
              Assign
            </Button>
            <Button size="sm" onClick={() => setMaintenanceOpen(true)}>
              Log maintenance
            </Button>
          </>
        )
      }
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Assignment history</CardTitle>
          </CardHeader>
          {assignmentsQuery.data?.length ? (
            <ul className="divide-y">
              {assignmentsQuery.data.map((a) => (
                <li key={a.id} className="p-3 text-sm">
                  <div>
                    {a.assignedToUserId ? `User ${a.assignedToUserId}` : a.assignedToDepartmentId ? `Department ${a.assignedToDepartmentId}` : 'In store'}
                    {!a.returnedAt && <Badge className="ml-2" variant="outline">Current</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(a.assignedAt).toLocaleString('en-IN')}
                    {a.returnedAt && ` → returned ${new Date(a.returnedAt).toLocaleString('en-IN')}`}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState compact title="Never assigned" description="Currently in store." />
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Maintenance records</CardTitle>
          </CardHeader>
          {maintenanceQuery.data?.length ? (
            <TableContainer className="rounded-none border-0 border-y">
              <Table density="compact" container={false}>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Cost</TableHead>
                    {canUpdate && <TableHead />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {maintenanceQuery.data.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="text-xs">{formatEnumLabel(m.type)}</TableCell>
                      <TableCell>
                        <StatusBadge status={m.status} />
                      </TableCell>
                      <TableCell className="text-xs">{m.cost ? `₹${m.cost}` : '-'}</TableCell>
                      {canUpdate && (
                        <TableCell>
                          {(m.status === AssetMaintenanceStatus.SCHEDULED || m.status === AssetMaintenanceStatus.IN_PROGRESS) && (
                            <Button variant="ghost" size="sm" onClick={() => setCompleting(m.id)}>
                              Complete
                            </Button>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <EmptyState compact title="No maintenance records yet" />
          )}
        </Card>
      </div>

      {assignOpen && <AssignDialog assetId={asset.id} currentStoreId={asset.storeId} onOpenChange={setAssignOpen} />}
      {maintenanceOpen && <MaintenanceDialog assetId={asset.id} onOpenChange={setMaintenanceOpen} />}
      {completing && <CompleteMaintenanceDialog assetId={asset.id} recordId={completing} onOpenChange={(open) => !open && setCompleting(null)} />}
    </PageLayout>
  )
}

function AssignDialog({ assetId, currentStoreId, onOpenChange }: { assetId: string; currentStoreId: string; onOpenChange: (open: boolean) => void }) {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [target, setTarget] = useState<'user' | 'department' | 'store'>('store')
  const [assignedToUserId, setAssignedToUserId] = useState('')
  const [assignedToDepartmentId, setAssignedToDepartmentId] = useState('')
  const [storeId, setStoreId] = useState(currentStoreId)
  const [notes, setNotes] = useState('')

  const storesQuery = useQuery({ queryKey: ['inventory', 'stores', true], queryFn: () => listInventoryStores(true) })
  const departmentsQuery = useQuery({ queryKey: ['departments', 'all'], queryFn: () => listDepartments() })

  const mutation = useMutation({
    mutationFn: () =>
      assignAsset(assetId, {
        assignedToUserId: target === 'user' ? assignedToUserId : undefined,
        assignedToDepartmentId: target === 'department' ? assignedToDepartmentId : undefined,
        storeId: storeId || undefined,
        notes: notes || undefined,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['inventory', 'assets'] })
      toast({ title: 'Asset assignment updated' })
      onOpenChange(false)
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Could not update assignment', description: getErrorMessage(error) }),
  })

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign asset</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Select value={target} onValueChange={(v) => setTarget(v as typeof target)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="store">Return to store (unassigned)</SelectItem>
              <SelectItem value="department">Assign to department</SelectItem>
              <SelectItem value="user">Assign to user</SelectItem>
            </SelectContent>
          </Select>
          {target === 'department' && (
            <Select value={assignedToDepartmentId} onValueChange={setAssignedToDepartmentId}>
              <SelectTrigger>
                <SelectValue placeholder="Department" />
              </SelectTrigger>
              <SelectContent>
                {(departmentsQuery.data ?? []).map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {target === 'user' && (
            <>
              <Input placeholder="User ID" value={assignedToUserId} onChange={(e) => setAssignedToUserId(e.target.value)} />
              <p className="text-xs text-muted-foreground">Assign by internal user ID - no staff picker exists yet (see TECH_DEBT).</p>
            </>
          )}
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
          <Textarea placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={(target === 'user' && !assignedToUserId.trim()) || (target === 'department' && !assignedToDepartmentId) || mutation.isPending}
          >
            {mutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function MaintenanceDialog({ assetId, onOpenChange }: { assetId: string; onOpenChange: (open: boolean) => void }) {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [type, setType] = useState<AssetMaintenanceType>(AssetMaintenanceType.PREVENTIVE)
  const [scheduledDate, setScheduledDate] = useState('')
  const [description, setDescription] = useState('')
  const [cost, setCost] = useState('')
  const [performedBy, setPerformedBy] = useState('')
  const [vendorId, setVendorId] = useState('')

  const vendorsQuery = useQuery({ queryKey: ['inventory', 'vendors', 'active-for-maintenance'], queryFn: () => listVendors({ isActive: true, limit: 100 }) })

  const mutation = useMutation({
    mutationFn: () =>
      createAssetMaintenanceRecord(assetId, {
        type,
        scheduledDate: scheduledDate ? new Date(scheduledDate) : undefined,
        description,
        cost: cost ? Number(cost) : undefined,
        performedBy: performedBy || undefined,
        vendorId: vendorId || undefined,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['inventory', 'assets'] })
      void queryClient.invalidateQueries({ queryKey: ['inventory', 'dashboard-stats'] })
      toast({ title: 'Maintenance record logged' })
      onOpenChange(false)
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Could not log maintenance', description: getErrorMessage(error) }),
  })

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log maintenance</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Select value={type} onValueChange={(v) => setType(v as AssetMaintenanceType)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.values(AssetMaintenanceType).map((t) => (
                <SelectItem key={t} value={t}>
                  {formatEnumLabel(t)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Textarea placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
          <div className="grid grid-cols-2 gap-2">
            <Input type="date" placeholder="Scheduled date (optional)" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} />
            <Input type="number" placeholder="Cost (₹, optional)" value={cost} onChange={(e) => setCost(e.target.value)} />
          </div>
          <Input placeholder="Performed by (optional)" value={performedBy} onChange={(e) => setPerformedBy(e.target.value)} />
          <Select value={vendorId} onValueChange={setVendorId}>
            <SelectTrigger>
              <SelectValue placeholder="AMC vendor (optional)" />
            </SelectTrigger>
            <SelectContent>
              {(vendorsQuery.data?.data ?? []).map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {v.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={!description.trim() || mutation.isPending}>
            {mutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CompleteMaintenanceDialog({
  assetId,
  recordId,
  onOpenChange,
}: {
  assetId: string
  recordId: string
  onOpenChange: (open: boolean) => void
}) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [cost, setCost] = useState('')
  const [performedBy, setPerformedBy] = useState('')

  const mutation = useMutation({
    mutationFn: () =>
      completeAssetMaintenanceRecord(assetId, recordId, {
        cost: cost ? Number(cost) : undefined,
        performedBy: performedBy || undefined,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['inventory', 'assets'] })
      void queryClient.invalidateQueries({ queryKey: ['inventory', 'dashboard-stats'] })
      toast({ title: 'Maintenance completed' })
      onOpenChange(false)
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Could not complete maintenance', description: getErrorMessage(error) }),
  })

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Complete maintenance</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2">
          <Input type="number" placeholder="Final cost (₹, optional)" value={cost} onChange={(e) => setCost(e.target.value)} />
          <Input placeholder="Performed by (optional)" value={performedBy} onChange={(e) => setPerformedBy(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Complete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
