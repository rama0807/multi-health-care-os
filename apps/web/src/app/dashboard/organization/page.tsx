'use client'

import { useQuery } from '@tanstack/react-query'
import { Building2, CreditCard, History, LayoutDashboard, Mail, Palette, ShieldCheck, UsersRound } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import { Suspense, useState } from 'react'

import { SegmentedNav } from '@/components/ui/segmented-nav'
import { getOrganization, getOrganizationStats, getSubscription, listAuditLogs } from '@/lib/api/organization'

import { AuditSection } from './_components/audit-section'
import { BrandSection } from './_components/brand-section'
import { EmailSection } from './_components/email-section'
import { OrgHeader } from './_components/org-header'
import { OverviewSection } from './_components/overview-section'
import { PeopleSection } from './_components/people-section'
import { SecuritySection } from './_components/security-section'
import { SubscriptionSection } from './_components/subscription-section'
import { WorkspaceSection } from './_components/workspace-section'

const SECTIONS = [
  { value: 'overview', label: 'Overview', icon: LayoutDashboard },
  { value: 'workspace', label: 'Workspace', icon: Building2 },
  { value: 'people', label: 'People', icon: UsersRound },
  { value: 'subscription', label: 'Subscription', icon: CreditCard },
  { value: 'brand', label: 'Brand', icon: Palette },
  { value: 'email', label: 'Email', icon: Mail },
  { value: 'security', label: 'Security', icon: ShieldCheck },
  { value: 'audit', label: 'Audit', icon: History },
] as const

type SectionKey = (typeof SECTIONS)[number]['value']
const SECTION_KEYS: string[] = SECTIONS.map((s) => s.value)

function OrganizationDashboard() {
  const searchParams = useSearchParams()
  const requested = searchParams.get('section')
  const [section, setSection] = useState<SectionKey>(
    requested && SECTION_KEYS.includes(requested) ? (requested as SectionKey) : 'overview',
  )

  const orgQuery = useQuery({ queryKey: ['organization', 'me'], queryFn: getOrganization })
  const statsQuery = useQuery({ queryKey: ['organization', 'stats'], queryFn: getOrganizationStats })
  const subscriptionQuery = useQuery({
    queryKey: ['organization', 'subscription'],
    queryFn: getSubscription,
  })
  const lastActivityQuery = useQuery({
    queryKey: ['organization', 'audit-logs', 'recent'],
    queryFn: () => listAuditLogs({ page: 1, limit: 5 }),
  })

  function navigate(value: string) {
    if (SECTION_KEYS.includes(value)) setSection(value as SectionKey)
  }

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-4">
      <OrgHeader
        org={orgQuery.data}
        loading={orgQuery.isLoading}
        stats={statsQuery.data}
        subscription={subscriptionQuery.data}
        lastActivityAt={lastActivityQuery.data?.data[0]?.createdAt ?? null}
        onNavigate={navigate}
      />

      <div className="sticky top-0 z-10 bg-background py-2">
        <SegmentedNav items={SECTIONS} value={section} onChange={setSection} />
      </div>

      <div className="pb-6">
        {section === 'overview' && <OverviewSection onNavigate={navigate} />}
        {section === 'workspace' && <WorkspaceSection />}
        {section === 'people' && <PeopleSection />}
        {section === 'subscription' && <SubscriptionSection />}
        {section === 'brand' && <BrandSection />}
        {section === 'email' && <EmailSection />}
        {section === 'security' && <SecuritySection />}
        {section === 'audit' && <AuditSection />}
      </div>
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
