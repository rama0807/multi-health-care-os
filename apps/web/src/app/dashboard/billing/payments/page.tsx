'use client'

import { useQuery } from '@tanstack/react-query'
import { Download, Loader2 } from 'lucide-react'
import Link from 'next/link'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
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
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Payments</h1>
        <p className="text-sm text-muted-foreground">
          {paymentsQuery.data ? `${paymentsQuery.data.pagination.total} payment${paymentsQuery.data.pagination.total === 1 ? '' : 's'}` : 'Loading...'}
        </p>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Receipt #</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Mode</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead>Paid at</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paymentsQuery.isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                </TableCell>
              </TableRow>
            ) : paymentsQuery.isError ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  Couldn&apos;t load payments. {getErrorMessage(paymentsQuery.error)}
                </TableCell>
              </TableRow>
            ) : payments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  No payments recorded yet.
                </TableCell>
              </TableRow>
            ) : (
              payments.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <Link href={`/dashboard/billing/invoices/${p.invoiceId}`} className="font-mono text-xs hover:underline">
                      {p.paymentNumber}
                    </Link>
                  </TableCell>
                  <TableCell>₹{p.amount}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{formatEnumLabel(p.paymentMode)}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{p.referenceNumber ?? p.transactionId ?? '—'}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{new Date(p.paidAt).toLocaleString('en-IN')}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => void downloadReceiptPdf(p.id, p.paymentNumber)}>
                      <Download className="h-3.5 w-3.5" />
                      Receipt
                    </Button>
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
