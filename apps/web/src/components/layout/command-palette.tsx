'use client'

import { useQuery } from '@tanstack/react-query'
import { Loader2, Search, Users } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'

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

import { flattenNavigation, quickActions } from './nav-config'

/**
 * Global ⌘K / Ctrl+K command palette - searches real patients (by name,
 * phone, or UHID) and doubles as quick navigation and quick creation across
 * every page the user has access to.
 *
 * Navigation and create actions come from `nav-config`, filtered by the same
 * permission check the sidebar uses, so the palette can never offer a page the
 * rail hides.
 */
export function CommandPalette() {
  const router = useRouter()
  const { hasPermission } = useAuth()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

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

  const navItems = useMemo(() => flattenNavigation(isVisible), [isVisible])
  const createItems = useMemo(
    () => quickActions.filter((action) => isVisible(action.permission)),
    [isVisible],
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
        <span className="truncate">Search patients, pages, actions…</span>
        <Kbd className="ml-auto flex-shrink-0">⌘K</Kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="Search patients, jump to a page, or start something new…"
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
                    onSelect={() => go(`/dashboard/patients/${patient.id}`)}
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
