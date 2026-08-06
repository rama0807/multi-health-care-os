'use client'

import { BellRing, Laptop2, Loader2, ShieldCheck, Smartphone, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SectionHeader } from '@/components/ui/page-header'
import { usePushNotifications } from '@/lib/push/use-push-notifications'

import { parseUserAgent } from './format'
import { NotAvailableCard } from './not-available-card'

/**
 * "Browser push devices" is real - `UserDevice` + `/notifications/devices`,
 * the same data the notifications-preferences page shows. This section
 * frames it as a device inventory rather than a notification setting; it
 * doesn't fork the data or the mutations.
 *
 * "Mobile devices" and "trusted devices" are concepts this system doesn't
 * have - there's no native app, and no separate device-trust model beyond a
 * session (see Sessions).
 */
export function DevicesSection() {
  const push = usePushNotifications()
  const currentDevice = typeof navigator !== 'undefined' ? parseUserAgent(navigator.userAgent) : null

  return (
    <div className="space-y-4">
      <SectionHeader title="Devices" description="Where MediCore can reach you, and where it's currently signed in." />

      {currentDevice && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5">
              <Laptop2 className="size-4" aria-hidden="true" />
              This device
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-foreground">
              {currentDevice.browser} on {currentDevice.os}
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-1.5">
            <BellRing className="size-4" aria-hidden="true" />
            Browser push devices
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">Each browser you enable push in appears here.</p>
            <Button variant="outline" size="sm" disabled={push.isSubscribing} onClick={() => void push.subscribe()}>
              {push.isSubscribing ? (
                <Loader2 className="mr-1.5 size-3.5 animate-spin" />
              ) : (
                <BellRing className="mr-1.5 size-3.5" />
              )}
              Enable on this device
            </Button>
          </div>

          {push.config && !push.config.configured && (
            <p className="rounded-md border border-warning-border bg-warning-subtle p-2.5 text-xs text-warning-subtle-foreground">
              {push.config.reason}
            </p>
          )}
          {push.error && (
            <p className="rounded-md border border-danger-border bg-danger-subtle p-2.5 text-xs text-danger-subtle-foreground">
              {push.error}
            </p>
          )}
          {push.devices.length === 0 ? (
            <p className="text-xs text-muted-foreground">No devices registered.</p>
          ) : (
            push.devices.map((device) => (
              <div key={device.id} className="flex items-center justify-between rounded-md border p-2.5">
                <div>
                  <p className="text-sm">
                    {device.deviceName ?? `${device.browser ?? 'Browser'} device`}{' '}
                    <span className="text-xs text-muted-foreground">···{device.tokenSuffix}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">{device.isActive ? 'Active' : 'Inactive'}</p>
                </div>
                {device.isActive && (
                  <Button variant="ghost" size="sm" onClick={() => void push.removeDevice(device.id)}>
                    <Trash2 className="size-4" aria-hidden="true" />
                  </Button>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <NotAvailableCard
          icon={Smartphone}
          title="Mobile devices"
          description="There's no native mobile app yet - only browser push, above."
        />
        <NotAvailableCard
          icon={ShieldCheck}
          title="Trusted devices"
          description="Device trust for sign-in isn't a concept this system has beyond a session - see Sessions."
        />
      </div>
    </div>
  )
}
