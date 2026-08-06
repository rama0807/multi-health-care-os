'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { useState } from 'react'

import { PageLayout } from '@/components/layout/page-layout'
import { EmptyState } from '@/components/ui/empty-state'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { TableSkeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/ui/status-badge'
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { listAdmissions } from '@/lib/api/ipd'

function formatDateTime(value: string | Date): string {
  return new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
}

type Filter = 'pending' | 'discharged'

export default function DischargesPage() {
  const [filter, setFilter] = useState<Filter>('pending')

  const admissionsQuery = useQuery({
    queryKey: ['ipd', 'discharges', filter],
    queryFn: () =>
      filter === 'pending'
        ? listAdmissions({ limit: 100, pendingDischarge: true })
        : listAdmissions({ limit: 100, status: 'DISCHARGED' as never }),
  })
  const admissions = admissionsQuery.data?.data ?? []

  return (
    <PageLayout
      breadcrumbs={[{ label: 'IPD', href: '/dashboard/ipd' }, { label: 'Discharges' }]}
      title="Discharges"
      description="Patients pending discharge and recently discharged."
    >
      <Select value={filter} onValueChange={(v) => setFilter(v as Filter)}>
        <SelectTrigger className="w-56">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="pending">Pending discharge</SelectItem>
          <SelectItem value="discharged">Discharged</SelectItem>
        </SelectContent>
      </Select>

      {admissionsQuery.isLoading ? (
        <TableSkeleton rows={6} columns={6} />
      ) : admissions.length === 0 ? (
        <EmptyState title={filter === 'pending' ? 'No admissions pending discharge' : 'No discharges yet'} />
      ) : (
        <TableContainer className="max-h-[65vh]">
          <Table density="compact" container={false}>
            <TableHeader>
              <TableRow>
                <TableHead>Admission #</TableHead>
                <TableHead>Patient</TableHead>
                <TableHead>Attending doctor</TableHead>
                <TableHead>Ward / Bed</TableHead>
                <TableHead>{filter === 'pending' ? 'Approved at' : 'Discharged at'}</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {admissions.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>
                    <Link href={`/dashboard/ipd/${a.id}`} className="font-mono text-xs text-primary hover:underline">
                      {a.admissionNumber}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm">
                    {a.patient.fullName} <span className="font-mono text-xs text-muted-foreground">({a.patient.uhid})</span>
                  </TableCell>
                  <TableCell className="text-sm">{a.attendingDoctor.fullName}</TableCell>
                  <TableCell className="text-sm">
                    {a.ward.name} {a.bed ? `· Bed ${a.bed.bedNumber}` : ''}
                  </TableCell>
                  <TableCell className="text-sm">
                    {filter === 'pending'
                      ? a.dischargeApprovedAt && formatDateTime(a.dischargeApprovedAt)
                      : a.dischargedAt && formatDateTime(a.dischargedAt)}
                  </TableCell>
                  <TableCell>
                    {filter === 'pending' ? (
                      <StatusBadge status="PENDING" label="Pending discharge" />
                    ) : (
                      <StatusBadge status="DISCHARGED" />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </PageLayout>
  )
}
