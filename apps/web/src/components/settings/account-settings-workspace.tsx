'use client'

import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'next/navigation'
import { Suspense, useState } from 'react'

import { AboutSection } from '@/app/dashboard/settings/_components/about-section'
import { AccessibilitySection } from '@/app/dashboard/settings/_components/accessibility-section'
import { AccountSection } from '@/app/dashboard/settings/_components/account-section'
import { AppearanceSection } from '@/app/dashboard/settings/_components/appearance-section'
import { DeveloperSection } from '@/app/dashboard/settings/_components/developer-section'
import { DevicesSection } from '@/app/dashboard/settings/_components/devices-section'
import { NotificationsSection } from '@/app/dashboard/settings/_components/notifications-section'
import { SecuritySection } from '@/app/dashboard/settings/_components/security-section'
import { SessionsSection } from '@/app/dashboard/settings/_components/sessions-section'
import { SettingsFooterProvider, useSettingsFooterState } from '@/app/dashboard/settings/_components/settings-footer-context'
import { SettingsHeader } from '@/app/dashboard/settings/_components/settings-header'
import { SETTINGS_SECTION_KEYS, SettingsNav, type SettingsSectionKey } from '@/app/dashboard/settings/_components/settings-nav'
import { ShortcutsSection } from '@/app/dashboard/settings/_components/shortcuts-section'
import { Button } from '@/components/ui/button'
import { getCurrentUser } from '@/lib/api/account'
import { useAuth } from '@/lib/auth/auth-context'

export interface AccountSettingsWorkspaceProps {
  basePath?: '/dashboard' | '/dental'
}

function SettingsWorkspace() {
  const searchParams = useSearchParams()
  const requested = searchParams.get('section')
  const [section, setSection] = useState<SettingsSectionKey>(
    requested && SETTINGS_SECTION_KEYS.includes(requested) ? (requested as SettingsSectionKey) : 'account',
  )

  const { user: sessionUser } = useAuth()
  const meQuery = useQuery({ queryKey: ['account', 'me'], queryFn: getCurrentUser })
  const user = meQuery.data ?? sessionUser ?? undefined

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-4">
      <SettingsHeader user={user} loading={meQuery.isLoading && !sessionUser} />

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <SettingsNav value={section} onChange={setSection} />

        <div className="min-w-0 flex-1 pb-8">
          {section === 'account' && <AccountSection user={user} loading={meQuery.isLoading && !sessionUser} />}
          {section === 'appearance' && <AppearanceSection />}
          {section === 'notifications' && <NotificationsSection />}
          {section === 'security' && <SecuritySection />}
          {section === 'sessions' && <SessionsSection />}
          {section === 'devices' && <DevicesSection />}
          {section === 'shortcuts' && <ShortcutsSection />}
          {section === 'accessibility' && <AccessibilitySection />}
          {section === 'developer' && <DeveloperSection />}
          {section === 'about' && <AboutSection user={user} />}

          <SettingsStickyFooter />
        </div>
      </div>
    </div>
  )
}

function SettingsStickyFooter() {
  const footer = useSettingsFooterState()
  if (!footer.isDirty) return null

  return (
    <div className="sticky bottom-0 z-sticky mt-4 flex items-center justify-between gap-3 rounded-lg border border-border bg-surface p-3 shadow-lg">
      <span className="text-sm font-medium text-warning-subtle-foreground">You have unsaved changes.</span>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={footer.onDiscard} disabled={footer.saving}>
          Discard
        </Button>
        <Button size="sm" onClick={footer.onSave} disabled={footer.saving}>
          Save changes
        </Button>
      </div>
    </div>
  )
}

export function AccountSettingsWorkspace(_props: AccountSettingsWorkspaceProps) {
  return (
    <SettingsFooterProvider>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading settings…</p>}>
        <SettingsWorkspace />
      </Suspense>
    </SettingsFooterProvider>
  )
}
