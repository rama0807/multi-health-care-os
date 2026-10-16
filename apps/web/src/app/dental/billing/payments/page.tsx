'use client'

import { useQuery } from '@tanstack/react-query'
import { Download } from 'lucide-react'
import Link from 'next/link'

import { PageLayout } from '@/components/layout/page-layout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
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
import { downloadReceiptPdf, listPayments } from '@/lib/api/billing'

function getErrorMessage(error: unknown): string {
  const axiosError = error as { response?: { data?: { error?: { message?: string } } } }
  return axiosError?.response?.data?.error?.message ?? 'Something went wrong. Please try again.'
}

function formatEnumLabel(value: string): string {
  return value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, ' ')
}

export default function PaymentsListPage() {
  const paymentsQuery = useQuery({
    queryKey: ['billing', 'payments', 'list'],
    queryFn: () => listPayments({ limit: 100 }),
  })

  const payments = paymentsQuery.data?.data ?? []

  return (
    <PageLayout
      title="Payments"
      description={
        paymentsQuery.data
          ? `${paymentsQuery.data.pagination.total} payment${paymentsQuery.data.pagination.total === 1 ? '' : 's'}`
          : undefined
      }
    >
      {paymentsQuery.isLoading ? (
        <TableSkeleton rows={8} columns={6} />
      ) : paymentsQuery.isError ? (
        <EmptyState variant="error" title="Couldn't load payments" description={getErrorMessage(paymentsQuery.error)} />
      ) : payments.length === 0 ? (
        <EmptyState title="No payments recorded yet" />
      ) : (
        <TableContainer className="max-h-[70vh]">
          <Table density="compact" container={false}>
            <TableHeader>
              <TableRow>
                <TableHead>Receipt #</TableHead>
                <TableHead align="right">Amount</TableHead>
                <TableHead>Mode</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Paid at</TableHead>
                <TableHead className="w-28" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <Link href={`/dental/billing/invoices/${p.invoiceId}`} className="font-mono text-xs hover:underline">
                      {p.paymentNumber}
                    </Link>
                  </TableCell>
                  <TableCell align="right">₹{p.amount}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{formatEnumLabel(p.paymentMode)}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{p.referenceNumber ?? p.transactionId ?? '-'}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{new Date(p.paidAt).toLocaleString('en-IN')}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => void downloadReceiptPdf(p.id, p.paymentNumber)}>
                      <Download className="h-3.5 w-3.5" />
                      Receipt
                    </Button>
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
