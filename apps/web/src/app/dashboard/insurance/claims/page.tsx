'use client'

import { InsuranceClaimStatus } from '@medicore/types'
import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { listInsuranceClaims } from '@/lib/api/insurance'
import { useAuth } from '@/lib/auth/auth-context'

function formatEnumLabel(value: string): string {
  return value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, ' ')
}

const STATUS_BADGE: Record<string, 'secondary' | 'success' | 'destructive' | 'warning' | 'outline'> = {
  DRAFT: 'secondary',
  SUBMITTED: 'outline',
  UNDER_REVIEW: 'warning',
  APPROVED: 'warning',
  PARTIALLY_APPROVED: 'warning',
  REJECTED: 'destructive',
  SETTLED: 'success',
  PARTIALLY_SETTLED: 'success',
  CLOSED: 'secondary',
}

export default function InsuranceClaimsQueuePage() {
  const { hasPermission } = useAuth()
  const canCreate = hasPermission('insurance.claims.create')
  const [statusFilter, setStatusFilter] = useState<InsuranceClaimStatus | 'ALL'>('ALL')

  const claimsQuery = useQuery({
    queryKey: ['insurance', 'claims', 'list', statusFilter],
    queryFn: () => listInsuranceClaims({ limit: 100, status: statusFilter === 'ALL' ? undefined : statusFilter }),
  })
  const claims = claimsQuery.data?.data ?? []

  return (
    <div className="space-y-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Insurance Claims</h1>
          <p className="text-sm text-muted-foreground">
            {claimsQuery.data ? `${claimsQuery.data.pagination.total} claim${claimsQuery.data.pagination.total === 1 ? '' : 's'}` : 'Loading...'}
          </p>
        </div>
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
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Claim #</TableHead>
              <TableHead>Patient</TableHead>
              <TableHead>Insurer</TableHead>
              <TableHead>Claimed</TableHead>
              <TableHead>Approved</TableHead>
              <TableHead>Outstanding</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {claimsQuery.isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                </TableCell>
              </TableRow>
            ) : claims.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  {canCreate ? 'No claims yet — file one from a patient encounter.' : 'No claims yet.'}
                </TableCell>
              </TableRow>
            ) : (
              claims.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <Link href={`/dashboard/insurance/${c.id}`} className="font-mono text-xs hover:underline">
                      {c.claimNumber}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm">
                    {c.patient.fullName} <span className="text-xs text-muted-foreground">({c.patient.uhid})</span>
                  </TableCell>
                  <TableCell className="text-sm">{c.insuranceProvider}</TableCell>
                  <TableCell>₹{c.claimedAmount}</TableCell>
                  <TableCell>{c.approvedAmount ? `₹${c.approvedAmount}` : '—'}</TableCell>
                  <TableCell>{c.outstandingAmount ? `₹${c.outstandingAmount}` : '—'}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_BADGE[c.status]}>{formatEnumLabel(c.status)}</Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
