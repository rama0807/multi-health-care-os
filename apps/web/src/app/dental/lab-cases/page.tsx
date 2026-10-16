/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unused-vars */
'use client'

import { useQuery } from '@tanstack/react-query'
import { Plus, Search, Truck, Clock, CheckCircle2, AlertCircle } from 'lucide-react'
import { useState } from 'react'

import { LabCaseDetailsSheet } from '@/components/dental/lab-case-details-sheet'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { dentalApi } from '@/lib/api/dental'

export default function LabCasesPage() {

  const [selectedCase, setSelectedCase] = useState<any>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['dental-lab-cases'],
    queryFn: () => dentalApi.listLabCases(),
  })

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300"><Clock className="h-3 w-3" /> Draft</span>
      case 'SENT_TO_VENDOR':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"><Truck className="h-3 w-3" /> Sent to Lab</span>
      case 'RECEIVED':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"><CheckCircle2 className="h-3 w-3" /> Received</span>
      case 'REMAKE':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"><AlertCircle className="h-3 w-3" /> Remake</span>
      default:
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"><Clock className="h-3 w-3" /> {status.replace(/_/g, ' ')}</span>
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-500">
            Lab Cases
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Track and manage dental prosthetics and lab requests.
          </p>
        </div>
        <Button className="gap-2 shadow-lg shadow-blue-500/20">
          <Plus className="h-4 w-4" />
          New Lab Case
        </Button>
      </div>

      <Card className="border-0 shadow-xl shadow-slate-200/40 dark:shadow-none bg-white/60 dark:bg-zinc-950/60 backdrop-blur-xl">
        <CardHeader className="border-b border-border/50 bg-muted/20 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Truck className="h-4 w-4" />
              <CardTitle className="text-base font-medium">All Lab Cases</CardTitle>
            </div>
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input type="search" placeholder="Search by patient or ID..." className="pl-9 bg-background/50" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead>Case ID</TableHead>
                <TableHead>Patient</TableHead>
                <TableHead>Restoration</TableHead>
                <TableHead>Lab / Vendor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-6 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-16 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : data?.data?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                    No lab cases found.
                  </TableCell>
                </TableRow>
              ) : (
                data?.data?.map((labCase: any) => (
                  <TableRow key={labCase.id} className="hover:bg-muted/50 transition-colors">
                    <TableCell className="font-mono text-xs">{labCase.id.substring(0, 8)}</TableCell>
                    <TableCell className="font-medium">
                      {labCase.patient?.firstName} {labCase.patient?.lastName}
                    </TableCell>
                    <TableCell>{labCase.restorationName}</TableCell>
                    <TableCell>{labCase.vendor?.name || 'Unassigned'}</TableCell>
                    <TableCell>{getStatusBadge(labCase.status)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedCase(labCase)}
                      >
                        View Details
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <LabCaseDetailsSheet
        labCase={selectedCase}
        onClose={() => setSelectedCase(null)}
      />
    </div>
  )
}
