'use client'

import {
  EmailDigestFrequency,
  NotificationCategory,
  NotificationChannel,
  type CategoryPreference,
  type UpdateNotificationPreferenceDto,
} from '@medicore/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, BellRing, Info, Loader2, MonitorSmartphone, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'

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
import { usePushNotifications } from '@/lib/push/use-push-notifications'

const CHANNEL_TOGGLES: Array<{
  key: 'inAppEnabled' | 'emailEnabled' | 'pushEnabled' | 'smsEnabled' | 'whatsappEnabled'
  label: string
  description: string
}> = [
  {
    key: 'inAppEnabled',
    label: 'In-app',
    description: 'The notification centre and the bell. This is the durable record of everything sent to you.',
  },
  { key: 'emailEnabled', label: 'Email', description: 'Sent to your account email address.' },
  { key: 'pushEnabled', label: 'Browser push', description: 'Requires a registered device below.' },
  { key: 'smsEnabled', label: 'SMS', description: 'Sent to the phone number on your profile.' },
  { key: 'whatsappEnabled', label: 'WhatsApp', description: 'Sent to the phone number on your profile.' },
]

const CATEGORY_CHANNELS = [
  NotificationChannel.IN_APP,
  NotificationChannel.PUSH,
  NotificationChannel.EMAIL,
  NotificationChannel.SMS,
  NotificationChannel.WHATSAPP,
]

