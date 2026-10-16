'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Activity,
  ArrowRight,
  Building2,
  HardDrive,
  Palette,
  ShieldCheck,
  Stethoscope,
  UserCog,
  Users,
  Wifi,
} from 'lucide-react'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SectionHeader } from '@/components/ui/page-header'
import { Progress } from '@/components/ui/progress'
import { StatCard, StatCardGrid } from '@/components/ui/stat-card'
import { StatusBadge } from '@/components/ui/status-badge'
import { useToast } from '@/hooks/use-toast'
import {
  getOrganization,
  getOrganizationBranding,
  getOrganizationStats,
  getOrganizationUsage,
  getSubscription,
  listAuditLogs,
  updateOrganization,
} from '@/lib/api/organization'
import { useAuth } from '@/lib/auth/auth-context'

import { formatBytes, formatDateTime, humanizeAction, humanizeEnum, percentOf } from './format'

const PROFILE_FIELDS = [
  { key: 'name', label: 'Organization name' },
  { key: 'email', label: 'Contact email' },
  { key: 'phone', label: 'Contact phone' },
  { key: 'website', label: 'Website' },
  { key: 'address', label: 'Address' },
  { key: 'city', label: 'City' },
  { key: 'state', label: 'State' },
  { key: 'pincode', label: 'Pincode' },
  { key: 'country', label: 'Country (ISO-2)' },
  { key: 'licenseNumber', label: 'License number' },
  { key: 'taxId', label: 'Tax ID / GSTIN' },
] as const

type ProfileKey = (typeof PROFILE_FIELDS)[number]['key']

