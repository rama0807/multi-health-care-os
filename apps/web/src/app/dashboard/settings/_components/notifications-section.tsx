'use client'

import { useQuery } from '@tanstack/react-query'
import { ArrowRight, Bell } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SectionHeader } from '@/components/ui/page-header'
import { Skeleton } from '@/components/ui/skeleton'
import { getNotificationPreferences } from '@/lib/api/notifications'

const CHANNELS: Array<{ key: 'inAppEnabled' | 'emailEnabled' | 'pushEnabled' | 'smsEnabled' | 'whatsappEnabled'; label: string }> = [
  { key: 'inAppEnabled', label: 'In-app' },
  { key: 'emailEnabled', label: 'Email' },
  { key: 'pushEnabled', label: 'Push' },
  { key: 'smsEnabled', label: 'SMS' },
  { key: 'whatsappEnabled', label: 'WhatsApp' },
]

/**
 * A summary, not a second copy of `/dashboard/notifications/preferences` -
 * that page already owns channel toggles, quiet hours and category rules.
 * Duplicating its state here would just create two sources of truth for the
 * same settings, per this task's explicit instruction not to.
 */
export function NotificationsSection() {
  const pathname = usePathname()
  const isDental = pathname?.startsWith('/dental')
  const preferencesHref = isDental ? '/dental/notifications/preferences' : '/dashboard/notifications/preferences'

  const { data, isLoading } = useQuery({
    queryKey: ['notifications', 'preferences'],
    queryFn: getNotificationPreferences,
  })

  return (
    <div className="space-y-4">
      <SectionHeader title="Notifications" description="A quick summary - manage the details on the dedicated page." />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-1.5">
            <Bell className="size-4" aria-hidden="true" />
            Notification preferences
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading || !data ? (
            <Skeleton className="h-20 w-full" />
          ) : (
            <>
              <div className="space-y-1.5">
                <p className="text-xs font-medium uppercase tracking-wide text-subtle-foreground">
                  Primary channels enabled
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {CHANNELS.map((channel) => (
                    <Badge key={channel.key} variant={data[channel.key] ? 'default' : 'outline'} size="sm">
                      {channel.label}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-subtle-foreground">Critical alerts</p>
                  <p className="text-sm text-foreground">Always delivered, regardless of the settings below.</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-subtle-foreground">Quiet hours</p>
                  <p className="text-sm text-foreground">
                    {data.quietHoursStart && data.quietHoursEnd
                      ? `${data.quietHoursStart} – ${data.quietHoursEnd} (${data.timezone})`
                      : 'Not set'}
                  </p>
                </div>
              </div>
            </>
          )}

          <Button variant="outline" size="sm" asChild className="gap-1.5">
            <Link href={preferencesHref}>
              Manage notification preferences
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
