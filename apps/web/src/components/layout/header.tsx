/* eslint-disable @typescript-eslint/no-unsafe-enum-comparison */
/* eslint-disable import/order */
'use client'

import { CheckSquare, LogOut, Monitor, Moon, Settings, SlidersHorizontal, Sparkles, Sun, User } from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import * as React from 'react'

import { NotificationBell } from '@/components/notifications/notification-bell'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useAuth } from '@/lib/auth/auth-context'
import { initials } from '@/lib/format'

import { CommandPalette } from './command-palette'
import { HospitalSelector } from './hospital-selector'

/**
 * The application command bar.
 *
 * Left: working context and global search. Right: the four things a clinical
 * user reaches for mid-task - tasks, AI, notifications, and their own account.
 *
 * Every destination here is permission-gated against a page that exists. An
 * icon button that opens a 403 or a 404 is worse than an absent one, because it
 * teaches the user that parts of the product are broken.
 */
export interface HeaderProps {
  basePath?: '/dashboard' | '/dental'
}

export function Header({ basePath: explicitBasePath }: HeaderProps = {}) {
  const { user, logout, hasPermission } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  const isDental = explicitBasePath
    ? explicitBasePath === '/dental'
    : (pathname ? pathname.startsWith('/dental') : false) ||
    user?.organizationType === 'DENTAL' ||
    String(user?.organizationType).toUpperCase() === 'DENTAL'

  const basePath = explicitBasePath ?? (isDental ? '/dental' : '/dashboard')
  const profileHref = `${basePath}/profile`
  const notificationPreferencesHref = `${basePath}/notifications/preferences`
  const settingsHref = `${basePath}/settings`

  async function handleLogout() {
    await logout()
    router.push('/login')
  }

  return (
    <TooltipProvider delayDuration={400}>
      <header className="flex h-header flex-shrink-0 items-center gap-3 border-b bg-surface px-4">
        {!isDental && <HospitalSelector />}
        <CommandPalette basePath={basePath} />

        <div className="ml-auto flex items-center gap-1">
          {!isDental && hasPermission('ipd.tasks.read') && (
            <IconLink
              href="/dashboard/nursing/tasks"
              label="Tasks"
              icon={CheckSquare}
            />
          )}

          {!isDental && hasPermission('ai.read') && (
            <IconLink href="/dashboard/ai" label="AI assistant" icon={Sparkles} />
          )}

          <NotificationBell basePath={basePath} />

          <ThemeToggle />

          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger className="ml-1 flex items-center rounded-full outline-none ring-offset-background transition-shadow focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                <Avatar className="size-7">
                  {user.avatar ? <AvatarImage src={user.avatar} alt="" /> : null}
                  <AvatarFallback className="bg-primary-subtle text-2xs font-semibold text-primary-subtle-foreground">
                    {initials(user.firstName, user.lastName)}
                  </AvatarFallback>
                </Avatar>
                <span className="sr-only">Account menu</span>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuLabel>
                  <div className="flex flex-col space-y-0.5">
                    <p className="truncate text-sm font-medium">
                      {user.firstName} {user.lastName}
                    </p>
                    <p className="truncate text-xs font-normal text-muted-foreground">
                      {user.email}
                    </p>
                    {user.roles.length > 0 && (
                      <p className="truncate text-xs font-normal text-muted-foreground">
                        {user.roles.join(', ')}
                      </p>
                    )}
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild className="cursor-pointer">
                  <Link href={profileHref} className="flex w-full items-center gap-2">
                    <User className="size-4" />
                    Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="cursor-pointer">
                  <Link href={notificationPreferencesHref} className="flex w-full items-center gap-2">
                    <Settings className="size-4" />
                    Notification preferences
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="cursor-pointer">
                  <Link href={settingsHref} className="flex w-full items-center gap-2">
                    <SlidersHorizontal className="size-4" />
                    Account settings
                  </Link>
                </DropdownMenuItem>
                {user.isPlatform && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild className="cursor-pointer">
                      <Link href="/platform" className="flex w-full items-center gap-2">
                        <Monitor className="size-4" />
                        Platform console
                      </Link>
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => void handleLogout()} className="cursor-pointer">
                  <LogOut className="size-4" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </header>
    </TooltipProvider>
  )
}

function IconLink({
  href,
  label,
  icon: Icon,
}: {
  href: string
  label: string
  icon: React.ElementType
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon-sm" asChild aria-label={label}>
          <Link href={href}>
            <Icon />
          </Link>
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

/**
 * Light / dark / system.
 *
 * Dark mode is a fully re-derived palette in this design system, not an
 * inversion, and a tenant's branding is derived separately for it - so this is
 * a first-class control rather than a novelty. Renders a neutral placeholder
 * until mounted: reading the resolved theme during SSR is what causes the
 * icon to flip on hydration.
 */
function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => setMounted(true), [])

  const next = resolvedTheme === 'dark' ? 'light' : 'dark'
  const Icon = !mounted ? Sun : resolvedTheme === 'dark' ? Moon : Sun

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setTheme(next)}
          aria-label={mounted ? `Switch to ${next} theme` : 'Toggle theme'}
        >
          <Icon />
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {mounted && theme === 'system' ? 'Following system theme' : `Switch to ${next} theme`}
      </TooltipContent>
    </Tooltip>
  )
}
