/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unused-vars */
'use client'

import { useQuery } from '@tanstack/react-query'
import { Search, Users } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { listPatients } from '@/lib/api/patients'

export default function OdontogramIndexPage() {
  const router = useRouter()
  const [search, setSearch] = useState('')

  const { data: patientsResponse, isLoading } = useQuery({
    queryKey: ['patients-list'],
    queryFn: () => listPatients({ limit: 50 })
  })

  const patients = patientsResponse?.data || []

  const filtered = patients.filter(p =>
    p.firstName.toLowerCase().includes(search.toLowerCase()) ||
    p.lastName.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6 max-w-4xl mx-auto py-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Select Patient for Charting</h1>
        <p className="text-muted-foreground">You must select a patient before accessing the full-screen Odontogram workspace.</p>
      </div>

      <Card className="border-0 shadow-xl shadow-slate-200/40 dark:shadow-none bg-white/60 dark:bg-zinc-950/60 backdrop-blur-xl">
        <CardHeader>
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search patients by name..."
              className="pl-10"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2">
            {isLoading ? (
              <div className="text-center text-muted-foreground py-8 animate-pulse">Loading patients...</div>
            ) : filtered.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">No patients found.</div>
            ) : (
              filtered.map((patient: any) => (
                <div
                  key={patient.id}
                  onClick={() => router.push(`/dental/odontogram/${patient.id}`)}
                  className="flex items-center justify-between p-4 rounded-lg border border-border/50 bg-white dark:bg-zinc-900 hover:border-blue-500/50 hover:bg-blue-50/50 dark:hover:bg-blue-900/20 cursor-pointer transition-all"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
                      <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <div className="font-semibold">{patient.firstName} {patient.lastName}</div>
                      <div className="text-xs text-muted-foreground">DOB: {new Date(patient.dateOfBirth).toLocaleDateString()}</div>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" className="text-blue-600 dark:text-blue-400">Open Chart</Button>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
