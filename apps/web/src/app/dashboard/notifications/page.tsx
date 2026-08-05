'use client'

import {
  NotificationCategory,
  NotificationPriority,
  type Notification,
  type NotificationInboxFilter,
} from '@medicore/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Archive,
  ArchiveRestore,
  CheckCheck,
  Mail,
  MailOpen,
  Pin,
  PinOff,
  Search,
  Settings2,
  Trash2,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { humanCategory, relativeTime } from '@/components/notifications/notification-bell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import {
  archiveNotification,
  deleteNotification,
  listNotifications,
  markAllNotificationsRead,
  markNotificationUnread,
  markNotificationsRead,
  pinNotification,
  unarchiveNotification,
  unpinNotification,
} from '@/lib/api/notifications'
import { cn } from '@/lib/utils'

const FILTERS: Array<{ value: NotificationInboxFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'unread', label: 'Unread' },
  { value: 'read', label: 'Read' },
  { value: 'pinned', label: 'Pinned' },
  { value: 'critical', label: 'Critical' },
  { value: 'archived', label: 'Archived' },
]

const PAGE_SIZE = 20

/**
 * The full notification centre (Checkpoint 18.3).
 *
 * Timeline-shaped: pinned first, then newest, grouped by day. Every action a
 * user has over their own notifications lives here — read/unread, pin,
 * archive, delete, search, filter and paginate — while the bell in the header
 * stays a summary.
 */
