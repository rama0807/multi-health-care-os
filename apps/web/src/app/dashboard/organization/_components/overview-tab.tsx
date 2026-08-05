'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Building2, HardDrive, Stethoscope, UserCog, Users } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { getOrganization, getOrganizationStats, updateOrganization } from '@/lib/api/organization'
import { useAuth } from '@/lib/auth/auth-context'

import { formatBytes } from './format'

/** Contact, address and tax details — Checkpoint 16.4's profile half. */
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

export function OverviewTab() {
  const { toast } = useToast()
  const { hasPermission } = useAuth()
  const queryClient = useQueryClient()
  const canEdit = hasPermission('organizations.update')

  const orgQuery = useQuery({ queryKey: ['organization', 'me'], queryFn: getOrganization })
  const statsQuery = useQuery({
    queryKey: ['organization', 'stats'],
    queryFn: getOrganizationStats,
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

  const stats = statsQuery.data
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

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()

    // Empty optional fields are sent as `undefined`, not `''` — an empty
    // string fails the URL/email format checks on the server.
    const payload = Object.fromEntries(
      Object.entries(form).map(([key, value]) => [key, value?.trim() ? value.trim() : undefined]),
    )
    saveMutation.mutate(payload)
  }

  return (
    <div className="space-y-4 pt-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {tiles.map((tile) => (
          <div
            key={tile.key}
            className="flex items-center gap-3 rounded-lg border bg-card p-4 shadow-sm"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
              <tile.icon className="h-4 w-4" />
            </div>
            <div>
              <p className="text-lg font-semibold text-foreground">
                {statsQuery.isLoading ? '—' : (tile.value ?? 0)}
              </p>
              <p className="text-xs text-muted-foreground">{tile.label}</p>
            </div>
          </div>
        ))}
      </div>

      {stats && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <SummaryCard
            label="Active users (last 30 days)"
            value={`${stats.users.activeLast30Days} of ${stats.users.total}`}
          />
          <SummaryCard
            label="Appointments (last 30 days)"
            value={String(stats.appointmentsLast30Days)}
          />
          <SummaryCard
            label="Admissions (last 30 days)"
            value={String(stats.admissionsLast30Days)}
          />
        </div>
      )}

      <form onSubmit={handleSubmit} className="rounded-lg border bg-card p-4">
        <h3 className="mb-3 text-sm font-semibold text-foreground">Organization profile</h3>
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
    </div>
  )
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-lg font-semibold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  )
}
