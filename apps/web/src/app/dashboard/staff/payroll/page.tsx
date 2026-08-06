'use client'

import { useMutation, useQuery } from '@tanstack/react-query'
import { Download, Loader2 } from 'lucide-react'
import { useState } from 'react'

import { PageLayout } from '@/components/layout/page-layout'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { TableSkeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableContainer, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'
import { downloadPayrollExport, getPayrollSummary } from '@/lib/api/payroll'

function getErrorMessage(error: unknown): string {
  const axiosError = error as { response?: { data?: { error?: { message?: string } } } }
  return axiosError?.response?.data?.error?.message ?? 'Something went wrong. Please try again.'
}

export default function PayrollPage() {
  const { toast } = useToast()
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7))

  const summaryQuery = useQuery({ queryKey: ['payroll', 'summary', month], queryFn: () => getPayrollSummary({ month }) })

  const exportMutation = useMutation({
    mutationFn: () => downloadPayrollExport({ month }),
    onError: (error) => toast({ variant: 'destructive', title: 'Export failed', description: getErrorMessage(error) }),
  })

  const entries = summaryQuery.data?.entries ?? []

  return (
    <PageLayout
      title="Payroll Preparation"
      description="Attendance summaries, overtime, and leave deductions — export only, no pay-run processing."
      width="full"
      actions={
        <>
          <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-44" />
          <Button variant="outline" onClick={() => exportMutation.mutate()} disabled={exportMutation.isPending}>
            {exportMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Export CSV
          </Button>
        </>
      }
    >
      {summaryQuery.isLoading ? (
        <TableSkeleton rows={8} columns={12} />
      ) : entries.length === 0 ? (
        <EmptyState title="No staff found for this period" />
      ) : (
        <TableContainer>
          <Table density="compact" container={false}>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Department</TableHead>
                <TableHead align="right">Present</TableHead>
                <TableHead align="right">Late</TableHead>
                <TableHead align="right">Half day</TableHead>
                <TableHead align="right">Absent</TableHead>
                <TableHead align="right">Paid leave</TableHead>
                <TableHead align="right">Unpaid leave</TableHead>
                <TableHead align="right">Overtime (mins)</TableHead>
                <TableHead align="right">Overtime (₹)</TableHead>
                <TableHead align="right">Leave deduction (₹)</TableHead>
                <TableHead align="right">Net payable days</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => (
                <TableRow key={entry.staffId}>
                  <TableCell className="font-medium">
                    {entry.fullName}
                    <span className="ml-1 text-xs text-muted-foreground">({entry.employeeId})</span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{entry.departmentName ?? '—'}</TableCell>
                  <TableCell align="right">{entry.daysPresent}</TableCell>
                  <TableCell align="right">{entry.daysLate}</TableCell>
                  <TableCell align="right">{entry.daysHalfDay}</TableCell>
                  <TableCell align="right">{entry.daysAbsent}</TableCell>
                  <TableCell align="right">{entry.paidLeaveDays}</TableCell>
                  <TableCell align="right">{entry.unpaidLeaveDays}</TableCell>
                  <TableCell align="right">{entry.overtimeMinutes}</TableCell>
                  <TableCell align="right">{entry.overtimeAmount != null ? `₹${entry.overtimeAmount.toLocaleString('en-IN')}` : '—'}</TableCell>
                  <TableCell align="right">
                    {entry.leaveDeductionAmount != null ? `₹${entry.leaveDeductionAmount.toLocaleString('en-IN')}` : '—'}
                  </TableCell>
                  <TableCell align="right" className="font-medium">{entry.netPayableDays}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </PageLayout>
  )
}
