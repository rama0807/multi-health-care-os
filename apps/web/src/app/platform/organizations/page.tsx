'use client'

import { OrganizationStatus } from '@medicore/types'
import type {
  PlatformOrganizationSummary,
  SubscriptionStatus,
  SubscriptionTier,
} from '@medicore/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import {
  listPlatformOrganizations,
  reinstateOrganization,
  setOrganizationEnabled,
  suspendOrganization,
  upsertPlatformSubscription,
} from '@/lib/api/platform'

import { formatDate } from '../../dashboard/organization/_components/format'

const ANY = '__any__'

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive'> = {
  ACTIVE: 'default',
  TRIAL: 'secondary',
  SUSPENDED: 'destructive',
  CANCELLED: 'destructive',
}

const PLANS = ['FREE', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE'] as const
const SUB_STATUSES = ['TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELLED', 'EXPIRED'] as const

export default function PlatformOrganizationsPage() {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState(ANY)

  const [suspendTarget, setSuspendTarget] = useState<PlatformOrganizationSummary | null>(null)
  const [suspendReason, setSuspendReason] = useState('')
  const [planTarget, setPlanTarget] = useState<PlatformOrganizationSummary | null>(null)
  const [plan, setPlan] = useState<string>('FREE')
  const [planStatus, setPlanStatus] = useState<string>('ACTIVE')
  const [maxHospitals, setMaxHospitals] = useState('')
  const [maxUsers, setMaxUsers] = useState('')
  const [maxPatients, setMaxPatients] = useState('')
  const [storageQuotaMb, setStorageQuotaMb] = useState('')
  const [monthlyPrice, setMonthlyPrice] = useState('')

  const listQuery = useQuery({
    queryKey: ['platform', 'organizations', { page, search, status }],
    queryFn: () =>
      listPlatformOrganizations({
        page,
        limit: 25,
        search: search.trim() || undefined,
        status: status === ANY ? undefined : (status as OrganizationStatus),
      }),
  })

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['platform'] })
  }

  const onError = (error: { response?: { data?: { message?: string } } }) =>
    toast({
      title: 'Action failed',
      description: error.response?.data?.message ?? 'Please try again.',
      variant: 'destructive',
    })

  const suspendMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => suspendOrganization(id, reason),
    onSuccess: () => {
      invalidate()
      setSuspendTarget(null)
      setSuspendReason('')
      toast({ title: 'Organization suspended', description: 'Its users can no longer sign in.' })
    },
    onError,
  })

  const reinstateMutation = useMutation({
    mutationFn: reinstateOrganization,
    onSuccess: () => {
      invalidate()
      toast({ title: 'Organization reinstated' })
    },
    onError,
  })

  const enabledMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      setOrganizationEnabled(id, enabled),
    onSuccess: (_data, variables) => {
      invalidate()
      toast({ title: variables.enabled ? 'Tenant enabled' : 'Tenant disabled' })
    },
    onError,
  })

  const planMutation = useMutation({
    mutationFn: ({ id }: { id: string }) =>
      upsertPlatformSubscription(id, {
        plan: plan as SubscriptionTier,
        status: planStatus as SubscriptionStatus,
        maxHospitals: maxHospitals === '' ? null : Number(maxHospitals),
        maxUsers: maxUsers === '' ? null : Number(maxUsers),
        maxPatients: maxPatients === '' ? null : Number(maxPatients),
        storageQuotaMb: storageQuotaMb === '' ? null : Number(storageQuotaMb),
        monthlyPrice: monthlyPrice === '' ? null : Number(monthlyPrice),
      }),
    onSuccess: () => {
      invalidate()
      setPlanTarget(null)
      toast({ title: 'Subscription updated' })
    },
    onError,
  })

  function openPlanDialog(org: PlatformOrganizationSummary) {
    setPlanTarget(org)
    setPlan(org.subscriptionPlan)
    setPlanStatus(org.subscriptionStatus ?? 'ACTIVE')
    setMaxHospitals('')
    setMaxUsers('')
    setMaxPatients('')
    setStorageQuotaMb('')
    setMonthlyPrice('')
  }

  const rows = listQuery.data?.data ?? []
  const pagination = listQuery.data?.pagination

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Organizations</h1>
        <p className="text-sm text-muted-foreground">
          Every customer tenant on this deployment. The platform&apos;s own tenant is hidden.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-4">
        <div className="w-64 space-y-1">
          <Label htmlFor="org-search">Search</Label>
          <Input
            id="org-search"
            value={search}
            placeholder="Name, slug or email"
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
          />
        </div>
        <div className="w-44 space-y-1">
          <Label htmlFor="org-status">Status</Label>
          <Select
            value={status}
            onValueChange={(v) => {
              setStatus(v)
              setPage(1)
            }}
          >
            <SelectTrigger id="org-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Any status</SelectItem>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="TRIAL">Trial</SelectItem>
              <SelectItem value="SUSPENDED">Suspended</SelectItem>
              <SelectItem value="CANCELLED">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Organization</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead className="text-right">Hospitals</TableHead>
              <TableHead className="text-right">Users</TableHead>
              <TableHead className="text-right">Patients</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {listQuery.isLoading && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-sm text-muted-foreground">
                  Loading organizations…
                </TableCell>
              </TableRow>
            )}
            {!listQuery.isLoading && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-sm text-muted-foreground">
                  No organizations match these filters.
                </TableCell>
              </TableRow>
            )}
            {rows.map((org) => (
              <TableRow key={org.id}>
                <TableCell>
                  <p className="font-medium text-foreground">{org.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {org.slug} · {org.email}
                  </p>
                  {org.suspensionReason && (
                    <p className="mt-0.5 text-xs text-destructive">
                      Suspended: {org.suspensionReason}
                    </p>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[org.status] ?? 'secondary'}>
                    {org.status.toLowerCase()}
                  </Badge>
                  {!org.isActive && org.status !== OrganizationStatus.SUSPENDED && (
                    <Badge variant="secondary" className="ml-1">
                      disabled
                    </Badge>
                  )}
                </TableCell>
                <TableCell>{org.subscriptionPlan}</TableCell>
                <TableCell className="text-right">{org.hospitalCount}</TableCell>
                <TableCell className="text-right">{org.userCount}</TableCell>
                <TableCell className="text-right">{org.patientCount}</TableCell>
                <TableCell>{formatDate(org.createdAt)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex flex-wrap justify-end gap-1.5">
                    <Button size="sm" variant="outline" onClick={() => openPlanDialog(org)}>
                      Plan
                    </Button>
                    {org.status === OrganizationStatus.SUSPENDED ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={reinstateMutation.isPending}
                        onClick={() => reinstateMutation.mutate(org.id)}
                      >
                        Reinstate
                      </Button>
                    ) : (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={enabledMutation.isPending}
                          onClick={() =>
                            enabledMutation.mutate({ id: org.id, enabled: !org.isActive })
                          }
                        >
                          {org.isActive ? 'Disable' : 'Enable'}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => {
                            setSuspendTarget(org)
                            setSuspendReason('')
                          }}
                        >
                          Suspend
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {pagination && pagination.total > 0 && (
        <div className="flex items-center justify-between text-sm">
          <p className="text-muted-foreground">
            Page {pagination.page} of {pagination.totalPages} · {pagination.total} organizations
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!pagination.hasPrev}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!pagination.hasNext}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      <Dialog open={Boolean(suspendTarget)} onOpenChange={(open) => !open && setSuspendTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Suspend {suspendTarget?.name}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Every user in this organization will be blocked from signing in until it is reinstated.
            Clinical data is untouched.
          </p>
          <div className="space-y-1">
            <Label htmlFor="suspend-reason">Reason (recorded in the tenant&apos;s audit log)</Label>
            <Textarea
              id="suspend-reason"
              rows={3}
              value={suspendReason}
              onChange={(e) => setSuspendReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSuspendTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={suspendReason.trim().length < 3 || suspendMutation.isPending}
              onClick={() =>
                suspendTarget &&
                suspendMutation.mutate({ id: suspendTarget.id, reason: suspendReason.trim() })
              }
            >
              {suspendMutation.isPending ? 'Suspending…' : 'Suspend organization'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(planTarget)} onOpenChange={(open) => !open && setPlanTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Subscription - {planTarget?.name}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="plan-tier">Plan</Label>
              <Select value={plan} onValueChange={setPlan}>
                <SelectTrigger id="plan-tier">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PLANS.map((value) => (
                    <SelectItem key={value} value={value}>
                      {value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="plan-status">Status</Label>
              <Select value={planStatus} onValueChange={setPlanStatus}>
                <SelectTrigger id="plan-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUB_STATUSES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {value.replace(/_/g, ' ').toLowerCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <LimitField
              id="plan-hospitals"
              label="Max hospitals"
              value={maxHospitals}
              onChange={setMaxHospitals}
            />
            <LimitField id="plan-users" label="Max users" value={maxUsers} onChange={setMaxUsers} />
            <LimitField
              id="plan-patients"
              label="Max patients"
              value={maxPatients}
              onChange={setMaxPatients}
            />
            <LimitField
              id="plan-storage"
              label="Storage quota (MB)"
              value={storageQuotaMb}
              onChange={setStorageQuotaMb}
            />
            <LimitField
              id="plan-price"
              label="Monthly price"
              value={monthlyPrice}
              onChange={setMonthlyPrice}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Leave a limit blank for unlimited. No payment gateway is connected - this records the
            commercial agreement only.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPlanTarget(null)}>
              Cancel
            </Button>
            <Button
              disabled={planMutation.isPending}
              onClick={() => planTarget && planMutation.mutate({ id: planTarget.id })}
            >
              {planMutation.isPending ? 'Saving…' : 'Save subscription'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function LimitField({
  id,
  label,
  value,
  onChange,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        min={0}
        value={value}
        placeholder="Unlimited"
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}
