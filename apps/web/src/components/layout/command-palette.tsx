/* eslint-disable @typescript-eslint/no-unsafe-enum-comparison */
'use client'

import { useQuery } from '@tanstack/react-query'
import { Loader2, Search, Users } from 'lucide-react'
import { usePathname, useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { flattenDentalNavigation, dentalQuickActions } from './dental-nav-config'
import { flattenNavigation, quickActions } from './nav-config'

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { Kbd } from '@/components/ui/progress'
import { listPatients } from '@/lib/api/patients'
import { useAuth } from '@/lib/auth/auth-context'


/**
 * Global ⌘K / Ctrl+K command palette - searches real patients (by name,
 * phone, or UHID) and doubles as quick navigation and quick creation across
 * every page the user has access to.
 *
 * Automatically adapts between Dental OS and Hospital OS:
 * - Dental OS: Searches patients, opens dental charts, provides dental quick actions (Odontogram, Lab Cases, etc.)
 * - Hospital OS: Searches patients, opens hospital dashboard, provides hospital quick actions
 */
export function CommandPalette({ basePath: explicitBasePath }: { basePath?: '/dashboard' | '/dental' } = {}) {
  const router = useRouter()
  const pathname = usePathname()
  const { user, hasPermission } = useAuth()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const isDental = explicitBasePath
    ? explicitBasePath === '/dental'
    : (pathname ? pathname.startsWith('/dental') : false) ||
    user?.organizationType === 'DENTAL' ||
    String(user?.organizationType).toUpperCase() === 'DENTAL'

  const basePath = explicitBasePath ?? (isDental ? '/dental' : '/dashboard')

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setOpen((prev) => !prev)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  const isVisible = useCallback(
    (permission?: string) => !permission || hasPermission(permission),
    [hasPermission],
  )

  const trimmedQuery = query.trim()
  const canSearchPatients = hasPermission('patients.read')

  const patientsQuery = useQuery({
    queryKey: ['command-palette', 'patients', trimmedQuery],
    queryFn: () => listPatients({ q: trimmedQuery, limit: 8 }),
    enabled: canSearchPatients && trimmedQuery.length >= 2,
  })

  const navItems = useMemo(
    () => (isDental ? flattenDentalNavigation(isVisible) : flattenNavigation(isVisible)),
    [isDental, isVisible],
  )

  const createItems = useMemo(
    () =>
      (isDental ? dentalQuickActions : quickActions).filter((action) =>
        isVisible(action.permission),
      ),
    [isDental, isVisible],
  )

  function go(href: string) {
    setOpen(false)
    setQuery('')
    router.push(href)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-8 w-full max-w-sm items-center gap-2 rounded-md border border-border bg-surface-secondary px-2.5 text-left text-sm text-muted-foreground transition-colors duration-fast hover:border-border-strong hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Search className="size-3.5 flex-shrink-0" aria-hidden="true" />
        <span className="truncate">
          {isDental ? 'Search dental patients, pages, actions…' : 'Search patients, pages, actions…'}
        </span>
        <Kbd className="ml-auto flex-shrink-0">⌘K</Kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder={
            isDental
              ? 'Search dental patients, jump to a page, or start something new…'
              : 'Search patients, jump to a page, or start something new…'
          }
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          <CommandEmpty>
            {canSearchPatients && trimmedQuery.length >= 2 && patientsQuery.isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="size-3.5 animate-spin" />
                Searching…
              </span>
            ) : (
              'No results found.'
            )}
          </CommandEmpty>

          {canSearchPatients &&
            trimmedQuery.length >= 2 &&
            patientsQuery.data &&
            patientsQuery.data.data.length > 0 && (
              <CommandGroup heading="Patients">
                {patientsQuery.data.data.map((patient) => (
                  <CommandItem
                    key={patient.id}
                    value={`patient-${patient.id}-${patient.fullName}-${patient.uhid}`}
                    onSelect={() => go(`${basePath}/patients/${patient.id}`)}
                  >
                    <Users className="mr-2 size-4 text-muted-foreground" />
                    <span className="truncate">{patient.fullName}</span>
                    <span className="ml-2 truncate font-mono text-xs text-muted-foreground">
                      {patient.uhid} · {patient.phone}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

          {createItems.length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Create">
                {createItems.map((action) => (
                  <CommandItem
                    key={`create-${action.href}`}
                    value={`create-${action.label}`}
                    onSelect={() => go(action.href)}
                  >
                    <action.icon className="mr-2 size-4 text-muted-foreground" />
                    {action.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}

          <CommandSeparator />
          <CommandGroup heading="Navigate">
            {navItems.map((item) => (
              <CommandItem
                key={item.href}
                value={`nav-${item.label}`}
                onSelect={() => go(item.href)}
              >
                <item.icon className="mr-2 size-4 text-muted-foreground" />
                <span className="truncate">{item.label}</span>
                <span className="ml-auto shrink-0 text-2xs uppercase tracking-wide text-subtle-foreground">
                  {item.section}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  )
}
