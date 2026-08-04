'use client'

import { useQuery } from '@tanstack/react-query'
import { Loader2, Search, Users } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { listPatients } from '@/lib/api/patients'
import { useAuth } from '@/lib/auth/auth-context'

import { navigation } from './sidebar'

/**
 * Global ⌘K / Ctrl+K command palette — searches real patients (by name,
 * phone, or UHID) and doubles as quick navigation across every page the
 * sidebar links to, filtered by the same permission check.
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

  const trimmedQuery = query.trim()
  const patientsQuery = useQuery({
    queryKey: ['command-palette', 'patients', trimmedQuery],
    queryFn: () => listPatients({ q: trimmedQuery, limit: 8 }),
    enabled: trimmedQuery.length >= 2,
  })

  function go(href: string) {
    setOpen(false)
    setQuery('')
    router.push(href)
  }

  const navItems = navigation.flatMap((section) =>
    section.items.filter((item) => !item.permission || hasPermission(item.permission)),
  )

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-80 items-center gap-2 rounded-md border bg-background px-3 py-1.5 text-left text-sm text-muted-foreground transition-colors hover:bg-accent"
      >
        <Search className="h-3.5 w-3.5 flex-shrink-0" />
        <span className="truncate">Search patients, appointments...</span>
        <kbd className="ml-auto flex-shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs">⌘K</kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search patients, or jump to a page..." value={query} onValueChange={setQuery} />
        <CommandList>
          <CommandEmpty>
            {trimmedQuery.length >= 2 && patientsQuery.isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Searching...
              </span>
            ) : (
              'No results found.'
            )}
          </CommandEmpty>

          {trimmedQuery.length >= 2 && patientsQuery.data && patientsQuery.data.data.length > 0 && (
            <CommandGroup heading="Patients">
              {patientsQuery.data.data.map((patient) => (
                <CommandItem
                  key={patient.id}
                  value={`patient-${patient.id}-${patient.fullName}-${patient.uhid}`}
                  onSelect={() => go(`/dashboard/patients/${patient.id}`)}
                >
                  <Users className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span>{patient.fullName}</span>
                  <span className="ml-2 font-mono text-xs text-muted-foreground">
                    {patient.uhid} · {patient.phone}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          <CommandGroup heading="Navigate">
            {navItems.map((item) => (
              <CommandItem key={item.href} value={`nav-${item.label}`} onSelect={() => go(item.href)}>
                <item.icon className="mr-2 h-4 w-4 text-muted-foreground" />
                {item.label}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  )
}
