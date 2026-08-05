'use client'

import { useQuery } from '@tanstack/react-query'
import { Building2 } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import { Suspense, useState } from 'react'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { getOrganization } from '@/lib/api/organization'

import { AuditLogsTab } from './_components/audit-logs-tab'
import { BrandingTab } from './_components/branding-tab'
import { HospitalsTab } from './_components/hospitals-tab'
import { OverviewTab } from './_components/overview-tab'
import { SettingsTab } from './_components/settings-tab'
import { SubscriptionTab } from './_components/subscription-tab'
import { UsageTab } from './_components/usage-tab'
import { UsersTab } from './_components/users-tab'

const TABS = [
  'overview',
  'hospitals',
  'users',
  'subscription',
  'usage',
  'branding',
  'settings',
  'audit',
] as const

type TabKey = (typeof TABS)[number]

function OrganizationDashboard() {
  const searchParams = useSearchParams()
  const requested = searchParams.get('tab') as TabKey | null
  const [tab, setTab] = useState<TabKey>(
    requested && TABS.includes(requested) ? requested : 'overview',
  )

  const orgQuery = useQuery({ queryKey: ['organization', 'me'], queryFn: getOrganization })
  const org = orgQuery.data

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-md bg-primary/10 text-primary">
          {org?.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={org.logo} alt="" className="h-full w-full object-contain" />
          ) : (
            <Building2 className="h-5 w-5" />
          )}
        </div>
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            {orgQuery.isLoading ? 'Loading…' : (org?.name ?? 'Organization')}
          </h1>
          <p className="text-sm text-muted-foreground">
            {org
              ? `${org.slug} · ${org.type.replace(/_/g, ' ').toLowerCase()}`
              : 'Organization administration'}
          </p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="hospitals">Hospitals</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="subscription">Subscription</TabsTrigger>
          <TabsTrigger value="usage">Usage</TabsTrigger>
          <TabsTrigger value="branding">Branding</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="audit">Audit Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab />
        </TabsContent>
        <TabsContent value="hospitals">
          <HospitalsTab />
        </TabsContent>
        <TabsContent value="users">
          <UsersTab />
        </TabsContent>
        <TabsContent value="subscription">
          <SubscriptionTab />
        </TabsContent>
        <TabsContent value="usage">
          <UsageTab />
        </TabsContent>
        <TabsContent value="branding">
          <BrandingTab />
        </TabsContent>
        <TabsContent value="settings">
          <SettingsTab />
        </TabsContent>
        <TabsContent value="audit">
          <AuditLogsTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default function OrganizationPage() {
  // `useSearchParams` requires a Suspense boundary under the App Router.
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
      <OrganizationDashboard />
    </Suspense>
  )
}
