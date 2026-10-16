'use client'

import { useQuery } from '@tanstack/react-query'
import { Plus, Search, UserCircle, Users } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { listPatients } from '@/lib/api/patients'


export default function DentalPatientsPage() {
  const router = useRouter()

  const { data, isLoading } = useQuery({
    queryKey: ['dental-patients'],
    queryFn: () => listPatients({ limit: 50 }),
  })

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-500">
            Dental Patients
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Manage your clinic&apos;s patients, profiles, and treatment histories.
          </p>
        </div>
        <Button className="gap-2 shadow-lg shadow-blue-500/20" asChild>
          <Link href="/dental/patients/new">
            <Plus className="h-4 w-4" />
            New Patient
          </Link>
        </Button>
      </div>

      <Card className="border-0 shadow-xl shadow-slate-200/40 dark:shadow-none bg-white/60 dark:bg-zinc-950/60 backdrop-blur-xl">
        <CardHeader className="border-b border-border/50 bg-muted/20 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Users className="h-4 w-4" />
              <CardTitle className="text-base font-medium">All Patients</CardTitle>
            </div>
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input type="search" placeholder="Search by name or ID..." className="pl-9 bg-background/50" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="w-[300px]">Patient Name</TableHead>
                <TableHead>UHID</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Gender</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-6 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-16 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : data?.data?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                    No patients found.
                  </TableCell>
                </TableRow>
              ) : (
                data?.data?.map((patient: { id: string; firstName: string; lastName: string; uhid: string; phone: string | null; gender: string | null }) => (
                  <TableRow
                    key={patient.id}
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => router.push(`/dental/patients/${patient.id}`)}
                  >
                    <TableCell className="font-medium flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                        <UserCircle className="h-5 w-5" />
                      </div>
                      {patient.firstName} {patient.lastName}
                    </TableCell>
                    <TableCell className="text-muted-foreground font-mono text-xs">{patient.uhid}</TableCell>
                    <TableCell>{patient.phone || 'N/A'}</TableCell>
                    <TableCell className="capitalize">{patient.gender?.toLowerCase() || 'N/A'}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={(e) => {
                        e.stopPropagation()
                        router.push(`/dental/patients/${patient.id}`)
                      }}>
                        View Chart
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
