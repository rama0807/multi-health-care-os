'use client'

import { LabTestStatus, Priority, type LabTestCatalogItem, type LabTestWithItems } from '@medicore/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FlaskConical, Loader2, Settings, TestTube } from 'lucide-react'
import Link from 'next/link'
import { Fragment, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'
import { listDoctors } from '@/lib/api/doctors'
import {
  collectLabSample,
  createLabCatalogItem,
  enterLabResults,
  listLabCatalog,
  listLabOrders,
  updateLabCatalogItem,
} from '@/lib/api/laboratory'
import { useAuth } from '@/lib/auth/auth-context'

function getErrorMessage(error: unknown): string {
  const axiosError = error as { response?: { data?: { error?: { message?: string } } } }
  return axiosError?.response?.data?.error?.message ?? 'Something went wrong. Please try again.'
}

function formatEnumLabel(value: string): string {
  return value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, ' ')
}

const LAB_STATUS_BADGE: Record<LabTestStatus, 'secondary' | 'success' | 'destructive' | 'outline'> = {
  [LabTestStatus.ORDERED]: 'secondary',
  [LabTestStatus.SAMPLE_COLLECTED]: 'outline',
  [LabTestStatus.IN_PROGRESS]: 'outline',
  [LabTestStatus.COMPLETED]: 'success',
  [LabTestStatus.REPORTED]: 'success',
  [LabTestStatus.CANCELLED]: 'destructive',
}

