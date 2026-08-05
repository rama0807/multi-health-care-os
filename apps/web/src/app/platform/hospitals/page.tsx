'use client'

import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { listPlatformHospitals } from '@/lib/api/platform'

import { formatDate } from '../../dashboard/organization/_components/format'

export default function PlatformHospitalsPage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')

  const query = useQuery({
    queryKey: ['platform', 'hospitals', { page, search }],
    queryFn: () => listPlatformHospitals({ page, limit: 25, search: search.trim() || undefined }),
  })

  const rows = query.data?.data ?? []
  const pagination = query.data?.pagination

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Hospitals</h1>
        <p className="text-sm text-muted-foreground">
          Every hospital across every tenant, with its owning organization.
        </p>
      </div>

      <div className="flex items-end gap-3 rounded-lg border bg-card p-4">
        <div className="w-72 space-y-1">
          <Label htmlFor="hospital-search">Search</Label>
          <Input
            id="hospital-search"
            value={search}
            placeholder="Hospital name, code, or organization"
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
          />
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Hospital</TableHead>
              <TableHead>Organization</TableHead>
              <TableHead>City</TableHead>
              <TableHead className="text-right">Departments</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {query.isLoading && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                  Loading hospitals…
                </TableCell>
              </TableRow>
            )}
            {!query.isLoading && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                  No hospitals match this search.
                </TableCell>
              </TableRow>
            )}
            {rows.map((hospital) => (
              <TableRow key={hospital.id}>
                <TableCell>
                  <p className="font-medium text-foreground">{hospital.name}</p>
                  <p className="text-xs text-muted-foreground">{hospital.code}</p>
                </TableCell>
                <TableCell>
                  <p className="text-sm">{hospital.organizationName}</p>
                  <p className="text-xs text-muted-foreground">{hospital.organizationSlug}</p>
                </TableCell>
                <TableCell>{hospital.city ?? '—'}</TableCell>
                <TableCell className="text-right">{hospital.departmentCount}</TableCell>
                <TableCell>{formatDate(hospital.createdAt)}</TableCell>
                <TableCell>
                  <Badge variant={hospital.isActive ? 'default' : 'secondary'}>
                    {hospital.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {pagination && pagination.total > 0 && (
        <div className="flex items-center justify-between text-sm">
          <p className="text-muted-foreground">
            Page {pagination.page} of {pagination.totalPages} · {pagination.total} hospitals
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!pagination.hasPrev}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!pagination.hasNext}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        This view is read-only. A hospital is activated, edited or deactivated by its own
        organization&apos;s administrators.
      </p>
    </div>
  )
}
