import type { Metadata } from 'next'

import { AccountSettingsWorkspace } from '@/components/settings/account-settings-workspace'

export const metadata: Metadata = {
  title: 'Settings | Grovyn Hospital OS',
  description: 'Manage personal account settings, security, appearance, and devices.',
}

export default function DashboardSettingsPage() {
  return <AccountSettingsWorkspace basePath="/dashboard" />
}
