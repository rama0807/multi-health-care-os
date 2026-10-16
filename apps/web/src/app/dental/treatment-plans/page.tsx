/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unused-vars */
'use client'

import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { Plus, Search, FileText, CheckCircle2, Clock, XCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { dentalApi } from '@/lib/api/dental'
import { useAuth } from '@/lib/auth/auth-context'

export default function TreatmentPlansPage() {
  const router = useRouter()
  const { hasPermission } = useAuth()
  const [search, setSearch] = useState('')

  const { data: plansData, isLoading } = useQuery<any>({
    queryKey: ['dental-treatment-plans-global'],
    queryFn: async () => {
      const res = await dentalApi.listTreatmentPlans({
        patientId: ''
      })
      return res as any[]
    },
  })

  const plans = Array.isArray(plansData) ? plansData : (plansData?.data || [])

  const filteredPlans = plans.filter((plan: any) =>
    plan.title?.toLowerCase().includes(search.toLowerCase()) ||
    plan.patient?.firstName?.toLowerCase().includes(search.toLowerCase()) ||
    plan.patient?.lastName?.toLowerCase().includes(search.toLowerCase())
  )

  const getStatusBadge = (plan: any) => {
    // Determine status from the first option's acceptance status
    const option = plan.options?.[0]
    const status = option?.acceptance?.status || 'PENDING'

    if (status === 'ACCEPTED') return <Badge className="bg-emerald-500 hover:bg-emerald-600"><CheckCircle2 className="w-3 h-3 mr-1" /> Accepted</Badge>
    if (status === 'DECLINED') return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" /> Declined</Badge>
    return <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-900/20"><Clock className="w-3 h-3 mr-1" /> Pending</Badge>
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-500">
            Treatment Plans
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Manage and track patient treatment plans across the clinic.
          </p>
        </div>
        <div className="flex gap-2">
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search plans or patients..."
              className="pl-9 backdrop-blur-sm bg-white/50 dark:bg-zinc-900/50"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {hasPermission('dental_treatment_plans.create') && (
            <Button
              className="gap-2 shadow-lg shadow-blue-500/20"
              onClick={() => router.push('/dental/patients')}
            >
              <Plus className="h-4 w-4" />
              New Plan
            </Button>
          )}
        </div>
      </div>

      <Card className="border-0 shadow-xl shadow-slate-200/40 dark:shadow-none bg-white/60 dark:bg-zinc-950/60 backdrop-blur-xl">
        <CardHeader className="border-b border-border/50">
          <CardTitle>Active Plans</CardTitle>
          <CardDescription>A list of all proposed and active treatment plans.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center animate-pulse text-muted-foreground">Loading treatment plans...</div>
          ) : filteredPlans.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center">
              <div className="h-16 w-16 rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center mb-4">
                <FileText className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-lg font-medium">No treatment plans found</h3>
              <p className="text-muted-foreground mt-1 max-w-sm">
                Get started by creating a new treatment plan from a patient&apos;s chart.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="pl-6">Patient</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right pr-6">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPlans.map((plan: any) => (
                  <TableRow key={plan.id} className="hover:bg-muted/50 transition-colors">
                    <TableCell className="pl-6 font-medium">
                      {plan.patient?.firstName} {plan.patient?.lastName}
                    </TableCell>
                    <TableCell>{plan.title}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(plan.createdAt), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell>
                      ${plan.options?.[0]?.netCost || '0.00'}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(plan)}
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20">
                        View Details
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
