'use client'

import { InsuranceClaimStatus } from '@medicore/types'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
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
import { listInsuranceClaims } from '@/lib/api/insurance'
import { useAuth } from '@/lib/auth/auth-context'

function formatEnumLabel(value: string): string {
  return value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, ' ')
}

export default function InsuranceClaimsQueuePage() {
  const router = useRouter()
  const { hasPermission } = useAuth()
  const canCreate = hasPermission('insurance.claims.create')
  const [statusFilter, setStatusFilter] = useState<InsuranceClaimStatus | 'ALL'>('ALL')

  const claimsQuery = useQuery({
    queryKey: ['insurance', 'claims', 'list', statusFilter],
    queryFn: () => listInsuranceClaims({ limit: 100, status: statusFilter === 'ALL' ? undefined : statusFilter }),
  })
  const claims = claimsQuery.data?.data ?? []

  return (
    <PageLayout
      title="Insurance Claims"
      description={
        claimsQuery.data
          ? `${claimsQuery.data.pagination.total} claim${claimsQuery.data.pagination.total === 1 ? '' : 's'}`
          : undefined
      }
      actions={
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as InsuranceClaimStatus | 'ALL')}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            {Object.values(InsuranceClaimStatus).map((s) => (
              <SelectItem key={s} value={s}>
                {formatEnumLabel(s)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      }
    >
      {claimsQuery.isLoading ? (
        <TableSkeleton rows={8} columns={7} />
      ) : claims.length === 0 ? (
        <EmptyState
          variant={statusFilter === 'ALL' ? 'empty' : 'search'}
          title="No claims yet"
          description={canCreate ? 'File one from a patient encounter.' : undefined}
        />
      ) : (
        <TableContainer className="max-h-[70vh]">
          <Table density="compact" container={false}>
            <TableHeader>
              <TableRow>
                <TableHead>Claim #</TableHead>
                <TableHead>Patient</TableHead>
                <TableHead>Insurer</TableHead>
                <TableHead align="right">Claimed</TableHead>
                <TableHead align="right">Approved</TableHead>
                <TableHead align="right">Outstanding</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {claims.map((c) => (
                <TableRow key={c.id} interactive onClick={() => router.push(`/dashboard/insurance/${c.id}`)}>
                  <TableCell>
                    <Link
                      href={`/dashboard/insurance/${c.id}`}
                      className="font-mono text-xs hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {c.claimNumber}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm">
                    {c.patient.fullName} <span className="text-xs text-muted-foreground">({c.patient.uhid})</span>
                  </TableCell>
                  <TableCell className="text-sm">{c.insuranceProvider}</TableCell>
                  <TableCell align="right">₹{c.claimedAmount}</TableCell>
                  <TableCell align="right">{c.approvedAmount ? `₹${c.approvedAmount}` : '—'}</TableCell>
                  <TableCell align="right">{c.outstandingAmount ? `₹${c.outstandingAmount}` : '—'}</TableCell>
                  <TableCell>
                    <StatusBadge status={c.status} />
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
