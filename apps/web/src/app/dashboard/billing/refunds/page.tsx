'use client'

import { RefundStatus } from '@medicore/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'
import { approveRefund, listRefunds, rejectRefund } from '@/lib/api/billing'
import { useAuth } from '@/lib/auth/auth-context'

function getErrorMessage(error: unknown): string {
  const axiosError = error as { response?: { data?: { error?: { message?: string } } } }
  return axiosError?.response?.data?.error?.message ?? 'Something went wrong. Please try again.'
}

function formatEnumLabel(value: string): string {
  return value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, ' ')
}

const STATUS_BADGE: Record<string, 'secondary' | 'success' | 'destructive' | 'outline'> = {
  PENDING: 'secondary',
  COMPLETED: 'success',
  REJECTED: 'destructive',
  APPROVED: 'outline',
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
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Refunds</h1>
        <p className="text-sm text-muted-foreground">
          {refundsQuery.data ? `${refundsQuery.data.pagination.total} refund${refundsQuery.data.pagination.total === 1 ? '' : 's'}` : 'Loading...'}
        </p>
      </div>

      <Select value={status} onValueChange={setStatus}>
        <SelectTrigger className="sm:w-48">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          <SelectItem value="PENDING">Pending</SelectItem>
          <SelectItem value="COMPLETED">Completed</SelectItem>
          <SelectItem value="REJECTED">Rejected</SelectItem>
        </SelectContent>
      </Select>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Refund #</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {refundsQuery.isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                </TableCell>
              </TableRow>
            ) : refundsQuery.isError ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  Couldn&apos;t load refunds. {getErrorMessage(refundsQuery.error)}
                </TableCell>
              </TableRow>
            ) : refunds.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  No refunds found.
                </TableCell>
              </TableRow>
            ) : (
              refunds.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <Link href={`/dashboard/billing/invoices/${r.invoiceId}`} className="font-mono text-xs hover:underline">
                      {r.refundNumber}
                    </Link>
                  </TableCell>
                  <TableCell>₹{r.amount}</TableCell>
                  <TableCell className="max-w-xs truncate text-xs text-muted-foreground">{r.reason}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_BADGE[r.status]}>{formatEnumLabel(r.status)}</Badge>
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
                        <Link href={`/dashboard/billing/invoices/${r.invoiceId}`}>Open invoice</Link>
                      </Button>
                    )}
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
