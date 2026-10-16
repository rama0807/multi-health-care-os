import type { Metadata } from 'next'

import { NotificationsInboxView } from '@/components/notifications/notifications-inbox-view'

export const metadata: Metadata = {
  title: 'Notifications | Grovyn Dental OS',
  description: 'View and manage notifications, alerts and announcements in Grovyn Dental OS.',
}

export default function DentalNotificationsPage() {
  return <NotificationsInboxView basePath="/dental" />
}
