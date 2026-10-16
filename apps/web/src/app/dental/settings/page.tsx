import type { Metadata } from 'next'

import { AccountSettingsWorkspace } from '@/components/settings/account-settings-workspace'

export const metadata: Metadata = {
  title: 'Settings | Grovyn Dental OS',
  description: 'Manage personal account settings, security, appearance, and devices in Grovyn Dental OS.',
}

export default function DentalSettingsPage() {
  return <AccountSettingsWorkspace basePath="/dental" />
}
