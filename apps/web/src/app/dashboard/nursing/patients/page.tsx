'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { useState } from 'react'

import { PageLayout } from '@/components/layout/page-layout'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { TableSkeleton } from '@/components/ui/skeleton'
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

/**
 * "Assigned patients" — this repo has no per-nurse ward-assignment model, so
 * this is the full current patient census (every `ADMITTED` admission), the
 * same all-scope surface a nurse already sees on the bed grid. Search
 * narrows it to a specific patient/ward while on shift.
 */
export default function AssignedPatientsPage() {
  const [search, setSearch] = useState('')

  const admissionsQuery = useQuery({
    queryKey: ['ipd', 'census', search],
    queryFn: () => listAdmissions({ limit: 100, status: 'ADMITTED' as never, search: search || undefined }),
  })
  const admissions = admissionsQuery.data?.data ?? []

  return (
    <PageLayout
      title="Assigned Patients — Patient Census"
      description="Every currently admitted patient, across all wards."
    >
      <Input placeholder="Search by admission number…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-72" />

      {admissionsQuery.isLoading ? (
        <TableSkeleton rows={8} columns={5} />
      ) : admissions.length === 0 ? (
        <EmptyState variant={search ? 'search' : 'empty'} title="No inpatients currently admitted" />
      ) : (
        <TableContainer className="max-h-[70vh]">
          <Table density="compact" container={false}>
            <TableHeader>
              <TableRow>
                <TableHead>Patient</TableHead>
                <TableHead>Ward / Bed</TableHead>
                <TableHead>Attending doctor</TableHead>
                <TableHead>Admitted</TableHead>
                <TableHead>Diagnosis</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {admissions.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="text-sm">
                    <Link href={`/dashboard/ipd/${a.id}`} className="text-primary hover:underline">
                      {a.patient.fullName}
                    </Link>{' '}
                    <span className="font-mono text-xs text-muted-foreground">({a.patient.uhid})</span>
                  </TableCell>
                  <TableCell className="text-sm">
                    {a.ward.name} {a.bed ? `· Bed ${a.bed.bedNumber}` : '· No bed'}
                  </TableCell>
                  <TableCell className="text-sm">{a.attendingDoctor.fullName}</TableCell>
                  <TableCell className="text-sm">{formatDateTime(a.admittedAt)}</TableCell>
                  <TableCell className="text-sm">{a.diagnosis ?? '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </PageLayout>
  )
}
