'use client'

import { useMutation, useQuery } from '@tanstack/react-query'
import { Download, Loader2 } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
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
    <div className="space-y-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Payroll Preparation</h1>
          <p className="text-sm text-muted-foreground">
            Attendance summaries, overtime, and leave deductions — export only, no pay-run processing.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-44" />
          <Button variant="outline" onClick={() => exportMutation.mutate()} disabled={exportMutation.isPending}>
            {exportMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Export CSV
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Department</TableHead>
              <TableHead className="text-right">Present</TableHead>
              <TableHead className="text-right">Late</TableHead>
              <TableHead className="text-right">Half day</TableHead>
              <TableHead className="text-right">Absent</TableHead>
              <TableHead className="text-right">Paid leave</TableHead>
              <TableHead className="text-right">Unpaid leave</TableHead>
              <TableHead className="text-right">Overtime (mins)</TableHead>
              <TableHead className="text-right">Overtime (₹)</TableHead>
              <TableHead className="text-right">Leave deduction (₹)</TableHead>
              <TableHead className="text-right">Net payable days</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {summaryQuery.isLoading ? (
              <TableRow>
                <TableCell colSpan={12} className="h-24 text-center text-muted-foreground">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                </TableCell>
              </TableRow>
            ) : entries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={12} className="h-24 text-center text-muted-foreground">
                  No staff found for this period.
                </TableCell>
              </TableRow>
            ) : (
              entries.map((entry) => (
                <TableRow key={entry.staffId}>
                  <TableCell className="font-medium">
                    {entry.fullName}
                    <span className="ml-1 text-xs text-muted-foreground">({entry.employeeId})</span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{entry.departmentName ?? '—'}</TableCell>
                  <TableCell className="text-right">{entry.daysPresent}</TableCell>
                  <TableCell className="text-right">{entry.daysLate}</TableCell>
                  <TableCell className="text-right">{entry.daysHalfDay}</TableCell>
                  <TableCell className="text-right">{entry.daysAbsent}</TableCell>
                  <TableCell className="text-right">{entry.paidLeaveDays}</TableCell>
                  <TableCell className="text-right">{entry.unpaidLeaveDays}</TableCell>
                  <TableCell className="text-right">{entry.overtimeMinutes}</TableCell>
                  <TableCell className="text-right">{entry.overtimeAmount != null ? `₹${entry.overtimeAmount.toLocaleString('en-IN')}` : '—'}</TableCell>
                  <TableCell className="text-right">
                    {entry.leaveDeductionAmount != null ? `₹${entry.leaveDeductionAmount.toLocaleString('en-IN')}` : '—'}
                  </TableCell>
                  <TableCell className="text-right font-medium">{entry.netPayableDays}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
