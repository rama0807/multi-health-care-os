/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unused-vars */
'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Calendar, Search, Phone, Mail, Clock, CalendarDays, CheckCircle2, AlertCircle, BellRing, PhoneCall, Plus, Loader2 } from 'lucide-react'
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

export default function RecallsPage() {
  const [search, setSearch] = useState('')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [formData, setFormData] = useState({
    patientId: 'demo-patient-1',
    recallType: 'CLEANING',
    dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString().split('T')[0],
  })

  const queryClient = useQueryClient()
  const { toast } = useToast()

  const { data: recallsResponse, isLoading } = useQuery({
    queryKey: ['dental-recalls'],
    queryFn: () => dentalApi.listRecalls(),
  })

  const { data: patientsResponse } = useQuery({
    queryKey: ['patients-list'],
    queryFn: () => listPatients({ limit: 100 }),
  })

  const recalls = recallsResponse?.data || recallsResponse || []
  const patients = patientsResponse?.data || []

  const createMutation = useMutation({
    mutationFn: (data: any) => dentalApi.createRecall(data),
    onSuccess: () => {
      toast({ title: 'Recall created successfully' })
      queryClient.invalidateQueries({ queryKey: ['dental-recalls'] })
      setIsDialogOpen(false)
    },
    onError: (err: any) => {
      toast({ title: 'Error creating recall', description: err.message, variant: 'destructive' })
    }
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    createMutation.mutate({
      patientId: formData.patientId,
      recallType: formData.recallType,
      dueDate: new Date(formData.dueDate).toISOString(),
    })
  }

  // Filter based on search input
  const filtered = Array.isArray(recalls)
    ? recalls.filter((r: any) =>
      r.patient?.name?.toLowerCase().includes(search.toLowerCase()) ||
      r.patient?.phone?.includes(search)
    )
    : []

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'DUE':
        return <Badge variant="secondary" className="bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400 gap-1 border-0"><Clock className="h-3 w-3" /> Due Soon</Badge>
      case 'OVERDUE':
        return <Badge variant="secondary" className="bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 gap-1 border-0"><AlertCircle className="h-3 w-3" /> Overdue</Badge>
      case 'SCHEDULED':
        return <Badge variant="secondary" className="bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400 gap-1 border-0"><CalendarDays className="h-3 w-3" /> Scheduled</Badge>
      case 'CONTACTED':
        return <Badge variant="secondary" className="bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 gap-1 border-0"><CheckCircle2 className="h-3 w-3" /> Contacted</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const getTypeColor = (type: string) => {
    if (type === 'FOLLOW_UP' || type === 'POST_PROCEDURE') return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
    if (type === 'CHECK_UP') return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
    return 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
  }

  // Calculate real metrics from data
  const overdueCount = Array.isArray(recalls) ? recalls.filter((r: any) => r.status === 'OVERDUE').length : 0
  const dueCount = Array.isArray(recalls) ? recalls.filter((r: any) => r.status === 'DUE').length : 0
  const scheduledCount = Array.isArray(recalls) ? recalls.filter((r: any) => r.status === 'SCHEDULED').length : 0
  const toContactCount = overdueCount + dueCount // simplified logic for demo


  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-teal-600 to-emerald-500">
            Hygiene Recalls
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Track patients due for hygiene, exams, and periodontal maintenance.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2">
            <BellRing className="h-4 w-4" />
            Auto-Reminders
          </Button>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 bg-teal-600 hover:bg-teal-700 shadow-lg shadow-teal-500/20">
                <Plus className="h-4 w-4" />
                Add Recall
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Add Manual Recall</DialogTitle>
                <DialogDescription>
                  Manually schedule a patient for a future hygiene or exam visit.
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
                  <Label htmlFor="recallType">Recall Type</Label>
                  <Select value={formData.recallType} onValueChange={(value) => setFormData({ ...formData, recallType: value })} required>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select type..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CLEANING">Cleaning / Prophy</SelectItem>
                      <SelectItem value="CHECK_UP">Check Up / Exam</SelectItem>
                      <SelectItem value="FOLLOW_UP">Follow Up (Perio)</SelectItem>
                      <SelectItem value="POST_PROCEDURE">Post Procedure</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dueDate">Due Date</Label>
                  <div className="relative">
                    <Input
                      id="dueDate"
                      type="date"
                      value={formData.dueDate}
                      onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                      required
                      className="w-full pr-10 [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer z-10 bg-transparent"
                    />
                    <Calendar className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none z-0" />
                  </div>
                </div>
                <DialogFooter className="pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending} className="bg-teal-600 hover:bg-teal-700">
                    {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Create Recall
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
            <div className="p-3 bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 rounded-full">
              <AlertCircle className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-3xl">{isLoading ? <Skeleton className="h-9 w-12 mx-auto" /> : overdueCount}</h3>
              <p className="text-sm text-muted-foreground font-medium">Overdue</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white/60 dark:bg-zinc-950/60 backdrop-blur-xl border-0 shadow-lg shadow-slate-200/40 dark:shadow-none">
          <CardContent className="p-6 flex flex-col items-center justify-center text-center space-y-2">
            <div className="p-3 bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400 rounded-full">
              <Clock className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-3xl">{isLoading ? <Skeleton className="h-9 w-12 mx-auto" /> : dueCount}</h3>
              <p className="text-sm text-muted-foreground font-medium">Due</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white/60 dark:bg-zinc-950/60 backdrop-blur-xl border-0 shadow-lg shadow-slate-200/40 dark:shadow-none">
          <CardContent className="p-6 flex flex-col items-center justify-center text-center space-y-2">
            <div className="p-3 bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 rounded-full">
              <PhoneCall className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-3xl">{isLoading ? <Skeleton className="h-9 w-12 mx-auto" /> : toContactCount}</h3>
              <p className="text-sm text-muted-foreground font-medium">To Contact</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white/60 dark:bg-zinc-950/60 backdrop-blur-xl border-0 shadow-lg shadow-slate-200/40 dark:shadow-none">
          <CardContent className="p-6 flex flex-col items-center justify-center text-center space-y-2">
            <div className="p-3 bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400 rounded-full">
              <CalendarDays className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-3xl">{isLoading ? <Skeleton className="h-9 w-12 mx-auto" /> : scheduledCount}</h3>
              <p className="text-sm text-muted-foreground font-medium">Scheduled</p>
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
                placeholder="Search by patient name or phone..."
                className="pl-9 bg-white dark:bg-zinc-900 border-border/50 focus-visible:ring-teal-500"
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
                  <TableHead>Patient</TableHead>
                  <TableHead>Recall Info</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-10 w-48" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-32 rounded-full" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-8 w-24 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-40 text-center text-muted-foreground">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Calendar className="h-10 w-10 opacity-20 text-teal-600" />
                        <p>No recalls found.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((recall: any) => (
                    <TableRow key={recall.id} className="group hover:bg-teal-50/30 dark:hover:bg-teal-950/10 transition-colors">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10 border border-border/50">
                            <AvatarFallback className="bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-400 font-medium">
                              {recall.patient?.name?.substring(0, 2).toUpperCase() || 'PT'}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium text-sm text-foreground">{recall.patient?.name || 'Unknown Patient'}</div>
                            <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                              <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {recall.patient?.phone || 'N/A'}</span>
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={`font-normal border-0 text-xs ${getTypeColor(recall.recallType || 'CLEANING')}`}>
                          {recall.recallType ? recall.recallType.replace('_', ' ') : 'CLEANING'}
                        </Badge>
                        <div className="text-[10px] text-muted-foreground mt-1 ml-1">
                          Last visit: {recall.lastVisitDate ? new Date(recall.lastVisitDate).toLocaleDateString() : 'N/A'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className={`font-medium text-sm ${recall.status === 'OVERDUE' ? 'text-red-600 dark:text-red-400' : ''}`}>
                          {recall.dueDate ? new Date(recall.dueDate).toLocaleDateString() : 'N/A'}
                        </div>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(recall.status || 'DUE')}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-blue-600 border-blue-200 hover:bg-blue-50 dark:border-blue-900 dark:text-blue-400 dark:hover:bg-blue-900/20">
                            <Mail className="h-3.5 w-3.5" />
                            Email
                          </Button>
                          <Button size="sm" className="h-8 gap-1.5 bg-teal-600 hover:bg-teal-700 text-white shadow-sm">
                            <Calendar className="h-3.5 w-3.5" />
                            Schedule
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
