'use client'

import { ChevronDown, PanelLeftClose, PanelLeftOpen, Plus } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import * as React from 'react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useAuth } from '@/lib/auth/auth-context'
import { cn } from '@/lib/utils'
import { useBranding } from '@/providers/branding-provider'
import { useWorkspace } from '@/providers/workspace-provider'

import { navigation, quickActions, type NavItem } from './nav-config'

// Re-exported so any module that imported these from the sidebar keeps working.
export { navigation } from './nav-config'
export type { NavItem, NavSection } from './nav-config'

const COLLAPSE_KEY = 'medicore.sidebar.collapsed'

/**
 * The primary navigation rail.
 *
 * Design notes:
 *
 * - **Collapse is persisted**, because it is a workstation preference, not a
 *   per-visit one: a triage desk on a 1366px screen wants icons permanently,
 *   and re-collapsing on every page load is a papercut repeated fifty times a
 *   shift. Collapsed items keep their labels as tooltips, so the rail never
 *   becomes a row of unlabelled glyphs.
 * - **The active item carries the organization's brand colour** - a tinted
 *   background plus a left marker. Two signals, because the marker survives
 *   when the tint is too subtle on a given tenant's palette, and neither
 *   depends on colour alone.
 * - **A parent group auto-opens on the route it owns.** Landing on
 *   `/dashboard/billing/invoices` from a link must not leave Billing collapsed;
 *   the user needs to see where they are.
 */
