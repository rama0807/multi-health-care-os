'use client'

import { RefundStatus } from '@medicore/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { useState } from 'react'

import { PageLayout } from '@/components/layout/page-layout'
import { Button } from '@/components/ui/button'
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
import { useToast } from '@/hooks/use-toast'
import { approveRefund, listRefunds, rejectRefund } from '@/lib/api/billing'
import { useAuth } from '@/lib/auth/auth-context'

function getErrorMessage(error: unknown): string {
  const axiosError = error as { response?: { data?: { error?: { message?: string } } } }
  return axiosError?.response?.data?.error?.message ?? 'Something went wrong. Please try again.'
}

export default function RefundsListPage() {
  const { hasPermission } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<string>('all')

  const canManage = hasPermission('billing.manage')

  const refundsQuery = useQuery({
    queryKey: ['billing', 'refunds', 'list', { status }],
    queryFn: () => listRefunds({ status: status === 'all' ? undefined : (status as never), limit: 100 }),
  })

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ['billing', 'refunds', 'list'] })
  }

  const approveMutation = useMutation({
    mutationFn: (id: string) => approveRefund(id),
    onSuccess: () => {
      toast({ title: 'Refund approved' })
      invalidate()
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Could not approve refund', description: getErrorMessage(error) }),
  })

  const rejectMutation = useMutation({
    mutationFn: (id: string) => rejectRefund(id, { reason: 'Not eligible' }),
    onSuccess: () => {
      toast({ title: 'Refund rejected' })
      invalidate()
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Could not reject refund', description: getErrorMessage(error) }),
  })

  const refunds = refundsQuery.data?.data ?? []

  return (
    <PageLayout
      title="Refunds"
      description={
        refundsQuery.data
          ? `${refundsQuery.data.pagination.total} refund${refundsQuery.data.pagination.total === 1 ? '' : 's'}`
          : undefined
      }
    >
      <Select value={status} onValueChange={setStatus}>
        <SelectTrigger className="w-48">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          <SelectItem value="PENDING">Pending</SelectItem>
          <SelectItem value="COMPLETED">Completed</SelectItem>
          <SelectItem value="REJECTED">Rejected</SelectItem>
        </SelectContent>
      </Select>

      {refundsQuery.isLoading ? (
        <TableSkeleton rows={8} columns={5} />
      ) : refundsQuery.isError ? (
        <EmptyState variant="error" title="Couldn't load refunds" description={getErrorMessage(refundsQuery.error)} />
      ) : refunds.length === 0 ? (
        <EmptyState variant="search" title="No refunds found" description="Try a different status filter." />
      ) : (
        <TableContainer className="max-h-[65vh]">
          <Table density="compact" container={false}>
            <TableHeader>
              <TableRow>
                <TableHead>Refund #</TableHead>
                <TableHead align="right">Amount</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-40" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {refunds.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <Link href={`/dental/billing/invoices/${r.invoiceId}`} className="font-mono text-xs hover:underline">
                      {r.refundNumber}
                    </Link>
                  </TableCell>
                  <TableCell align="right">₹{r.amount}</TableCell>
                  <TableCell className="max-w-xs truncate text-xs text-muted-foreground">{r.reason}</TableCell>
                  <TableCell>
                    <StatusBadge status={r.status} />
                  </TableCell>
                  <TableCell>
                    {canManage && r.status === RefundStatus.PENDING ? (
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => approveMutation.mutate(r.id)} disabled={approveMutation.isPending}>
                          Approve
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => rejectMutation.mutate(r.id)} disabled={rejectMutation.isPending}>
                          Reject
                        </Button>
                      </div>
                    ) : (
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/dental/billing/invoices/${r.invoiceId}`}>Open invoice</Link>
                      </Button>
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
