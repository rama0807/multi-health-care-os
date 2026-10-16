import type { Metadata } from 'next'

import { NotificationPreferencesView } from '@/components/notifications/notification-preferences-view'

export const metadata: Metadata = {
  title: 'Notification Preferences | Grovyn Dental OS',
  description: 'Manage communication and notification channels in Grovyn Dental OS.',
}

export default function DentalNotificationPreferencesPage() {
  return <NotificationPreferencesView basePath="/dental" />
}