export function OverviewSection({ onNavigate }: { onNavigate: (section: string) => void }) {
  const { toast } = useToast()
  const { hasPermission } = useAuth()
  const queryClient = useQueryClient()
  const canEdit = hasPermission('organizations.update')

  const orgQuery = useQuery({ queryKey: ['organization', 'me'], queryFn: getOrganization })
  const statsQuery = useQuery({ queryKey: ['organization', 'stats'], queryFn: getOrganizationStats })
  const subscriptionQuery = useQuery({
    queryKey: ['organization', 'subscription'],
    queryFn: getSubscription,
  })
  const usageQuery = useQuery({ queryKey: ['organization', 'usage'], queryFn: getOrganizationUsage })
  const brandingQuery = useQuery({
    queryKey: ['organization', 'branding'],
    queryFn: getOrganizationBranding,
  })
  const activityQuery = useQuery({
    queryKey: ['organization', 'audit-logs', 'recent'],
    queryFn: () => listAuditLogs({ page: 1, limit: 5 }),
  })

  const [form, setForm] = useState<Partial<Record<ProfileKey, string>>>({})

  useEffect(() => {
    if (!orgQuery.data) return
    const org = orgQuery.data
    setForm({
      name: org.name,
      email: org.email,
      phone: org.phone,
      website: org.website ?? '',
      address: org.address ?? '',
      city: org.city ?? '',
      state: org.state ?? '',
      pincode: org.pincode ?? '',
      country: org.country,
      licenseNumber: org.licenseNumber ?? '',
      taxId: org.taxId ?? '',
    })
  }, [orgQuery.data])

  const saveMutation = useMutation({
    mutationFn: updateOrganization,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['organization'] })
      toast({ title: 'Organization profile updated' })
    },
    onError: (error: { response?: { data?: { message?: string } } }) =>
      toast({
        title: 'Could not save',
        description: error.response?.data?.message ?? 'Please check the values and try again.',
        variant: 'destructive',
      }),
  })

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const payload = Object.fromEntries(
      Object.entries(form).map(([key, value]) => [key, value?.trim() ? value.trim() : undefined]),
    )
    saveMutation.mutate(payload)
  }

  const stats = statsQuery.data
  const usage = usageQuery.data
  const subscription = subscriptionQuery.data
  const branding = brandingQuery.data
  const activity = activityQuery.data?.data ?? []

  const tiles = [
    { key: 'hospitals', label: 'Hospitals', icon: Building2, value: stats?.hospitals.total },
    { key: 'users', label: 'Users', icon: Users, value: stats?.users.total },
    { key: 'doctors', label: 'Doctors', icon: Stethoscope, value: stats?.doctors },
    { key: 'staff', label: 'Staff', icon: UserCog, value: stats?.staff },
    {
      key: 'storage',
      label: 'Storage used',
      icon: HardDrive,
      value: stats ? formatBytes(stats.storageBytes) : undefined,
    },
  ] as const

  return (
    <div className="space-y-4">
      <StatCardGrid columns={5}>
        {tiles.map((tile) => (
          <StatCard key={tile.key} icon={tile.icon} label={tile.label} value={tile.value} loading={statsQuery.isLoading} />
        ))}
      </StatCardGrid>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <GlanceCard
          title="Subscription"
          onView={() => onNavigate('subscription')}
          loading={subscriptionQuery.isLoading}
        >
          {subscription && (
            <>
              <div className="flex items-center justify-between">
                <p className="text-lg font-semibold text-foreground">{humanizeEnum(subscription.plan)}</p>
                <StatusBadge status={subscription.status} />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {subscription.endsAt ? `Renews ${formatDateTime(subscription.endsAt)}` : 'No end date'}
              </p>
            </>
          )}
        </GlanceCard>

        <GlanceCard title="Security status" onView={() => onNavigate('security')}>
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-success-subtle-foreground" aria-hidden="true" />
            <p className="text-sm font-medium text-foreground">Email &amp; password authentication</p>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Single sign-on, per-org password policy and API keys are not yet configurable.
          </p>
        </GlanceCard>

        <GlanceCard title="API status" onView={() => onNavigate('subscription')} loading={usageQuery.isLoading}>
          {usage && (
            <>
              <div className="flex items-center gap-2">
                <Wifi className="size-4 text-info-subtle-foreground" aria-hidden="true" />
                <p className="text-lg font-semibold text-foreground">
                  {usage.api.totalRequests.toLocaleString()}
                </p>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Requests in the last {usage.api.windowDays} days
              </p>
            </>
          )}
        </GlanceCard>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Usage against plan limits</CardTitle>
          </CardHeader>
          <CardContent>
            {usage ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <UsageBar
                  label="Storage"
                  used={formatBytes(usage.storage.totalBytes)}
                  percent={percentOf(
                    usage.storage.totalBytes,
                    usage.storage.quotaMb ? usage.storage.quotaMb * 1024 * 1024 : null,
                  )}
                />
                <UsageBar
                  label="Users"
                  used={`${usage.users.total}${usage.users.limit ? ` of ${usage.users.limit}` : ''}`}
                  percent={percentOf(usage.users.total, usage.users.limit)}
                />
                <UsageBar
                  label="Hospitals"
                  used={`${usage.hospitals.total}${usage.hospitals.limit ? ` of ${usage.hospitals.limit}` : ''}`}
                  percent={percentOf(usage.hospitals.total, usage.hospitals.limit)}
                />
                <UsageBar
                  label="Patients"
                  used={`${usage.patients.total}${usage.patients.limit ? ` of ${usage.patients.limit}` : ''}`}
                  percent={percentOf(usage.patients.total, usage.patients.limit)}
                />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Loading usage…</p>
            )}
            <Button variant="link" size="sm" className="mt-2 h-auto p-0" onClick={() => onNavigate('subscription')}>
              View full usage breakdown
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Brand preview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-md border bg-muted">
                {branding?.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={branding.logo} alt="" className="h-full w-full object-contain" />
                ) : (
                  <Palette className="size-5 text-muted-foreground" />
                )}
              </div>
              <div className="flex gap-1.5">
                {[branding?.primaryColor, branding?.secondaryColor, branding?.accentColor]
                  .filter(Boolean)
                  .map((color, index) => (
                    <span
                      key={index}
                      className="size-6 rounded-full border border-border"
                      style={{ backgroundColor: color }}
                    />
                  ))}
              </div>
            </div>
            <Button variant="link" size="sm" className="mt-3 h-auto p-0" onClick={() => onNavigate('brand')}>
              Manage branding
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Recent activity</CardTitle>
            <Button variant="link" size="sm" className="h-auto p-0" onClick={() => onNavigate('audit')}>
              View all
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {activity.length === 0 ? (
            <EmptyState compact title="No recent activity" />
          ) : (
            <ul className="space-y-3">
              {activity.map((entry) => (
                <li key={entry.id} className="flex items-start gap-2.5 text-sm">
                  <Activity className="mt-0.5 size-3.5 shrink-0 text-subtle-foreground" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="text-foreground">
                      <span className="font-medium">{entry.userName ?? entry.userEmail ?? 'System'}</span>{' '}
                      {humanizeAction(entry.action)}
                    </p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(entry.createdAt)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <SectionHeader title="Organization profile" description="Contact, address and tax details." />
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {PROFILE_FIELDS.map((field) => (
                <div key={field.key} className="space-y-1">
                  <Label htmlFor={`org-${field.key}`}>{field.label}</Label>
                  <Input
                    id={`org-${field.key}`}
                    value={form[field.key] ?? ''}
                    disabled={!canEdit || orgQuery.isLoading}
                    onChange={(e) => setForm((prev) => ({ ...prev, [field.key]: e.target.value }))}
                  />
                </div>
              ))}
            </div>

            {canEdit ? (
              <div className="mt-4 flex justify-end">
                <Button type="submit" disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? 'Saving…' : 'Save profile'}
                </Button>
              </div>
            ) : (
              <p className="mt-3 text-xs text-muted-foreground">
                You have read-only access to the organization profile.
              </p>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

function GlanceCard({
  title,
  onView,
  loading = false,
  children,
}: {
  title: string
  onView: () => void
  loading?: boolean
  children?: React.ReactNode
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{title}</CardTitle>
          <Button variant="ghost" size="sm" onClick={onView}>
            View
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>{loading ? <p className="text-sm text-muted-foreground">Loading…</p> : children}</CardContent>
    </Card>
  )
}

function UsageBar({ label, used, percent }: { label: string; used: string; percent: number | null }) {
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium text-foreground">{used}</span>
      </div>
      {percent === null ? (
        <p className="mt-1.5 text-xs text-muted-foreground">Unlimited</p>
      ) : (
        <Progress value={percent} tone={percent >= 90 ? 'danger' : 'default'} className="mt-1.5" />
      )}
    </div>
  )
}