/** Notification preferences (Checkpoint 18.5). */
export default function NotificationPreferencesPage() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const push = usePushNotifications()

  const { data, isLoading } = useQuery({
    queryKey: ['notifications', 'preferences'],
    queryFn: getNotificationPreferences,
  })

  const [draft, setDraft] = useState<UpdateNotificationPreferenceDto>({})
  const [categories, setCategories] = useState<Partial<Record<NotificationCategory, CategoryPreference>>>({})

  useEffect(() => {
    if (data) setCategories(data.categoryPreferences ?? {})
  }, [data])

  const save = useMutation({
    mutationFn: (dto: UpdateNotificationPreferenceDto) => updateNotificationPreferences(dto),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['notifications'] })
      setDraft({})
      toast({ title: 'Preferences saved' })
    },
    onError: (error: Error) => toast({ title: error.message, variant: 'destructive' }),
  })

  if (isLoading || !data) {
    return <p className="p-6 text-sm text-muted-foreground">Loading your preferences…</p>
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
    <div className="space-y-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href="/dashboard/notifications"
            className="mb-1 inline-flex items-center text-xs text-muted-foreground hover:underline"
          >
            <ArrowLeft className="mr-1 h-3 w-3" />
            Back to notifications
          </Link>
          <h1 className="text-xl font-semibold">Notification preferences</h1>
          <p className="text-sm text-muted-foreground">
            These apply to you only. Critical notifications always reach you regardless of what is set here.
          </p>
        </div>
        <Button
          disabled={!isDirty || save.isPending}
          onClick={() => save.mutate({ ...draft, categoryPreferences: categories })}
        >
          {save.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
          Save preferences
        </Button>
      </div>

      <Card className="flex items-start gap-2 border-primary/30 bg-primary/5 p-3 text-sm">
        <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
        <p className="text-muted-foreground">
          <strong className="text-foreground">Critical priority overrides every setting on this page</strong> —
          quiet hours, muted categories and disabled channels included. A critical lab value or a rejected claim
          reaching nobody because it was 23:00 is not an acceptable outcome in a hospital.
        </p>
      </Card>

      {/* ─── Channels ─────────────────────────────────────────────────────── */}
      <Card className="space-y-4 p-4">
        <div>
          <h2 className="text-sm font-semibold">Preferred channels</h2>
          <p className="text-xs text-muted-foreground">Which transports may carry your notifications.</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {CHANNEL_TOGGLES.map((channel) => (
            <label
              key={channel.key}
              className="flex cursor-pointer items-start gap-3 rounded-md border p-3 hover:bg-accent/40"
            >
              <Checkbox
                checked={Boolean(value[channel.key])}
                onCheckedChange={(checked) => set(channel.key, checked === true)}
                className="mt-0.5"
              />
              <span className="space-y-0.5">
                <span className="block text-sm font-medium">{channel.label}</span>
                <span className="block text-xs text-muted-foreground">{channel.description}</span>
              </span>
            </label>
          ))}
        </div>
      </Card>

      {/* ─── Quiet hours & email frequency ────────────────────────────────── */}
      <Card className="grid gap-4 p-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="quiet-start">Quiet hours start</Label>
          <Input
            id="quiet-start"
            type="time"
            value={value.quietHoursStart ?? ''}
            onChange={(event) => set('quietHoursStart', event.target.value || null)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="quiet-end">Quiet hours end</Label>
          <Input
            id="quiet-end"
            type="time"
            value={value.quietHoursEnd ?? ''}
            onChange={(event) => set('quietHoursEnd', event.target.value || null)}
          />
          <p className="text-xs text-muted-foreground">
            Evaluated in {value.timezone}. A window may cross midnight.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label>Email frequency</Label>
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
          <p className="text-xs text-muted-foreground">
            Digest batching is not yet implemented — anything other than Immediate or Never currently behaves as
            Immediate.
          </p>
        </div>
      </Card>

      {/* ─── Per-category ─────────────────────────────────────────────────── */}
      <Card className="space-y-3 p-4">
        <div>
          <h2 className="text-sm font-semibold">Category preferences</h2>
          <p className="text-xs text-muted-foreground">
            Mute a whole category, or restrict it to specific channels. A category left untouched follows the
            channel defaults above.
          </p>
        </div>

        <div className="space-y-2">
          {Object.values(NotificationCategory).map((category) => {
            const preference = categories[category] ?? { enabled: true }
            return (
              <div key={category} className="flex flex-wrap items-center gap-3 rounded-md border p-3">
                <label className="flex min-w-[10rem] cursor-pointer items-center gap-2">
                  <Checkbox
                    checked={preference.enabled !== false}
                    onCheckedChange={(checked) =>
                      setCategory(category, { ...preference, enabled: checked === true })
                    }
                  />
                  <span className="text-sm font-medium">{humanCategory(category)}</span>
                </label>

                <div className="flex flex-wrap items-center gap-2">
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
                          className="cursor-pointer"
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

      {/* ─── Devices (18.2) ───────────────────────────────────────────────── */}
      <Card className="space-y-3 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-1.5 text-sm font-semibold">
              <MonitorSmartphone className="h-4 w-4" />
              Browser push devices
            </h2>
            <p className="text-xs text-muted-foreground">
              Each browser you enable push in appears here. You can have several.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={push.isSubscribing}
            onClick={() => void push.subscribe()}
          >
            {push.isSubscribing ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <BellRing className="mr-1.5 h-4 w-4" />
            )}
            Enable on this device
          </Button>
        </div>

        {push.config && !push.config.configured && (
          <p className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2.5 text-xs text-amber-900 dark:text-amber-200">
            {push.config.reason}
          </p>
        )}

        {push.error && (
          <p className="rounded-md border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive">
            {push.error}
          </p>
        )}

        {push.devices.length === 0 && (
          <p className="text-xs text-muted-foreground">No devices registered.</p>
        )}

        {push.devices.map((device) => (
          <div key={device.id} className="flex items-center justify-between rounded-md border p-2.5">
            <div>
              <p className="text-sm">
                {device.deviceName ?? `${device.browser ?? 'Browser'} device`}{' '}
                <span className="text-xs text-muted-foreground">···{device.tokenSuffix}</span>
              </p>
              <p className="text-xs text-muted-foreground">
                {device.isActive ? 'Active' : 'Inactive'} · last seen {relativeTime(device.lastSeenAt)}
              </p>
            </div>
            {device.isActive && (
              <Button variant="ghost" size="sm" onClick={() => void push.removeDevice(device.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        ))}
      </Card>
    </div>
  )
}
