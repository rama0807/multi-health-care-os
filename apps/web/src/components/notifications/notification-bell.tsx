'use client'

import { NotificationPriority, type Notification } from '@medicore/types'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { Bell, Check, CheckCheck, Pin, Settings2 } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  getNotificationSummary,
  listNotifications,
  markAllNotificationsRead,
  markNotificationsRead,
} from '@/lib/api/notifications'
import { cn } from '@/lib/utils'

/** How often the bell re-checks. Long enough not to be chatty. */
const POLL_INTERVAL_MS = 60_000

/**
 * The global notification bell (Checkpoint 18.3).
 *
 * Polls a dedicated summary endpoint rather than fetching the list: the badge
 * needs four counters, and pulling twenty rows a minute for every logged-in
 * user to render a number would be wasteful. The list is only fetched when
 * the dropdown is actually opened.
 *
 * There is no websocket. Real-time delivery is what the push channel is for
 * (Checkpoint 18.2); a socket layer would be a second delivery mechanism to
 * operate for the same result, and is recorded in TECH_DEBT as a deliberate
 * omission rather than an oversight.
 */
export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const queryClient = useQueryClient()

  const { data: summary } = useQuery({
    queryKey: ['notifications', 'summary'],
    queryFn: getNotificationSummary,
    refetchInterval: POLL_INTERVAL_MS,
  })

  const { data: recent, isLoading } = useQuery({
    queryKey: ['notifications', 'recent'],
    queryFn: () => listNotifications({ limit: 8, filter: 'all' }),
    enabled: open,
  })

  const unread = summary?.unread ?? 0
  const critical = summary?.critical ?? 0

  async function invalidate() {
    await queryClient.invalidateQueries({ queryKey: ['notifications'] })
  }

  async function openNotification(notification: Notification) {
    setOpen(false)
    if (!notification.isRead) {
      await markNotificationsRead({ ids: [notification.id] })
      await invalidate()
    }
    router.push(notification.deepLink ?? `/dashboard/notifications?highlight=${notification.id}`)
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        className="relative rounded-md p-2 text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-accent-foreground"
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span
            className={cn(
              'absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold text-white',
              // Critical unread turns the badge red; ordinary unread stays
              // neutral, so the colour still means something when it appears.
              critical > 0 ? 'bg-destructive' : 'bg-primary',
            )}
          >
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <p className="text-sm font-medium">
            Notifications
            {unread > 0 && <span className="ml-1.5 text-xs text-muted-foreground">({unread} unread)</span>}
          </p>
          <div className="flex items-center gap-1">
            {unread > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => {
                  void markAllNotificationsRead().then(invalidate)
                }}
              >
                <CheckCheck className="mr-1 h-3.5 w-3.5" />
                Mark all read
              </Button>
            )}
            <Link
              href="/dashboard/notifications/preferences"
              onClick={() => setOpen(false)}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              aria-label="Notification preferences"
            >
              <Settings2 className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        <div className="max-h-[24rem] overflow-y-auto">
          {isLoading && <p className="px-3 py-6 text-center text-sm text-muted-foreground">Loading…</p>}

          {!isLoading && (recent?.data.length ?? 0) === 0 && (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              You have no notifications yet.
            </p>
          )}

          {recent?.data.map((notification) => (
            <button
              key={notification.id}
              type="button"
              onClick={() => void openNotification(notification)}
              className={cn(
                'flex w-full flex-col gap-1 border-b px-3 py-2.5 text-left transition-colors last:border-b-0 hover:bg-accent',
                !notification.isRead && 'bg-accent/40',
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="flex items-center gap-1.5 text-sm font-medium leading-tight">
                  {notification.isPinned && <Pin className="h-3 w-3 flex-shrink-0 text-muted-foreground" />}
                  {notification.title}
                </span>
                {notification.priority === NotificationPriority.CRITICAL && (
                  <Badge variant="destructive" className="flex-shrink-0 text-[10px]">
                    Critical
                  </Badge>
                )}
              </div>
              <p className="line-clamp-2 text-xs text-muted-foreground">{notification.body}</p>
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <span>{relativeTime(notification.createdAt)}</span>
                <span aria-hidden>·</span>
                <span>{humanCategory(notification.category)}</span>
                {notification.isRead && <Check className="h-3 w-3" aria-label="Read" />}
              </div>
            </button>
          ))}
        </div>

        <div className="border-t px-3 py-2">
          <Link
            href="/dashboard/notifications"
            onClick={() => setOpen(false)}
            className="block text-center text-xs font-medium text-primary hover:underline"
          >
            View all notifications
          </Link>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function relativeTime(iso: string): string {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true })
  } catch {
    return iso
  }
}

/** `LAB_RESULT_READY` reads badly in a UI; `Laboratory` does not. */
export function humanCategory(value: string): string {
  return value
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}
