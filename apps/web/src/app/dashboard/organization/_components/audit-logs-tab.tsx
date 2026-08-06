'use client'

import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'

import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Pagination } from '@/components/ui/pagination'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { TableSkeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableContainer, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { getAuditFilterOptions, listAuditLogs } from '@/lib/api/organization'

import { formatDateTime, humanizeAction } from './format'

const ANY = '__any__'

export function AuditLogsTab() {
  const [page, setPage] = useState(1)
  const [action, setAction] = useState(ANY)
  const [resource, setResource] = useState(ANY)
  const [search, setSearch] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const filtersQuery = useQuery({
    queryKey: ['organization', 'audit-filters'],
    queryFn: getAuditFilterOptions,
  })

  const logsQuery = useQuery({
    queryKey: ['organization', 'audit-logs', { page, action, resource, search, from, to }],
    queryFn: () =>
      listAuditLogs({
        page,
        limit: 25,
        action: action === ANY ? undefined : action,
        resource: resource === ANY ? undefined : resource,
        search: search.trim() || undefined,
        from: from || undefined,
        to: to || undefined,
      }),
  })

  const rows = logsQuery.data?.data ?? []
  const pagination = logsQuery.data?.pagination
  const hasFilters = search.trim() !== '' || action !== ANY || resource !== ANY || from !== '' || to !== ''

  function onFilterChange<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value)
      setPage(1)
    }
  }

  return (
    <div className="space-y-4 pt-4">
      <Card className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="space-y-1">
          <Label htmlFor="audit-search">Search</Label>
          <Input
            id="audit-search"
            value={search}
            onChange={(e) => onFilterChange(setSearch)(e.target.value)}
            placeholder="Action or resource"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="audit-action">Action</Label>
          <Select value={action} onValueChange={onFilterChange(setAction)}>
            <SelectTrigger id="audit-action">
              <SelectValue placeholder="Any action" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Any action</SelectItem>
              {(filtersQuery.data?.actions ?? []).map((value) => (
                <SelectItem key={value} value={value}>
                  {humanizeAction(value)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="audit-resource">Resource</Label>
          <Select value={resource} onValueChange={onFilterChange(setResource)}>
            <SelectTrigger id="audit-resource">
              <SelectValue placeholder="Any resource" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Any resource</SelectItem>
              {(filtersQuery.data?.resources ?? []).map((value) => (
                <SelectItem key={value} value={value}>
                  {value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="audit-from">From</Label>
          <Input
            id="audit-from"
            type="date"
            value={from}
            onChange={(e) => onFilterChange(setFrom)(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="audit-to">To</Label>
          <Input
            id="audit-to"
            type="date"
            value={to}
            onChange={(e) => onFilterChange(setTo)(e.target.value)}
          />
        </div>
      </Card>

      {logsQuery.isLoading ? (
        <TableSkeleton rows={8} columns={5} />
      ) : rows.length === 0 ? (
        <EmptyState variant={hasFilters ? 'search' : 'empty'} title="No audit entries match these filters" />
      ) : (
        <TableContainer>
          <Table container={false}>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Resource</TableHead>
                <TableHead>By</TableHead>
                <TableHead>IP</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="whitespace-nowrap">{formatDateTime(row.createdAt)}</TableCell>
                  <TableCell className="font-medium">{humanizeAction(row.action)}</TableCell>
                  <TableCell>
                    {row.resource}
                    {row.resourceId && (
                      <span className="ml-1 text-xs text-muted-foreground">{row.resourceId}</span>
                    )}
                  </TableCell>
                  <TableCell>{row.userName ?? row.userEmail ?? 'System'}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {row.ipAddress ?? '-'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {pagination && pagination.totalPages > 1 && (
        <Pagination page={pagination.page} totalPages={pagination.totalPages} onPageChange={setPage} />
      )}

      <p className="text-xs text-muted-foreground">
        Audit entries are append-only and scoped to this organization - no other tenant&apos;s
        activity is visible here.
      </p>
    </div>
  )
}
