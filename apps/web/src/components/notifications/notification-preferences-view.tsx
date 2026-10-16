'use client'

import {
  EmailDigestFrequency,
  NotificationCategory,
  NotificationChannel,
  OrganizationType,
  type CategoryPreference,
  type UpdateNotificationPreferenceDto,
} from '@medicore/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BellRing, Check, Loader2, MonitorSmartphone, ShieldAlert, Trash2 } from 'lucide-react'
import { usePathname } from 'next/navigation'
import * as React from 'react'

import { PageLayout } from '@/components/layout/page-layout'
import { humanCategory, relativeTime } from '@/components/notifications/notification-bell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { getNotificationPreferences, updateNotificationPreferences } from '@/lib/api/notifications'
import { useAuth } from '@/lib/auth/auth-context'
import { usePushNotifications } from '@/lib/push/use-push-notifications'

const CHANNEL_TOGGLES: Array<{
  key: 'inAppEnabled' | 'emailEnabled' | 'pushEnabled' | 'smsEnabled' | 'whatsappEnabled'
  label: string
  description: string
}> = [
  {
    key: 'inAppEnabled',
    label: 'In-app notification bell',
    description: 'Real-time alert indicators and dropdown notification centre in the top bar.',
  },
  {
    key: 'emailEnabled',
    label: 'Email alerts & summaries',
    description: 'Sent directly to your account email address.',
  },
  {
    key: 'pushEnabled',
    label: 'Browser web push',
    description: 'Desktop notifications even when the application tab is in the background.',
  },
  {
    key: 'smsEnabled',
    label: 'SMS text messages',
    description: 'Urgent mobile notifications sent to your registered phone number.',
  },
  {
    key: 'whatsappEnabled',
    label: 'WhatsApp notifications',
    description: 'Structured notifications dispatched via encrypted WhatsApp business messaging.',
  },
]

const CATEGORY_CHANNELS = [
  NotificationChannel.IN_APP,
  NotificationChannel.PUSH,
  NotificationChannel.EMAIL,
  NotificationChannel.SMS,
  NotificationChannel.WHATSAPP,
]

export interface NotificationPreferencesViewProps {
  basePath?: '/dashboard' | '/dental'
}

