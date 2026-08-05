'use client'

import {
  NotificationCategory,
  NotificationPriority,
  NotificationStatus,
  type NotificationHistoryQuery,
} from '@medicore/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Clock, Loader2, RefreshCw, Send } from 'lucide-react'
import { useState } from 'react'

import { humanCategory, relativeTime } from '@/components/notifications/notification-bell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import {
  cancelScheduledNotification,
  getNotificationStats,
  getProviderStatuses,
  getQueueStatus,
  listNotificationHistory,
  listNotificationTemplates,
  retryFailedDeliveries,
  sendNotification,
  setTemplateActive,
} from '@/lib/api/notifications'

/**
 * Organization notification console (Checkpoint 18.6).
 *
 * Five tabs matching the milestone's list: history, failed deliveries (with
 * retry), scheduled sends, templates, and delivery statistics. Every number
 * shown comes from `NotificationStatsService`, which reports a rate over zero
 * attempts as *not measured* rather than as `0%`.
 */
export default function NotificationAdminPage() {
  const [tab, setTab] = useState('overview')
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const { data: stats } = useQuery({
    queryKey: ['notifications', 'admin', 'stats'],
    queryFn: () => getNotificationStats(),
  })
  const { data: queue } = useQuery({
    queryKey: ['notifications', 'admin', 'queue'],
    queryFn: getQueueStatus,
  })
  const { data: providers } = useQuery({
    queryKey: ['notifications', 'admin', 'providers'],
    queryFn: getProviderStatuses,
  })

  const retry = useMutation({
    mutationFn: (ids?: string[]) => retryFailedDeliveries(ids),
    onSuccess: async (requeued) => {
      await queryClient.invalidateQueries({ queryKey: ['notifications'] })
      toast({ title: `Re-queued ${requeued} failed delivery/deliveries` })
    },
    onError: (error: Error) => toast({ title: error.message, variant: 'destructive' }),
  })

  return (
    <div className="space-y-4 p-6">
      <div>
        <h1 className="text-xl font-semibold">Notification console</h1>
        <p className="text-sm text-muted-foreground">
          Delivery history, failures, schedules, templates and statistics for your organization.
        </p>
      </div>

      {queue && !queue.workerEnabled && (
        <Card className="flex items-start gap-2 border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
          <p className="text-amber-900 dark:text-amber-200">{queue.workerDisabledReason}</p>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Sent (30 days)" value={stats ? String(stats.total) : '—'} />
        <Stat
          label="Success rate"
          value={stats?.successRate ? `${stats.successRate}%` : 'Not measured'}
          muted={!stats?.successRate}
        />
        <Stat
          label="Failure rate"
          value={stats?.failureRate ? `${stats.failureRate}%` : 'Not measured'}
          muted={!stats?.failureRate}
        />
        <Stat label="In queue" value={queue ? String(queue.pending + queue.queued) : '—'} />
        <Stat label="Failed" value={queue ? String(queue.failed) : '—'} />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="overview">Delivery statistics</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="failed">Failed</TabsTrigger>
          <TabsTrigger value="scheduled">Scheduled</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="send">Send</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-3">
          <Card className="p-4">
            <h2 className="mb-3 text-sm font-semibold">By channel</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="pb-2">Channel</th>
                    <th className="pb-2">Attempted</th>
                    <th className="pb-2">Sent</th>
                    <th className="pb-2">Failed</th>
                    <th className="pb-2">Suppressed</th>
                    <th className="pb-2">Success</th>
                  </tr>
                </thead>
                <tbody>
                  {stats?.byChannel.map((row) => (
                    <tr key={row.channel} className="border-t">
                      <td className="py-2 font-medium">{humanCategory(row.channel)}</td>
                      <td className="py-2">{row.attempted}</td>
                      <td className="py-2">{row.sent}</td>
                      <td className="py-2">{row.failed}</td>
                      <td className="py-2 text-muted-foreground">{row.skipped}</td>
                      <td className="py-2">
                        {row.successRate ? (
                          `${row.successRate}%`
                        ) : (
                          <span className="text-muted-foreground">Not measured</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              &ldquo;Suppressed&rdquo; means a channel was skipped before any attempt — muted category, quiet
              hours, or no address on file. It is deliberately excluded from the success rate.
            </p>
          </Card>

          <Card className="p-4">
            <h2 className="mb-3 text-sm font-semibold">Providers</h2>
            <div className="space-y-2">
              {providers?.map((provider) => (
                <div
                  key={provider.channel}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2.5"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {humanCategory(provider.channel)}{' '}
                      <span className="text-xs text-muted-foreground">({provider.providerName})</span>
                    </p>
                    {provider.reason && (
                      <p className="text-xs text-muted-foreground">{provider.reason}</p>
                    )}
                  </div>
                  <Badge variant={provider.configured ? 'default' : 'outline'}>
                    {provider.configured ? 'Configured' : 'Not configured'}
                  </Badge>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <HistoryTable query={{}} />
        </TabsContent>

        <TabsContent value="failed" className="space-y-3">
          <div className="flex justify-end">
            <Button size="sm" variant="outline" disabled={retry.isPending} onClick={() => retry.mutate(undefined)}>
              {retry.isPending ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-1.5 h-4 w-4" />
              )}
              Retry all failed
            </Button>
          </div>
          <HistoryTable query={{ failedOnly: true }} showDeliveries />
        </TabsContent>

        <TabsContent value="scheduled">
          <HistoryTable query={{ scheduledOnly: true }} cancellable />
        </TabsContent>

        <TabsContent value="templates">
          <TemplatesTab />
        </TabsContent>

        <TabsContent value="send">
          <SendTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function Stat({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <Card className="p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-lg font-semibold ${muted ? 'text-muted-foreground' : ''}`}>{value}</p>
    </Card>
  )
}

function HistoryTable({
  query,
  showDeliveries,
  cancellable,
}: {
  query: NotificationHistoryQuery
  showDeliveries?: boolean
  cancellable?: boolean
}) {
  const [page, setPage] = useState(1)
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const { data, isLoading } = useQuery({
    queryKey: ['notifications', 'admin', 'history', query, page],
    queryFn: () => listNotificationHistory({ ...query, page, limit: 20 }),
  })

  const cancel = useMutation({
    mutationFn: (id: string) => cancelScheduledNotification(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['notifications'] })
      toast({ title: 'Scheduled notification cancelled' })
    },
    onError: (error: Error) => toast({ title: error.message, variant: 'destructive' }),
  })

  if (isLoading) return <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
  if (!data?.data.length) {
    return <Card className="py-12 text-center text-sm text-muted-foreground">Nothing to show.</Card>
  }

  return (
    <div className="space-y-3">
      <Card className="divide-y">
        {data.data.map((notification) => (
          <div key={notification.id} className="space-y-1.5 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium">{notification.title}</span>
              <Badge variant="outline">{humanCategory(notification.category)}</Badge>
              <Badge variant={notification.deliveryStatus === NotificationStatus.FAILED ? 'destructive' : 'secondary'}>
                {humanCategory(notification.deliveryStatus)}
              </Badge>
              {notification.scheduleAt && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {new Date(notification.scheduleAt).toLocaleString()}
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{notification.body}</p>
            <p className="text-xs text-muted-foreground">
              {notification.recipient
                ? `${notification.recipient.firstName} ${notification.recipient.lastName}`
                : 'Patient-addressed'}{' '}
              · {relativeTime(notification.createdAt)}
            </p>

            {showDeliveries &&
              notification.deliveries?.map((delivery) => (
                <p key={delivery.id} className="text-xs text-destructive">
                  {humanCategory(delivery.channel)} — {delivery.failureReason} (attempt {delivery.attempts})
                </p>
              ))}

            {cancellable && (
              <Button size="sm" variant="outline" onClick={() => cancel.mutate(notification.id)}>
                Cancel
              </Button>
            )}
          </div>
        ))}
      </Card>

      {data.pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Page {data.pagination.page} of {data.pagination.totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={!data.pagination.hasPrev}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!data.pagination.hasNext}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function TemplatesTab() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { data, isLoading } = useQuery({
    queryKey: ['notifications', 'admin', 'templates'],
    queryFn: () => listNotificationTemplates(),
  })

  const toggle = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => setTemplateActive(id, active),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['notifications', 'admin', 'templates'] })
      toast({ title: 'Template updated' })
    },
  })

  if (isLoading) return <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>

  return (
    <Card className="divide-y">
      <p className="p-3 text-xs text-muted-foreground">
        Templates marked <em>Bundled default</em> ship with MediCore. Editing one creates an organization
        override as a new version; earlier versions stay recoverable, and deactivating every override reverts
        to the bundled wording.
      </p>
      {data?.map((template) => (
        <div
          key={`${template.key}-${template.channel}-${template.version}`}
          className="flex flex-wrap items-start justify-between gap-3 p-3"
        >
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium">{template.name}</span>
              <Badge variant="outline">{humanCategory(template.channel)}</Badge>
              {template.isDefault ? (
                <Badge variant="secondary">Bundled default</Badge>
              ) : (
                <Badge>v{template.version}</Badge>
              )}
            </div>
            <p className="mt-1 truncate text-xs text-muted-foreground">{template.subjectTemplate}</p>
            <p className="truncate text-xs text-muted-foreground">{template.bodyTemplate}</p>
          </div>
          {!template.isDefault && template.id && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => toggle.mutate({ id: template.id!, active: !template.isActive })}
            >
              {template.isActive ? 'Deactivate' : 'Activate'}
            </Button>
          )}
        </div>
      ))}
    </Card>
  )
}

function SendTab() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [roles, setRoles] = useState('')
  const [category, setCategory] = useState<NotificationCategory>(NotificationCategory.SYSTEM)
  const [priority, setPriority] = useState<NotificationPriority>(NotificationPriority.NORMAL)
  const [scheduleAt, setScheduleAt] = useState('')

  const send = useMutation({
    mutationFn: () =>
      sendNotification({
        title,
        body,
        category,
        priority,
        roleSlugs: roles
          .split(',')
          .map((role) => role.trim())
          .filter(Boolean),
        scheduleAt: scheduleAt ? new Date(scheduleAt).toISOString() : undefined,
      }),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ['notifications'] })
      toast({ title: `Sent to ${result.created} recipient(s)` })
      setTitle('')
      setBody('')
    },
    onError: (error: Error) => toast({ title: error.message, variant: 'destructive' }),
  })

  return (
    <Card className="max-w-2xl space-y-3 p-4">
      <div className="space-y-1.5">
        <Label htmlFor="send-title">Title</Label>
        <Input id="send-title" value={title} onChange={(event) => setTitle(event.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="send-body">Message</Label>
        <Textarea id="send-body" rows={4} value={body} onChange={(event) => setBody(event.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="send-roles">Roles</Label>
        <Input
          id="send-roles"
          value={roles}
          onChange={(event) => setRoles(event.target.value)}
          placeholder="NURSE, RECEPTIONIST"
        />
        <p className="text-xs text-muted-foreground">
          Comma-separated system roles or custom role names. There is no user picker yet — see TECH_DEBT.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label>Category</Label>
          <Select value={category} onValueChange={(value) => setCategory(value as NotificationCategory)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.values(NotificationCategory).map((value) => (
                <SelectItem key={value} value={value}>
                  {humanCategory(value)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Priority</Label>
          <Select value={priority} onValueChange={(value) => setPriority(value as NotificationPriority)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.values(NotificationPriority).map((value) => (
                <SelectItem key={value} value={value}>
                  {humanCategory(value)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="send-schedule">Schedule (optional)</Label>
          <Input
            id="send-schedule"
            type="datetime-local"
            value={scheduleAt}
            onChange={(event) => setScheduleAt(event.target.value)}
          />
        </div>
      </div>
      <Button disabled={!title || !body || !roles || send.isPending} onClick={() => send.mutate()}>
        {send.isPending ? (
          <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
        ) : (
          <Send className="mr-1.5 h-4 w-4" />
        )}
        {scheduleAt ? 'Schedule' : 'Send now'}
      </Button>
    </Card>
  )
}

