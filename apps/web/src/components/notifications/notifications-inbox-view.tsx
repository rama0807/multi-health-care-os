'use client'

import {
  NotificationCategory,
  NotificationPriority,
  OrganizationType,
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
  Settings2,
  Trash2,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import * as React from 'react'

import { PageLayout } from '@/components/layout/page-layout'
import { humanCategory, relativeTime } from '@/components/notifications/notification-bell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Pagination } from '@/components/ui/pagination'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { FilterBar, SearchInput } from '@/components/ui/toolbar'
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
import { useAuth } from '@/lib/auth/auth-context'
import { cn } from '@/lib/utils'

const FILTERS: Array<{ value: NotificationInboxFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'unread', label: 'Unread' },
  { value: 'read', label: 'Read' },
  { value: 'pinned', label: 'Pinned' },
  { value: 'critical', label: 'Critical' },
]

const PAGE_SIZE = 20

export interface NotificationsInboxViewProps {
  basePath?: '/dashboard' | '/dental'
}

export function NotificationsInboxView({ basePath: explicitBasePath }: NotificationsInboxViewProps) {
  const [filter, setFilter] = React.useState<NotificationInboxFilter>('all')
  const [category, setCategory] = React.useState<string>('all')
  const [search, setSearch] = React.useState('')
  const [page, setPage] = React.useState(1)

  const { user } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const isDental = explicitBasePath
    ? explicitBasePath === '/dental'
    : pathname?.startsWith('/dental') || user?.organizationType === OrganizationType.DENTAL

  const basePath = explicitBasePath ?? (isDental ? '/dental' : '/dashboard')

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
    <PageLayout
      breadcrumbs={[
        { label: isDental ? 'Grovyn Dental OS' : 'Hospital OS', href: basePath },
        { label: 'Notifications' },
      ]}
      title="Notification Centre"
      description={`Everything ${isDental ? 'Grovyn Dental OS' : 'Grovyn Hospital OS'} has dispatched to you, newest first. Pinned alerts stay on top.`}
      actions={
        <>
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
            <Link href={`${basePath}/notifications/preferences`}>
              <Settings2 className="mr-1.5 h-4 w-4" />
              Preferences
            </Link>
          </Button>
        </>
      }
    >
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

      <FilterBar>
        <SearchInput
          value={search}
          onValueChange={(value) => {
            setSearch(value)
            setPage(1)
          }}
          placeholder="Search title or message"
        />

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
      </FilterBar>

      {isLoading && <p className="py-12 text-center text-sm text-muted-foreground">Loading…</p>}

      {!isLoading && notifications.length === 0 && (
        <EmptyState
          title={filter === 'all' ? 'Nothing here yet' : `No ${filter} notifications`}
          description={
            filter === 'all'
              ? 'Notifications appear as appointments, clinical results, invoices and activity happen.'
              : undefined
          }
        />
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
                      <Badge variant="danger">Critical</Badge>
                    )}
                    {notification.priority === NotificationPriority.HIGH && (
                      <Badge variant="neutral">High</Badge>
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
        <Pagination page={data.pagination.page} totalPages={data.pagination.totalPages} onPageChange={setPage} />
      )}
    </PageLayout>
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
