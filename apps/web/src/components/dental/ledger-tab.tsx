/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { useQuery } from '@tanstack/react-query'
import { CreditCard, DollarSign, FileText, Receipt } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { dentalApi } from '@/lib/api/dental'

interface LedgerTabProps {
  patientId: string
}

export function LedgerTab({ patientId }: LedgerTabProps) {
  const { data: invoices, isLoading } = useQuery<any[]>({
    queryKey: ['dental-ledger', patientId],
    queryFn: async () => {
      const res = await dentalApi.listLedger(patientId)
      return res?.data || res || []
    },
    enabled: !!patientId,
  })

  // Calculate totals
  const totalBilled = invoices?.reduce((acc, inv) => acc + Number(inv.totalAmount || 0), 0) || 0
  const totalPaid = invoices?.reduce((acc, inv) => acc + Number(inv.paidAmount || 0), 0) || 0
  const totalBalance = invoices?.reduce((acc, inv) => acc + Number(inv.balanceDue || 0), 0) || 0

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Patient Ledger</h2>
          <p className="text-muted-foreground">Financial overview and billing history.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Receipt className="h-4 w-4 mr-2" />
            New Payment
          </Button>
          <Button>
            <FileText className="h-4 w-4 mr-2" />
            Create Invoice
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900">
          <CardContent className="p-6">
            <div className="flex justify-between items-center space-y-0 pb-2">
              <p className="text-sm font-medium text-blue-900 dark:text-blue-300">Total Billed</p>
              <DollarSign className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
              ₹{totalBilled.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-green-50/50 dark:bg-green-950/20 border-green-200 dark:border-green-900">
          <CardContent className="p-6">
            <div className="flex justify-between items-center space-y-0 pb-2">
              <p className="text-sm font-medium text-green-900 dark:text-green-300">Total Paid</p>
              <CreditCard className="h-4 w-4 text-green-600 dark:text-green-400" />
            </div>
            <div className="text-2xl font-bold text-green-900 dark:text-green-100">
              ₹{totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-red-50/50 dark:bg-red-950/20 border-red-200 dark:border-red-900">
          <CardContent className="p-6">
            <div className="flex justify-between items-center space-y-0 pb-2">
              <p className="text-sm font-medium text-red-900 dark:text-red-300">Balance Due</p>
              <DollarSign className="h-4 w-4 text-red-600 dark:text-red-400" />
            </div>
            <div className="text-2xl font-bold text-red-900 dark:text-red-100">
              ₹{totalBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Invoices</CardTitle>
          <CardDescription>A history of all generated invoices for treatments and encounters.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center p-8 text-muted-foreground">Loading ledger...</div>
          ) : invoices && invoices.length > 0 ? (
            <div className="rounded-md border">
              <div className="grid grid-cols-6 p-4 font-medium text-sm bg-muted/50 border-b">
                <div className="col-span-2">Invoice #</div>
                <div>Date</div>
                <div>Total</div>
                <div>Balance</div>
                <div>Status</div>
              </div>
              <div className="divide-y">
                {invoices.map((inv) => (
                  <div key={inv.id} className="grid grid-cols-6 p-4 text-sm items-center hover:bg-muted/30">
                    <div className="col-span-2 font-medium">{inv.invoiceNumber}</div>
                    <div className="text-muted-foreground">{new Date(inv.createdAt).toLocaleDateString()}</div>
                    <div>₹{Number(inv.totalAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                    <div className={Number(inv.balanceDue) > 0 ? "text-red-600 font-medium" : "text-green-600 font-medium"}>
                      ₹{Number(inv.balanceDue).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                    <div>
                      <Badge variant={inv.status === 'PAID' ? 'default' : inv.status === 'DRAFT' ? 'secondary' : 'destructive'}>
                        {inv.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center p-12 border-2 border-dashed rounded-xl text-muted-foreground bg-muted/10">
              <Receipt className="h-8 w-8 mx-auto mb-3 opacity-20" />
              <p>No invoices found.</p>
              <p className="text-sm mt-1">Convert an accepted treatment plan or encounter into an invoice to get started.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
