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

import { PageLayout } from '@/components/layout/page-layout'
import { humanCategory, relativeTime } from '@/components/notifications/notification-bell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Pagination } from '@/components/ui/pagination'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { StatCard, StatCardGrid } from '@/components/ui/stat-card'
import { StatusBadge } from '@/components/ui/status-badge'
import { Table, TableBody, TableCell, TableContainer, TableHead, TableHeader, TableRow } from '@/components/ui/table'
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
    <PageLayout
      title="Notification console"
      description="Delivery history, failures, schedules, templates and statistics for your organization."
    >
      {queue && !queue.workerEnabled && (
        <Card className="flex items-start gap-2 border-warning-border bg-warning-subtle p-3 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-warning-subtle-foreground" />
          <p className="text-warning-subtle-foreground">{queue.workerDisabledReason}</p>
        </Card>
      )}

      <StatCardGrid columns={5}>
        <StatCard label="Sent (30 days)" value={stats ? stats.total : undefined} />
        <StatCard label="Success rate" value={stats?.successRate ? `${stats.successRate}%` : 'Not measured'} />
        <StatCard label="Failure rate" value={stats?.failureRate ? `${stats.failureRate}%` : 'Not measured'} />
        <StatCard label="In queue" value={queue ? queue.pending + queue.queued : undefined} />
        <StatCard label="Failed" value={queue ? queue.failed : undefined} tone={queue?.failed ? 'danger' : 'default'} />
      </StatCardGrid>

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
          <Card>
            <CardContent className="pt-4">
              <h2 className="mb-3 text-sm font-semibold">By channel</h2>
              <TableContainer className="rounded-none border-0">
                <Table density="compact" container={false}>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Channel</TableHead>
                      <TableHead align="right">Attempted</TableHead>
                      <TableHead align="right">Sent</TableHead>
                      <TableHead align="right">Failed</TableHead>
                      <TableHead align="right">Suppressed</TableHead>
                      <TableHead align="right">Success</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats?.byChannel.map((row) => (
                      <TableRow key={row.channel}>
                        <TableCell className="font-medium">{humanCategory(row.channel)}</TableCell>
                        <TableCell align="right">{row.attempted}</TableCell>
                        <TableCell align="right">{row.sent}</TableCell>
                        <TableCell align="right">{row.failed}</TableCell>
                        <TableCell align="right" className="text-muted-foreground">
                          {row.skipped}
                        </TableCell>
                        <TableCell align="right">
                          {row.successRate ? (
                            `${row.successRate}%`
                          ) : (
                            <span className="text-muted-foreground">Not measured</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              <p className="mt-3 text-xs text-muted-foreground">
                &ldquo;Suppressed&rdquo; means a channel was skipped before any attempt — muted category, quiet
                hours, or no address on file. It is deliberately excluded from the success rate.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <h2 className="mb-3 text-sm font-semibold">Providers</h2>
              <div className="space-y-2">
                {providers?.map((provider) => (
                  <div
                    key={provider.channel}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-2.5"
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
                    <Badge variant={provider.configured ? 'success' : 'neutral'}>
                      {provider.configured ? 'Configured' : 'Not configured'}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
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
    </PageLayout>
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
    return <EmptyState compact title="Nothing to show" />
  }

  return (
    <div className="space-y-3">
      <Card className="divide-y">
        {data.data.map((notification) => (
          <div key={notification.id} className="space-y-1.5 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium">{notification.title}</span>
              <Badge variant="outline">{humanCategory(notification.category)}</Badge>
              <StatusBadge
                status={notification.deliveryStatus}
                tone={notification.deliveryStatus === NotificationStatus.FAILED ? 'danger' : 'neutral'}
              />
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
                <p key={delivery.id} className="text-xs text-danger">
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
        <Pagination page={data.pagination.page} totalPages={data.pagination.totalPages} onPageChange={setPage} />
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
                <Badge variant="neutral">Bundled default</Badge>
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

