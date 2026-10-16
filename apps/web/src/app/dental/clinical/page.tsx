/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */
/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unused-vars */
'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ClipboardList, Search, CheckCircle2, User, FileText, ArrowRight, Activity, Calendar as CalendarIcon, Play, Loader2 } from 'lucide-react'
import { useState } from 'react'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'
import { dentalApi } from '@/lib/api/dental'
import { listPatients } from '@/lib/api/patients'
import { listStaff } from '@/lib/api/staff'

export default function ClinicalEncountersPage() {
  const [search, setSearch] = useState('')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [formData, setFormData] = useState({
    patientId: '',
    dentistId: '',
    visitDate: new Date().toISOString().split('T')[0],
    chiefComplaint: '',
  })

  const queryClient = useQueryClient()
  const { toast } = useToast()

  const { data: encountersResponse, isLoading } = useQuery({
    queryKey: ['dental-encounters'],
    queryFn: () => dentalApi.listEncounters(),
  })

  const { data: patientsResponse } = useQuery({
    queryKey: ['patients-list'],
    queryFn: () => listPatients({ limit: 100 }),
  })

  const { data: staffResponse } = useQuery({
    queryKey: ['staff-list'],
    queryFn: () => listStaff({ limit: 100 }),
  })

  const encountersRaw = encountersResponse as any
  const encounters = Array.isArray(encountersRaw?.data?.data) ? encountersRaw.data.data : (Array.isArray(encountersRaw?.data) ? encountersRaw.data : (Array.isArray(encountersRaw) ? encountersRaw : []))
  const patients = patientsResponse?.data || []
  const staffMembers = staffResponse?.data || []

  const createMutation = useMutation({
    mutationFn: (data: any) => dentalApi.createEncounter(data),
    onSuccess: () => {
      toast({ title: 'Encounter started successfully' })
      queryClient.invalidateQueries({ queryKey: ['dental-encounters'] })
      setIsDialogOpen(false)
      setFormData({
        patientId: '',
        dentistId: '',
        visitDate: new Date().toISOString().split('T')[0],
        chiefComplaint: '',
      })
    },
    onError: (err: any) => {
      toast({ title: 'Error starting encounter', description: err.message, variant: 'destructive' })
    }
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    createMutation.mutate({
      patientId: formData.patientId,
      dentistId: formData.dentistId,
      visitDate: new Date(formData.visitDate).toISOString(),
      chiefComplaint: formData.chiefComplaint,
    })
  }

  // Filter based on search input
  const filtered = Array.isArray(encounters)
    ? encounters.filter((e: any) =>
      e.patient?.name?.toLowerCase().includes(search.toLowerCase()) ||
      e.chiefComplaint?.toLowerCase().includes(search.toLowerCase())
    )
    : []

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PLANNED':
        return <Badge variant="secondary" className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 gap-1 border-0"><CalendarIcon className="h-3 w-3" /> Planned</Badge>
      case 'IN_PROGRESS':
        return <Badge variant="secondary" className="bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 gap-1 border-0 animate-pulse"><Activity className="h-3 w-3" /> In Progress</Badge>
      case 'COMPLETED':
        return <Badge variant="secondary" className="bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400 gap-1 border-0"><CheckCircle2 className="h-3 w-3" /> Completed</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const getTypeColor = (type: string) => {
    if (type === 'SURGERY') return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
    if (type === 'CONSULTATION') return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
    if (type === 'EMERGENCY') return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300'
    return 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
  }

  // Calculate real metrics from data
  const inProgressCount = Array.isArray(encounters) ? encounters.filter((e: any) => e.status === 'IN_PROGRESS').length : 0
  const completedCount = Array.isArray(encounters) ? encounters.filter((e: any) => e.status === 'COMPLETED').length : 0
  const plannedCount = Array.isArray(encounters) ? encounters.filter((e: any) => e.status === 'PLANNED').length : 0
  const totalCount = Array.isArray(encounters) ? encounters.length : 0

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-500">
            Clinical Encounters
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Manage active visits, clinical notes, and procedures.
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/20">
                <Play className="h-4 w-4" fill="currentColor" />
                Start Encounter
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Start Clinical Encounter</DialogTitle>
                <DialogDescription>
                  Begin a new clinical visit for a patient.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="patientId">Select Patient</Label>
                  <Select value={formData.patientId} onValueChange={(value) => setFormData({ ...formData, patientId: value })} required>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a patient..." />
                    </SelectTrigger>
                    <SelectContent>
                      {patients.map((p: any) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.firstName} {p.lastName} {p.uhid ? `(${p.uhid})` : ''}
                        </SelectItem>
                      ))}
                      {patients.length === 0 && (
                        <SelectItem value="demo" disabled>No patients found.</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dentistId">Select Provider</Label>
                  <Select value={formData.dentistId} onValueChange={(value) => setFormData({ ...formData, dentistId: value })} required>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a provider..." />
                    </SelectTrigger>
                    <SelectContent>
                      {staffMembers.map((s: any) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.firstName} {s.lastName}
                        </SelectItem>
                      ))}
                      {staffMembers.length === 0 && (
                        <SelectItem value="demo" disabled>No providers found.</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="visitDate">Date</Label>
                  <div className="relative">
                    <Input
                      id="visitDate"
                      type="date"
                      value={formData.visitDate}
                      onChange={(e) => setFormData({ ...formData, visitDate: e.target.value })}
                      required
                      className="w-full pr-10 [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer z-10 bg-transparent"
                    />
                    <CalendarIcon className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none z-0" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="chiefComplaint">Chief Complaint</Label>
                  <Input
                    id="chiefComplaint"
                    value={formData.chiefComplaint}
                    onChange={(e) => setFormData({ ...formData, chiefComplaint: e.target.value })}
                    placeholder="e.g. Toothache in lower left jaw"
                    required
                  />
                </div>
                <DialogFooter className="pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending} className="bg-blue-600 hover:bg-blue-700">
                    {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Start Encounter
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-white/60 dark:bg-zinc-950/60 backdrop-blur-xl border-0 shadow-lg shadow-slate-200/40 dark:shadow-none">
          <CardContent className="p-6 flex flex-col items-center justify-center text-center space-y-2">
            <div className="p-3 bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 rounded-full">
              <Activity className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-3xl">{isLoading ? <Skeleton className="h-9 w-12 mx-auto" /> : inProgressCount}</h3>
              <p className="text-sm text-muted-foreground font-medium">In Progress</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white/60 dark:bg-zinc-950/60 backdrop-blur-xl border-0 shadow-lg shadow-slate-200/40 dark:shadow-none">
          <CardContent className="p-6 flex flex-col items-center justify-center text-center space-y-2">
            <div className="p-3 bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 rounded-full">
              <CalendarIcon className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-3xl">{isLoading ? <Skeleton className="h-9 w-12 mx-auto" /> : plannedCount}</h3>
              <p className="text-sm text-muted-foreground font-medium">Planned</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white/60 dark:bg-zinc-950/60 backdrop-blur-xl border-0 shadow-lg shadow-slate-200/40 dark:shadow-none">
          <CardContent className="p-6 flex flex-col items-center justify-center text-center space-y-2">
            <div className="p-3 bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400 rounded-full">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-3xl">{isLoading ? <Skeleton className="h-9 w-12 mx-auto" /> : completedCount}</h3>
              <p className="text-sm text-muted-foreground font-medium">Completed</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white/60 dark:bg-zinc-950/60 backdrop-blur-xl border-0 shadow-lg shadow-slate-200/40 dark:shadow-none">
          <CardContent className="p-6 flex flex-col items-center justify-center text-center space-y-2">
            <div className="p-3 bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400 rounded-full">
              <ClipboardList className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-3xl">{isLoading ? <Skeleton className="h-9 w-12 mx-auto" /> : totalCount}</h3>
              <p className="text-sm text-muted-foreground font-medium">Total Today</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-0 shadow-xl shadow-slate-200/40 dark:shadow-none bg-white/60 dark:bg-zinc-950/60 backdrop-blur-xl">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="relative w-full max-w-md">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search encounters by patient..."
                className="pl-9 bg-white dark:bg-zinc-900 border-border/50 focus-visible:ring-blue-500"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border border-border/50 bg-white dark:bg-zinc-950 overflow-hidden">
            <Table>
              <TableHeader className="bg-zinc-50 dark:bg-zinc-900">
                <TableRow>
                  <TableHead>Time & Date</TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead>Encounter Details</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-10 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-10 w-48" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-40" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-24 rounded-full" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-8 w-24 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-40 text-center text-muted-foreground">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <ClipboardList className="h-10 w-10 opacity-20 text-blue-600" />
                        <p>No encounters found.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((encounter: any) => (
                    <TableRow key={encounter.id} className="group hover:bg-blue-50/30 dark:hover:bg-blue-950/10 transition-colors">
                      <TableCell>
                        <div className="font-medium text-sm">
                          {encounter.startTime ? new Date(encounter.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {encounter.startTime ? new Date(encounter.startTime).toLocaleDateString() : 'N/A'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10 border border-border/50">
                            <AvatarFallback className="bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400 font-medium">
                              {encounter.patient?.firstName?.substring(0, 2).toUpperCase() || 'PT'}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium text-sm text-foreground">{encounter.patient?.firstName ? `${encounter.patient.firstName} ${encounter.patient.lastName}` : (encounter.patient?.fullName || encounter.patient?.name || 'Unknown Patient')}</div>
                            <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                              <User className="h-3 w-3" /> Provider: {encounter.provider?.firstName ? `${encounter.provider.firstName} ${encounter.provider.lastName}` : (encounter.provider?.name || 'Unassigned')}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1.5 items-start">
                          <Badge variant="secondary" className={`font-normal border-0 text-xs ${getTypeColor(encounter.type || 'ROUTINE')}`}>
                            {encounter.type ? encounter.type.replace('_', ' ') : 'ROUTINE'}
                          </Badge>
                          <div className="text-xs font-medium text-slate-700 dark:text-slate-300">
                            {encounter.chiefComplaint || 'No chief complaint recorded'}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(encounter.status || 'PLANNED')}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-slate-600 border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-900">
                            <FileText className="h-3.5 w-3.5" />
                            Notes
                          </Button>
                          <Button size="sm" className="h-8 gap-1.5 bg-blue-600 hover:bg-blue-700 text-white shadow-sm">
                            Open
                            <ArrowRight className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
