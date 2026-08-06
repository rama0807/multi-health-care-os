'use client'

import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { listPlatformAuditLogs } from '@/lib/api/platform'

import { formatDateTime, humanizeAction } from '../../dashboard/organization/_components/format'

export default function PlatformAuditPage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [organizationId, setOrganizationId] = useState('')

  const query = useQuery({
    queryKey: ['platform', 'audit-logs', { page, search, organizationId }],
    queryFn: () =>
      listPlatformAuditLogs({
        page,
        limit: 25,
        search: search.trim() || undefined,
        organizationId: organizationId.trim() || undefined,
      }),
  })

  const rows = query.data?.data ?? []
  const pagination = query.data?.pagination

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Global audit log</h1>
        <p className="text-sm text-muted-foreground">
          Every audited action across every tenant, newest first.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-4">
        <div className="w-64 space-y-1">
          <Label htmlFor="audit-search">Search</Label>
          <Input
            id="audit-search"
            value={search}
            placeholder="Action or resource"
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
          />
        </div>
        <div className="w-64 space-y-1">
          <Label htmlFor="audit-org">Organization ID</Label>
          <Input
            id="audit-org"
            value={organizationId}
            placeholder="Filter to one tenant"
            onChange={(e) => {
              setOrganizationId(e.target.value)
              setPage(1)
            }}
          />
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Organization</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Resource</TableHead>
              <TableHead>By</TableHead>
              <TableHead>IP</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {query.isLoading && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                  Loading audit log…
                </TableCell>
              </TableRow>
            )}
            {!query.isLoading && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                  No audit entries match these filters.
                </TableCell>
              </TableRow>
            )}
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="whitespace-nowrap">{formatDateTime(row.createdAt)}</TableCell>
                <TableCell>{row.organizationName}</TableCell>
                <TableCell className="font-medium">{humanizeAction(row.action)}</TableCell>
                <TableCell>{row.resource}</TableCell>
                <TableCell>{row.userEmail ?? 'System'}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {row.ipAddress ?? '-'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {pagination && pagination.total > 0 && (
        <div className="flex items-center justify-between text-sm">
          <p className="text-muted-foreground">
            Page {pagination.page} of {pagination.totalPages} · {pagination.total} entries
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
        Before/after snapshots are omitted from this cross-tenant view - they can contain tenant
        business data. Open the tenant&apos;s own audit log for the full record.
      </p>
    </div>
  )
}
