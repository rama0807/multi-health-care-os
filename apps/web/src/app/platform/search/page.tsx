'use client'

import { useQuery } from '@tanstack/react-query'
import { Building2, Hospital, User } from 'lucide-react'
import { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { searchPlatform } from '@/lib/api/platform'

const ICONS = {
  ORGANIZATION: Building2,
  HOSPITAL: Hospital,
  USER: User,
} as const

export default function PlatformSearchPage() {
  const [term, setTerm] = useState('')
  const trimmed = term.trim()

  const query = useQuery({
    queryKey: ['platform', 'search', trimmed],
    queryFn: () => searchPlatform(trimmed, 25),
    // The API returns nothing below two characters; don't spend a round trip.
    enabled: trimmed.length >= 2,
  })

  const results = query.data ?? []

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Global search</h1>
        <p className="text-sm text-muted-foreground">
          Find an organization, hospital or user anywhere on the platform.
        </p>
      </div>

      <div className="rounded-lg border bg-card p-4">
        <div className="max-w-lg space-y-1">
          <Label htmlFor="platform-search">Search</Label>
          <Input
            id="platform-search"
            value={term}
            placeholder="Organization name, hospital code, user email…"
            onChange={(e) => setTerm(e.target.value)}
          />
        </div>
      </div>

      {trimmed.length > 0 && trimmed.length < 2 && (
        <p className="text-sm text-muted-foreground">Type at least two characters.</p>
      )}

      {query.isLoading && trimmed.length >= 2 && (
        <p className="text-sm text-muted-foreground">Searching…</p>
      )}

      {trimmed.length >= 2 && !query.isLoading && results.length === 0 && (
        <p className="text-sm text-muted-foreground">No matches.</p>
      )}

      {results.length > 0 && (
        <ul className="divide-y rounded-lg border bg-card">
          {results.map((result) => {
            const Icon = ICONS[result.type]
            return (
              <li key={`${result.type}-${result.id}`} className="flex items-center gap-3 p-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{result.title}</p>
                  <p className="truncate text-xs text-muted-foreground">{result.subtitle}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{result.organizationName}</span>
                  <Badge variant="secondary">{result.type.toLowerCase()}</Badge>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <p className="text-xs text-muted-foreground">
        Search covers tenant administration records only — organizations, hospitals and users. It
        deliberately does not search patients or clinical records.
      </p>
    </div>
  )
}