export function Sidebar() {
  const pathname = usePathname()
  const { user, hasPermission } = useAuth()
  const { displayName, logo } = useBranding()
  const [collapsed, setCollapsed] = React.useState(false)

  // Read the stored preference after mount: reading localStorage during render
  // would produce a server/client markup mismatch.
  React.useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(COLLAPSE_KEY) === 'true')
    } catch {
      /* preference unavailable - default expanded */
    }
  }, [])

  const toggleCollapsed = React.useCallback(() => {
    setCollapsed((previous) => {
      const next = !previous
      try {
        window.localStorage.setItem(COLLAPSE_KEY, String(next))
      } catch {
        /* non-fatal */
      }
      return next
    })
  }, [])

  const visibleActions = quickActions.filter(
    (action) => !action.permission || hasPermission(action.permission),
  )

  return (
    <TooltipProvider delayDuration={300}>
      <aside
        data-collapsed={collapsed}
        style={{ width: collapsed ? 'var(--sidebar-width-collapsed)' : 'var(--sidebar-width)' }}
        className="flex h-screen flex-shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-slow"
      >
        <WorkspaceSwitcher collapsed={collapsed} displayName={displayName} logo={logo} />

        {visibleActions.length > 0 && (
          <div className={cn('px-2 pb-1 pt-2', collapsed && 'px-1.5')}>
            <QuickCreate collapsed={collapsed} actions={visibleActions} />
          </div>
        )}

        <nav
          aria-label="Main"
          className={cn('flex-1 overflow-y-auto overflow-x-hidden px-2 py-2', collapsed && 'px-1.5')}
        >
          {navigation.map((section, index) => {
            const items = section.items.filter(
              (item) => !item.permission || hasPermission(item.permission),
            )
            if (items.length === 0) return null

            return (
              <div key={section.title || index} className="mb-3 last:mb-0">
                {section.title && !collapsed && (
                  <p className="mb-1 px-2 text-2xs font-semibold uppercase tracking-wider text-sidebar-muted">
                    {section.title}
                  </p>
                )}
                {section.title && collapsed && index > 0 && (
                  <div className="mx-2 mb-2 border-t border-sidebar-border" aria-hidden="true" />
                )}
                <ul className="space-y-0.5">
                  {items.map((item) => (
                    <NavEntry
                      key={item.href}
                      item={item}
                      pathname={pathname}
                      collapsed={collapsed}
                      hasPermission={hasPermission}
                    />
                  ))}
                </ul>
              </div>
            )
          })}
        </nav>

        <div className={cn('border-t border-sidebar-border p-2', collapsed && 'px-1.5')}>
          {!collapsed && user && (
            <p className="truncate px-2 pb-1.5 text-2xs text-sidebar-muted">
              {user.organizationSlug}
            </p>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={toggleCollapsed}
                aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                aria-expanded={!collapsed}
                className={cn(
                  'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-sidebar-muted transition-colors hover:bg-sidebar-item-hover hover:text-sidebar-foreground',
                  collapsed && 'justify-center px-0',
                )}
              >
                {collapsed ? (
                  <PanelLeftOpen className="size-4 shrink-0" />
                ) : (
                  <>
                    <PanelLeftClose className="size-4 shrink-0" />
                    Collapse
                  </>
                )}
              </button>
            </TooltipTrigger>
            {collapsed && <TooltipContent side="right">Expand sidebar</TooltipContent>}
          </Tooltip>
        </div>
      </aside>
    </TooltipProvider>
  )
}

/** `/dashboard` must not light up on `/dashboard/patients`. */
function isRouteActive(href: string, pathname: string): boolean {
  if (href === '/dashboard') return pathname === '/dashboard'
  return pathname === href || pathname.startsWith(href + '/')
}

function NavEntry({
  item,
  pathname,
  collapsed,
  hasPermission,
}: {
  item: NavItem
  pathname: string
  collapsed: boolean
  hasPermission: (permission: string) => boolean
}) {
  const children = (item.children ?? []).filter(
    (child) => !child.permission || hasPermission(child.permission),
  )
  // A single child that just repeats the parent's own route is not a group.
  const hasGroup = children.length > 1 && !collapsed
  const active = isRouteActive(item.href, pathname)

  const [open, setOpen] = React.useState(active)
  React.useEffect(() => {
    if (active) setOpen(true)
  }, [active])

  const link = (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'group relative flex items-center gap-2.5 rounded-md py-1.5 text-sm transition-colors duration-fast',
        collapsed ? 'justify-center px-0' : 'px-2',
        active
          ? 'bg-sidebar-item-active font-medium text-sidebar-item-active-foreground'
          : 'text-sidebar-muted hover:bg-sidebar-item-hover hover:text-sidebar-foreground',
      )}
    >
      {/* Second, non-colour signal for the active route. */}
      {active && (
        <span
          aria-hidden="true"
          className="absolute inset-y-1 left-0 w-0.5 rounded-full bg-primary"
        />
      )}
      <item.icon className="size-4 shrink-0" aria-hidden="true" />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </Link>
  )

  return (
    <li>
      <div className="relative flex items-center">
        {collapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="w-full">{link}</div>
            </TooltipTrigger>
            <TooltipContent side="right">{item.label}</TooltipContent>
          </Tooltip>
        ) : (
          <div className="min-w-0 flex-1">{link}</div>
        )}

        {hasGroup && (
          <button
            type="button"
            onClick={() => setOpen((previous) => !previous)}
            aria-label={`${open ? 'Collapse' : 'Expand'} ${item.label} section`}
            aria-expanded={open}
            className="absolute right-1 flex size-5 items-center justify-center rounded-xs text-sidebar-muted transition-colors hover:bg-sidebar-item-hover hover:text-sidebar-foreground"
          >
            <ChevronDown
              className={cn('size-3.5 transition-transform duration-fast', open && 'rotate-180')}
            />
          </button>
        )}
      </div>

      {hasGroup && open && (
        <ul className="ml-[1.4rem] mt-0.5 space-y-0.5 border-l border-sidebar-border pl-2">
          {children.map((child) => {
            const childActive = pathname === child.href
            return (
              <li key={child.href}>
                <Link
                  href={child.href}
                  aria-current={childActive ? 'page' : undefined}
                  className={cn(
                    'block truncate rounded-md px-2 py-1 text-xs transition-colors duration-fast',
                    childActive
                      ? 'bg-sidebar-item-active font-medium text-sidebar-item-active-foreground'
                      : 'text-sidebar-muted hover:bg-sidebar-item-hover hover:text-sidebar-foreground',
                  )}
                >
                  {child.label}
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </li>
  )
}

/**
 * Organization identity + hospital switcher.
 *
 * The logo and display name come from the tenant's branding (falling back to
 * the organization's real name), so the rail is the first thing that shows a
 * hospital it is *their* system.
 */
function WorkspaceSwitcher({
  collapsed,
  displayName,
  logo,
}: {
  collapsed: boolean
  displayName: string
  logo: string | null
}) {
  const { activeHospital, canSwitch } = useWorkspace()

  const mark = (
    <span className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-md bg-primary text-xs font-bold text-primary-foreground">
      {logo ? (
        // The logo is tenant-uploaded and served from this deployment's storage;
        // `unoptimized` avoids routing it through the image optimiser, which
        // would need every possible storage host allow-listed up front.
        <Image src={logo} alt="" width={28} height={28} className="size-full object-cover" unoptimized />
      ) : (
        displayName.trim().charAt(0).toUpperCase() || 'M'
      )}
    </span>
  )

  if (collapsed) {
    return (
      <div className="flex h-header items-center justify-center border-b border-sidebar-border px-1.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <div>{mark}</div>
          </TooltipTrigger>
          <TooltipContent side="right">
            {displayName}
            {activeHospital ? ` · ${activeHospital.name}` : ''}
          </TooltipContent>
        </Tooltip>
      </div>
    )
  }

  // Identity only. Switching hospitals lives in the top bar's
  // `<HospitalSelector>` - one control, one place, so the two can never show
  // different answers.
  const subtitle = activeHospital?.name ?? (canSwitch ? 'All hospitals' : 'Organization')

  return (
    <div className="flex h-header items-center gap-2 border-b border-sidebar-border px-3">
      {mark}
      <div className="min-w-0 leading-tight">
        <p className="truncate text-sm font-semibold">{displayName}</p>
        <p className="truncate text-2xs text-sidebar-muted">{subtitle}</p>
      </div>
    </div>
  )
}

function QuickCreate({
  collapsed,
  actions,
}: {
  collapsed: boolean
  actions: typeof quickActions
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size={collapsed ? 'icon-sm' : 'sm'}
          className={cn('w-full', collapsed && 'w-8')}
          aria-label="Quick create"
        >
          <Plus />
          {!collapsed && 'New'}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          Create
        </DropdownMenuLabel>
        {actions.map((action) => (
          <DropdownMenuItem key={action.href} asChild>
            <Link href={action.href} className="cursor-pointer">
              <action.icon className="text-muted-foreground" />
              <span className="flex-1">
                <span className="block">{action.label}</span>
                {action.description && (
                  <span className="block text-2xs text-muted-foreground">{action.description}</span>
                )}
              </span>
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