export default function NotificationCentrePage() {
  const [filter, setFilter] = useState<NotificationInboxFilter>('all')
  const [category, setCategory] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const router = useRouter()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const query = {
    filter,
    page,
    limit: PAGE_SIZE,
    search: search.trim() || undefined,
    category: category === 'all' ? undefined : (category as NotificationCategory),
  }

  const { data, isLoading } = useQuery({
    queryKey: ['notifications', 'list', query],
    queryFn: () => listNotifications(query),
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['notifications'] })

  const mutate = useMutation({
    mutationFn: async ({ action, id }: { action: string; id: string }) => {
      switch (action) {
        case 'read':
          return markNotificationsRead({ ids: [id] })
        case 'unread':
          return markNotificationUnread(id)
        case 'pin':
          return pinNotification(id)
        case 'unpin':
          return unpinNotification(id)
        case 'archive':
          return archiveNotification(id)
        case 'unarchive':
          return unarchiveNotification(id)
        case 'delete':
          return deleteNotification(id)
        default:
          return undefined
      }
    },
    onSuccess: () => void invalidate(),
    onError: () => toast({ title: 'That action could not be completed', variant: 'destructive' }),
  })

  const notifications = data?.data ?? []
  const groups = groupByDay(notifications)

  function open(notification: Notification) {
    if (!notification.isRead) mutate.mutate({ action: 'read', id: notification.id })
    if (notification.deepLink) router.push(notification.deepLink)
  }

  return (
    <div className="space-y-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Notifications</h1>
          <p className="text-sm text-muted-foreground">
            Everything MediCore has sent you, newest first. Pinned items stay on top.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void markAllNotificationsRead().then(async (updated) => {
                await invalidate()
                toast({ title: `Marked ${updated} notification(s) as read` })
              })
            }}
          >
            <CheckCheck className="mr-1.5 h-4 w-4" />
            Mark all read
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard/notifications/preferences">
              <Settings2 className="mr-1.5 h-4 w-4" />
              Preferences
            </Link>
          </Button>
        </div>
      </div>

      <Card className="p-3">
        <div className="flex flex-wrap items-center gap-3">
          <Tabs
            value={filter}
            onValueChange={(value) => {
              setFilter(value as NotificationInboxFilter)
              setPage(1)
            }}
          >
            <TabsList>
              {FILTERS.map((entry) => (
                <TabsTrigger key={entry.value} value={entry.value}>
                  {entry.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <div className="relative min-w-[14rem] flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value)
                setPage(1)
              }}
              placeholder="Search title or message"
              className="pl-8"
            />
          </div>

          <Select
            value={category}
            onValueChange={(value) => {
              setCategory(value)
              setPage(1)
            }}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {Object.values(NotificationCategory).map((value) => (
                <SelectItem key={value} value={value}>
                  {humanCategory(value)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {isLoading && <p className="py-12 text-center text-sm text-muted-foreground">Loading…</p>}

      {!isLoading && notifications.length === 0 && (
        <Card className="py-16 text-center">
          <p className="text-sm text-muted-foreground">
            {filter === 'all'
              ? 'Nothing here yet. Notifications appear as appointments, results, invoices and other activity happen.'
              : `No ${filter} notifications.`}
          </p>
        </Card>
      )}

      {groups.map(([day, items]) => (
        <div key={day} className="space-y-2">
          <p className="px-1 text-xs font-medium uppercase tracking-widest text-muted-foreground">{day}</p>
          <Card className="divide-y">
            {items.map((notification) => (
              <div
                key={notification.id}
                className={cn(
                  'flex items-start gap-3 px-4 py-3 transition-colors hover:bg-accent/40',
                  !notification.isRead && 'bg-accent/30',
                )}
              >
                <button
                  type="button"
                  onClick={() => open(notification)}
                  className="flex-1 space-y-1 text-left"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    {notification.isPinned && <Pin className="h-3.5 w-3.5 text-muted-foreground" />}
                    <span className={cn('text-sm', !notification.isRead && 'font-semibold')}>
                      {notification.title}
                    </span>
                    {notification.priority === NotificationPriority.CRITICAL && (
                      <Badge variant="destructive">Critical</Badge>
                    )}
                    {notification.priority === NotificationPriority.HIGH && (
                      <Badge variant="secondary">High</Badge>
                    )}
                    <Badge variant="outline">{humanCategory(notification.category)}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{notification.body}</p>
                  <p className="text-xs text-muted-foreground">{relativeTime(notification.createdAt)}</p>
                </button>

                <div className="flex flex-shrink-0 items-center gap-0.5">
                  <IconAction
                    label={notification.isRead ? 'Mark unread' : 'Mark read'}
                    onClick={() =>
                      mutate.mutate({ action: notification.isRead ? 'unread' : 'read', id: notification.id })
                    }
                  >
                    {notification.isRead ? <Mail className="h-4 w-4" /> : <MailOpen className="h-4 w-4" />}
                  </IconAction>
                  <IconAction
                    label={notification.isPinned ? 'Unpin' : 'Pin'}
                    onClick={() =>
                      mutate.mutate({ action: notification.isPinned ? 'unpin' : 'pin', id: notification.id })
                    }
                  >
                    {notification.isPinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                  </IconAction>
                  <IconAction
                    label={notification.isArchived ? 'Restore' : 'Archive'}
                    onClick={() =>
                      mutate.mutate({
                        action: notification.isArchived ? 'unarchive' : 'archive',
                        id: notification.id,
                      })
                    }
                  >
                    {notification.isArchived ? (
                      <ArchiveRestore className="h-4 w-4" />
                    ) : (
                      <Archive className="h-4 w-4" />
                    )}
                  </IconAction>
                  <IconAction
                    label="Delete"
                    onClick={() => mutate.mutate({ action: 'delete', id: notification.id })}
                  >
                    <Trash2 className="h-4 w-4" />
                  </IconAction>
                </div>
              </div>
            ))}
          </Card>
        </div>
      ))}

      {data && data.pagination.totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-muted-foreground">
            Page {data.pagination.page} of {data.pagination.totalPages} · {data.pagination.total} total
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!data.pagination.hasPrev}
              onClick={() => setPage((current) => current - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!data.pagination.hasNext}
              onClick={() => setPage((current) => current + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function IconAction({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
    >
      {children}
    </button>
  )
}

/**
 * Groups into "Today"/"Yesterday"/a date, preserving the server's ordering
 * (pinned first, then newest) inside each group. Day keys are built from local
 * date parts, never `toISOString()`, which would shift the day in +05:30.
 */
function groupByDay(notifications: Notification[]): Array<[string, Notification[]]> {
  const groups = new Map<string, Notification[]>()

  for (const notification of notifications) {
    const label = dayLabel(new Date(notification.createdAt))
    const bucket = groups.get(label) ?? []
    bucket.push(notification)
    groups.set(label, bucket)
  }

  return [...groups.entries()]
}

function dayLabel(date: Date): string {
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)

  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

  if (sameDay(date, today)) return 'Today'
  if (sameDay(date, yesterday)) return 'Yesterday'
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })
}