export default function LaboratoryPage() {
  const { hasPermission } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [doctorId, setDoctorId] = useState<string>('all')
  const [status, setStatus] = useState<string>('all')
  const [priority, setPriority] = useState<string>('all')
  const [managingCatalog, setManagingCatalog] = useState(false)
  const [resultsOrderId, setResultsOrderId] = useState<string | null>(null)
  const [resultDrafts, setResultDrafts] = useState<Record<string, { result: string; isAbnormalOverride: boolean }>>({})

  const canCollect = hasPermission('laboratory.update')
  const canManageCatalog = hasPermission('laboratory.create')

  const doctorsQuery = useQuery({ queryKey: ['doctors', 'list', 'all'], queryFn: () => listDoctors({ limit: 100 }) })

  const ordersQuery = useQuery({
    queryKey: ['laboratory', 'list', { doctorId, status, priority }],
    queryFn: () =>
      listLabOrders({
        doctorId: doctorId === 'all' ? undefined : doctorId,
        status: status === 'all' ? undefined : (status as LabTestStatus),
        priority: priority === 'all' ? undefined : (priority as Priority),
        limit: 100,
      }),
  })

  function invalidateOrders() {
    void queryClient.invalidateQueries({ queryKey: ['laboratory', 'list'] })
  }

  const collectMutation = useMutation({
    mutationFn: (id: string) => collectLabSample(id, {}),
    onSuccess: () => {
      toast({ title: 'Sample collected' })
      invalidateOrders()
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Could not record sample collection', description: getErrorMessage(error) })
    },
  })

  const resultsMutation = useMutation({
    mutationFn: ({ id, drafts }: { id: string; drafts: Record<string, { result: string; isAbnormalOverride: boolean }> }) =>
      enterLabResults(id, {
        items: Object.entries(drafts)
          .filter(([, v]) => v.result.trim() !== '')
          .map(([itemId, v]) => ({ itemId, result: v.result, isAbnormalOverride: v.isAbnormalOverride })),
      }),
    onSuccess: () => {
      toast({ title: 'Results saved' })
      setResultsOrderId(null)
      setResultDrafts({})
      invalidateOrders()
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Could not save results', description: getErrorMessage(error) })
    },
  })

  function openResultsFor(order: LabTestWithItems) {
    setResultsOrderId(order.id)
    setResultDrafts(
      Object.fromEntries(order.items.map((item) => [item.id, { result: item.result ?? '', isAbnormalOverride: false }])),
    )
  }

  const orders = ordersQuery.data?.data ?? []

  return (
    <div className="space-y-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Laboratory</h1>
          <p className="text-sm text-muted-foreground">
            {ordersQuery.data ? `${ordersQuery.data.pagination.total} lab order${ordersQuery.data.pagination.total === 1 ? '' : 's'}` : 'Loading...'}
          </p>
        </div>
        {canManageCatalog && (
          <Button variant="outline" onClick={() => setManagingCatalog(true)}>
            <Settings className="h-4 w-4" />
            Manage catalog
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <Select value={doctorId} onValueChange={setDoctorId}>
          <SelectTrigger className="sm:w-56">
            <SelectValue placeholder="Doctor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All doctors</SelectItem>
            {doctorsQuery.data?.data.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                Dr. {d.fullName} — {d.specialization}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="sm:w-44">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {Object.values(LabTestStatus).map((s) => (
              <SelectItem key={s} value={s}>
                {formatEnumLabel(s)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={priority} onValueChange={setPriority}>
          <SelectTrigger className="sm:w-40">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priorities</SelectItem>
            {Object.values(Priority).map((p) => (
              <SelectItem key={p} value={p}>
                {formatEnumLabel(p)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order #</TableHead>
              <TableHead>Patient</TableHead>
              <TableHead>Doctor</TableHead>
              <TableHead>Tests</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ordersQuery.isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                </TableCell>
              </TableRow>
            ) : ordersQuery.isError ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  Couldn&apos;t load lab orders. {getErrorMessage(ordersQuery.error)}
                </TableCell>
              </TableRow>
            ) : orders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  No lab orders found.
                </TableCell>
              </TableRow>
            ) : (
              orders.map((order) => (
                <Fragment key={order.id}>
                  <TableRow>
                    <TableCell>
                      {order.encounterId ? (
                        <Link
                          href={`/dashboard/medical-records/${order.encounterId}`}
                          className="flex items-center gap-1.5 font-mono text-xs hover:underline"
                        >
                          <FlaskConical className="h-3.5 w-3.5 text-muted-foreground" />
                          {order.labOrderNumber}
                        </Link>
                      ) : (
                        <span className="font-mono text-xs">{order.labOrderNumber}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {order.patient.fullName}
                      <div className="font-mono text-xs text-muted-foreground">{order.patient.uhid}</div>
                    </TableCell>
                    <TableCell>Dr. {order.doctor.fullName}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {order.items.map((i) => i.testName).join(', ')}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{formatEnumLabel(order.priority)}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={LAB_STATUS_BADGE[order.status]}>{formatEnumLabel(order.status)}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-2">
                        {canCollect && order.status === LabTestStatus.ORDERED && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => collectMutation.mutate(order.id)}
                            disabled={collectMutation.isPending}
                          >
                            <TestTube className="h-3.5 w-3.5" />
                            Collect sample
                          </Button>
                        )}
                        {canCollect &&
                          (order.status === LabTestStatus.SAMPLE_COLLECTED || order.status === LabTestStatus.IN_PROGRESS) && (
                            <Button variant="outline" size="sm" onClick={() => openResultsFor(order)}>
                              Enter results
                            </Button>
                          )}
                      </div>
                    </TableCell>
                  </TableRow>
                  {resultsOrderId === order.id && (
                    <TableRow>
                      <TableCell colSpan={7}>
                        <div className="space-y-2 rounded-md border bg-muted/30 p-3">
                          {order.items.map((item) => (
                            <div key={item.id} className="flex flex-wrap items-center gap-2">
                              <span className="w-40 shrink-0 text-xs">{item.testName}</span>
                              <Input
                                className="w-40"
                                placeholder="Result"
                                value={resultDrafts[item.id]?.result ?? ''}
                                onChange={(e) =>
                                  setResultDrafts((prev) => ({
                                    ...prev,
                                    [item.id]: {
                                      result: e.target.value,
                                      isAbnormalOverride: prev[item.id]?.isAbnormalOverride ?? false,
                                    },
                                  }))
                                }
                              />
                              <span className="text-xs text-muted-foreground">
                                {item.unit} {item.referenceRange ? `· Ref: ${item.referenceRange}` : ''}
                              </span>
                              <label className="flex items-center gap-1 text-xs text-muted-foreground">
                                <input
                                  type="checkbox"
                                  checked={resultDrafts[item.id]?.isAbnormalOverride ?? false}
                                  onChange={(e) =>
                                    setResultDrafts((prev) => ({
                                      ...prev,
                                      [item.id]: { result: prev[item.id]?.result ?? '', isAbnormalOverride: e.target.checked },
                                    }))
                                  }
                                />
                                Mark abnormal (non-numeric only)
                              </label>
                            </div>
                          ))}
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              onClick={() => resultsMutation.mutate({ id: order.id, drafts: resultDrafts })}
                              disabled={resultsMutation.isPending}
                            >
                              {resultsMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                              Save results
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => setResultsOrderId(null)}>
                              Cancel
                            </Button>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <CatalogDialog open={managingCatalog} onOpenChange={setManagingCatalog} canManage={canManageCatalog} />
    </div>
  )
}

function CatalogDialog({
  open,
  onOpenChange,
  canManage,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  canManage: boolean
}) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [testCode, setTestCode] = useState('')
  const [testName, setTestName] = useState('')
  const [category, setCategory] = useState('')
  const [unit, setUnit] = useState('')
  const [referenceRangeLow, setReferenceRangeLow] = useState('')
  const [referenceRangeHigh, setReferenceRangeHigh] = useState('')
  const [referenceRangeText, setReferenceRangeText] = useState('')

  const catalogQuery = useQuery({
    queryKey: ['laboratory', 'catalog', 'all'],
    queryFn: () => listLabCatalog(),
    enabled: open,
  })

  const createMutation = useMutation({
    mutationFn: () =>
      createLabCatalogItem({
        testCode,
        testName,
        category,
        unit: unit || undefined,
        referenceRangeLow: referenceRangeLow ? Number(referenceRangeLow) : undefined,
        referenceRangeHigh: referenceRangeHigh ? Number(referenceRangeHigh) : undefined,
        referenceRangeText: referenceRangeText || undefined,
      }),
    onSuccess: () => {
      toast({ title: 'Catalog item added' })
      setTestCode('')
      setTestName('')
      setCategory('')
      setUnit('')
      setReferenceRangeLow('')
      setReferenceRangeHigh('')
      setReferenceRangeText('')
      void queryClient.invalidateQueries({ queryKey: ['laboratory', 'catalog'] })
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Could not add catalog item', description: getErrorMessage(error) })
    },
  })

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => updateLabCatalogItem(id, { isActive }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['laboratory', 'catalog'] })
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Update failed', description: getErrorMessage(error) })
    },
  })

  const canSubmit = Boolean(testCode && testName && category && (referenceRangeLow || referenceRangeHigh || referenceRangeText))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Lab test catalog</DialogTitle>
          <DialogDescription>Org-configurable orderable tests, with an optional reference range.</DialogDescription>
        </DialogHeader>

        {canManage && (
          <div className="space-y-2 rounded-md border p-3">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <Input placeholder="Test code *" value={testCode} onChange={(e) => setTestCode(e.target.value)} />
              <Input placeholder="Test name *" value={testName} onChange={(e) => setTestName(e.target.value)} />
              <Input placeholder="Category *" value={category} onChange={(e) => setCategory(e.target.value)} />
              <Input placeholder="Unit" value={unit} onChange={(e) => setUnit(e.target.value)} />
              <Input
                placeholder="Ref. low"
                type="number"
                value={referenceRangeLow}
                onChange={(e) => setReferenceRangeLow(e.target.value)}
              />
              <Input
                placeholder="Ref. high"
                type="number"
                value={referenceRangeHigh}
                onChange={(e) => setReferenceRangeHigh(e.target.value)}
              />
            </div>
            <Input
              placeholder="Text reference range (e.g. Non-reactive) — for qualitative tests"
              value={referenceRangeText}
              onChange={(e) => setReferenceRangeText(e.target.value)}
            />
            <Button size="sm" onClick={() => createMutation.mutate()} disabled={!canSubmit || createMutation.isPending}>
              {createMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Add test
            </Button>
          </div>
        )}

        <div className="max-h-72 space-y-1 overflow-y-auto">
          {catalogQuery.data?.map((item: LabTestCatalogItem) => (
            <div key={item.id} className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm">
              <div>
                <span className="font-medium">{item.testName}</span>{' '}
                <span className="font-mono text-xs text-muted-foreground">({item.testCode})</span>
                <div className="text-xs text-muted-foreground">
                  {item.category} ·{' '}
                  {item.referenceRangeText ?? `${item.referenceRangeLow ?? '—'}–${item.referenceRangeHigh ?? '—'} ${item.unit ?? ''}`}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={item.isActive ? 'success' : 'secondary'}>{item.isActive ? 'Active' : 'Inactive'}</Badge>
                {canManage && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleActiveMutation.mutate({ id: item.id, isActive: !item.isActive })}
                  >
                    {item.isActive ? 'Deactivate' : 'Activate'}
                  </Button>
                )}
              </div>
            </div>
          ))}
          {catalogQuery.data?.length === 0 && (
            <p className="p-2 text-sm text-muted-foreground">No catalog items yet.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
