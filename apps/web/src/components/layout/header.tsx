'use client'

import { CheckSquare, LogOut, Monitor, Moon, Settings, Sparkles, Sun, User } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
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

import { CommandPalette } from './command-palette'
import { HospitalSelector } from './hospital-selector'

function initials(firstName: string, lastName: string): string {
  return `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase()
}

/**
 * The application command bar.
 *
 * Left: working context and global search. Right: the four things a clinical
 * user reaches for mid-task — tasks, AI, notifications, and their own account.
 *
 * Every destination here is permission-gated against a page that exists. An
 * icon button that opens a 403 or a 404 is worse than an absent one, because it
 * teaches the user that parts of the product are broken.
 */
export function Header() {
  const { user, logout, hasPermission } = useAuth()
  const router = useRouter()

  async function handleLogout() {
    await logout()
    router.push('/login')
  }

  return (
    <TooltipProvider delayDuration={400}>
      <header className="flex h-header flex-shrink-0 items-center gap-3 border-b bg-surface px-4">
        <HospitalSelector />
        <CommandPalette />

        <div className="ml-auto flex items-center gap-1">
          {hasPermission('ipd.tasks.read') && (
            <IconLink
              href="/dashboard/nursing/tasks"
              label="Tasks"
              icon={CheckSquare}
            />
          )}

          {hasPermission('ai.read') && (
            <IconLink href="/dashboard/ai" label="AI assistant" icon={Sparkles} />
          )}

          <NotificationBell />

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
                <DropdownMenuItem onClick={() => router.push('/dashboard/settings')}>
                  <User />
                  Profile
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push('/dashboard/notifications/preferences')}>
                  <Settings />
                  Notification preferences
                </DropdownMenuItem>
                {user.isPlatform && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => router.push('/platform')}>
                      <Monitor />
                      Platform console
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => void handleLogout()}>
                  <LogOut />
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
 * inversion, and a tenant's branding is derived separately for it — so this is
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
