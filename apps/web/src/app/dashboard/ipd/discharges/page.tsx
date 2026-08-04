'use client'

import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
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
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Discharges</h1>
        <p className="text-sm text-muted-foreground">Patients pending discharge and recently discharged.</p>
      </div>

      <Select value={filter} onValueChange={(v) => setFilter(v as Filter)}>
        <SelectTrigger className="w-56">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="pending">Pending discharge</SelectItem>
          <SelectItem value="discharged">Discharged</SelectItem>
        </SelectContent>
      </Select>

      <div className="rounded-lg border bg-card">
        <Table>
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
            {admissionsQuery.isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                </TableCell>
              </TableRow>
            ) : admissions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  {filter === 'pending' ? 'No admissions pending discharge.' : 'No discharges yet.'}
                </TableCell>
              </TableRow>
            ) : (
              admissions.map((a) => (
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
                    <Badge variant={filter === 'pending' ? 'outline' : 'secondary'}>
                      {filter === 'pending' ? 'Pending discharge' : 'Discharged'}
                    </Badge>
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