export function NotificationPreferencesView({ basePath: explicitBasePath }: NotificationPreferencesViewProps) {
  const { user } = useAuth()
  const pathname = usePathname()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const push = usePushNotifications()

  const isDental = explicitBasePath
    ? explicitBasePath === '/dental'
    : pathname?.startsWith('/dental') || user?.organizationType === OrganizationType.DENTAL

  const basePath = explicitBasePath ?? (isDental ? '/dental' : '/dashboard')

  const { data, isLoading } = useQuery({
    queryKey: ['notifications', 'preferences'],
    queryFn: getNotificationPreferences,
  })

  const [draft, setDraft] = React.useState<UpdateNotificationPreferenceDto>({})
  const [categories, setCategories] = React.useState<Partial<Record<NotificationCategory, CategoryPreference>>>({})

  React.useEffect(() => {
    if (data) setCategories(data.categoryPreferences ?? {})
  }, [data])

  const save = useMutation({
    mutationFn: (dto: UpdateNotificationPreferenceDto) => updateNotificationPreferences(dto),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['notifications'] })
      setDraft({})
      toast({ title: 'Notification preferences saved successfully' })
    },
    onError: (error: Error) => toast({ title: error.message, variant: 'destructive' }),
  })

  if (isLoading || !data) {
    return (
      <PageLayout
        breadcrumbs={[
          { label: isDental ? 'Grovyn Dental OS' : 'Hospital OS', href: basePath },
          { label: 'Notifications', href: `${basePath}/notifications` },
          { label: 'Preferences' },
        ]}
        title="Notification Preferences"
        loading
      >
        <div />
      </PageLayout>
    )
  }

  const value = { ...data, ...draft }
  const isDirty = Object.keys(draft).length > 0 || categories !== data.categoryPreferences

  function set<K extends keyof UpdateNotificationPreferenceDto>(
    key: K,
    next: UpdateNotificationPreferenceDto[K],
  ) {
    setDraft((current) => ({ ...current, [key]: next }))
  }

  function setCategory(category: NotificationCategory, next: CategoryPreference) {
    setCategories((current) => ({ ...current, [category]: next }))
  }

  return (
    <PageLayout
      breadcrumbs={[
        { label: isDental ? 'Grovyn Dental OS' : 'Hospital OS', href: basePath },
        { label: 'Notifications', href: `${basePath}/notifications` },
        { label: 'Preferences' },
      ]}
      title="Notification Preferences"
      description={`Manage how and when you receive clinical alerts, appointment updates, and system notices in ${isDental ? 'Grovyn Dental OS' : 'Grovyn Hospital OS'}.`}
      actions={
        <Button
          disabled={!isDirty || save.isPending}
          onClick={() => save.mutate({ ...draft, categoryPreferences: categories })}
          className="gap-1.5"
        >
          {save.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Check className="h-4 w-4" />
          )}
          Save preferences
        </Button>
      }
    >
      {/* ─── Clinical Priority Notice ────────────────────────────────────────── */}
      <Card className="flex items-start gap-3 border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20 p-4 text-sm">
        <ShieldAlert className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600 dark:text-amber-400" />
        <div className="space-y-1 text-amber-900 dark:text-amber-200">
          <p className="font-semibold text-xs uppercase tracking-wide">
            Critical Clinical Alerts Override Quiet Hours
          </p>
          <p className="text-xs leading-relaxed text-amber-800/90 dark:text-amber-300/90">
            Critical priority alerts (e.g. urgent clinical updates, severe drug contraindications, or emergency chair dispatches)
            always bypass quiet hours and muted categories to ensure patient safety standards are never compromised.
          </p>
        </div>
      </Card>

      {/* ─── Preferred Channels ──────────────────────────────────────────────── */}
      <Card className="space-y-4 p-5">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-foreground">
            Notification Delivery Channels
          </h2>
          <p className="text-xs text-muted-foreground">
            Select the communication transports authorized to deliver your alerts and updates.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {CHANNEL_TOGGLES.map((channel) => (
            <label
              key={channel.key}
              className="flex cursor-pointer items-start gap-3 rounded-lg border border-border/80 bg-surface p-3.5 transition-colors hover:bg-muted/40 hover:border-primary/30"
            >
              <Checkbox
                checked={Boolean(value[channel.key])}
                onCheckedChange={(checked) => set(channel.key, checked === true)}
                className="mt-0.5"
              />
              <span className="space-y-0.5">
                <span className="block text-sm font-medium text-foreground">{channel.label}</span>
                <span className="block text-xs text-muted-foreground leading-normal">{channel.description}</span>
              </span>
            </label>
          ))}
        </div>
      </Card>

      {/* ─── Quiet Hours & Digest Frequency ──────────────────────────────────── */}
      <Card className="grid gap-5 p-5 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="quiet-start" className="text-xs font-medium">Quiet hours start</Label>
          <Input
            id="quiet-start"
            type="time"
            value={value.quietHoursStart ?? ''}
            onChange={(event) => set('quietHoursStart', event.target.value || null)}
          />
          <p className="text-2xs text-muted-foreground">Mutes non-critical sounds &amp; popups.</p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="quiet-end" className="text-xs font-medium">Quiet hours end</Label>
          <Input
            id="quiet-end"
            type="time"
            value={value.quietHoursEnd ?? ''}
            onChange={(event) => set('quietHoursEnd', event.target.value || null)}
          />
          <p className="text-2xs text-muted-foreground">
            Operating timezone: {value.timezone ?? 'Asia/Kolkata'}.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Email summary frequency</Label>
          <Select
            value={value.emailFrequency}
            onValueChange={(next) => set('emailFrequency', next as EmailDigestFrequency)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.values(EmailDigestFrequency).map((frequency) => (
                <SelectItem key={frequency} value={frequency}>
                  {humanCategory(frequency)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-2xs text-muted-foreground">
            Cadence for non-urgent notification batching.
          </p>
        </div>
      </Card>

      {/* ─── Category Specific Preferences ───────────────────────────────────── */}
      <Card className="space-y-4 p-5">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-foreground">
            Per-Category Alert Customization
          </h2>
          <p className="text-xs text-muted-foreground">
            Fine-tune delivery channels for specific types of healthcare events. Untouched categories follow default channels.
          </p>
        </div>

        <div className="space-y-2.5">
          {Object.values(NotificationCategory).map((category) => {
            const preference = categories[category] ?? { enabled: true }
            return (
              <div
                key={category}
                className="flex flex-col gap-3 rounded-lg border border-border/80 bg-surface p-3.5 sm:flex-row sm:items-center sm:justify-between"
              >
                <label className="flex cursor-pointer items-center gap-2.5 sm:min-w-[12rem]">
                  <Checkbox
                    checked={preference.enabled !== false}
                    onCheckedChange={(checked) =>
                      setCategory(category, { ...preference, enabled: checked === true })
                    }
                  />
                  <span className="text-sm font-medium text-foreground">
                    {humanCategory(category)}
                  </span>
                </label>

                <div className="flex flex-wrap items-center gap-1.5">
                  {CATEGORY_CHANNELS.map((channel) => {
                    const selected = preference.channels?.includes(channel) ?? true
                    return (
                      <button
                        key={channel}
                        type="button"
                        disabled={preference.enabled === false}
                        onClick={() => {
                          const current = preference.channels ?? CATEGORY_CHANNELS
                          const next = current.includes(channel)
                            ? current.filter((entry) => entry !== channel)
                            : [...current, channel]
                          setCategory(category, { ...preference, channels: next })
                        }}
                      >
                        <Badge
                          variant={selected && preference.enabled !== false ? 'default' : 'outline'}
                          className="cursor-pointer text-xs"
                        >
                          {humanCategory(channel)}
                        </Badge>
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </Card>

      {/* ─── Browser Push Devices ────────────────────────────────────────────── */}
      <Card className="space-y-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-1.5 text-sm font-semibold tracking-tight text-foreground">
              <MonitorSmartphone className="h-4 w-4 text-primary" />
              Registered Push Devices
            </h2>
            <p className="text-xs text-muted-foreground">
              Browsers and workstations configured to receive native OS desktop alerts.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={push.isSubscribing}
            onClick={() => void push.subscribe()}
            className="gap-1.5"
          >
            {push.isSubscribing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <BellRing className="h-3.5 w-3.5" />
            )}
            Enable on this browser
          </Button>
        </div>

        {push.config && !push.config.configured && (
          <p className="rounded-md border border-amber-500/20 bg-amber-50/50 dark:bg-amber-950/20 p-2.5 text-xs text-amber-800 dark:text-amber-300">
            {push.config.reason}
          </p>
        )}

        {push.error && (
          <p className="rounded-md border border-destructive/20 bg-destructive/10 p-2.5 text-xs text-destructive">
            {push.error}
          </p>
        )}

        {push.devices.length === 0 && (
          <div className="rounded-lg border border-dashed p-6 text-center text-xs text-muted-foreground">
            No active browser push devices registered yet. Click &quot;Enable on this browser&quot; above to receive instant desktop alerts.
          </div>
        )}

        {push.devices.map((device) => (
          <div key={device.id} className="flex items-center justify-between rounded-lg border p-3">
            <div className="space-y-0.5">
              <p className="text-sm font-medium text-foreground">
                {device.deviceName ?? `${device.browser ?? 'Browser'} Device`}{' '}
                <span className="text-xs text-muted-foreground">···{device.tokenSuffix}</span>
              </p>
              <p className="text-xs text-muted-foreground">
                {device.isActive ? 'Active' : 'Inactive'} · Last seen {relativeTime(device.lastSeenAt)}
              </p>
            </div>
            {device.isActive && (
              <Button variant="ghost" size="sm" onClick={() => void push.removeDevice(device.id)}>
                <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
              </Button>
            )}
          </div>
        ))}
      </Card>
    </PageLayout>
  )
}
