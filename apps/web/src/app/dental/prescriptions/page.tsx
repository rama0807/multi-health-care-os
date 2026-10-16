/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */
/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unused-vars */
'use client'

import { useMutation, useQuery } from '@tanstack/react-query'
import { FileText, Search, Pill, CheckCircle2, User, Printer, Plus, AlertCircle, Clock } from 'lucide-react'
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
import { listPrescriptions, createPrescription } from '@/lib/api/prescriptions'

export default function PrescriptionsPage() {
  const [search, setSearch] = useState('')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [formData, setFormData] = useState({
    encounterId: '',
    medicationName: '',
    dosage: '',
    frequency: '',
    duration: '',
    notes: ''
  })

  const { toast } = useToast()

  const { data: prescriptionsResponse, isLoading, refetch } = useQuery({
    queryKey: ['dental-prescriptions'],
    queryFn: () => listPrescriptions({ limit: 100 }),
  })

  const { data: encountersResponse } = useQuery({
    queryKey: ['dental-encounters'],
    queryFn: () => dentalApi.listEncounters(),
  })

  const prescriptions = prescriptionsResponse?.data || []
  const encountersRaw = encountersResponse as any
  const encounters = Array.isArray(encountersRaw?.data?.data) ? encountersRaw.data.data : (Array.isArray(encountersRaw?.data) ? encountersRaw.data : (Array.isArray(encountersRaw) ? encountersRaw : []))

  // Filter based on search input
  const filtered = Array.isArray(prescriptions)
    ? prescriptions.filter((p: any) =>
      p.patient?.fullName?.toLowerCase().includes(search.toLowerCase()) ||
      p.prescriptionNumber?.toLowerCase().includes(search.toLowerCase()) ||
      p.items?.some((item: any) => item.medicationName.toLowerCase().includes(search.toLowerCase()))
    )
    : []

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return <Badge variant="secondary" className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 gap-1 border-0"><Clock className="h-3 w-3" /> Draft</Badge>
      case 'ACTIVE':
        return <Badge variant="secondary" className="bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 gap-1 border-0"><Pill className="h-3 w-3" /> Active</Badge>
      case 'DISPENSED':
        return <Badge variant="secondary" className="bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400 gap-1 border-0"><CheckCircle2 className="h-3 w-3" /> Dispensed</Badge>
      case 'CANCELLED':
        return <Badge variant="secondary" className="bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 gap-1 border-0"><AlertCircle className="h-3 w-3" /> Cancelled</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const createMutation = useMutation({
    mutationFn: (data: any) => createPrescription(data),
    onSuccess: () => {
      toast({ title: 'Prescription created successfully' })
      refetch()
      setIsDialogOpen(false)
      setFormData({
        encounterId: '',
        medicationName: '',
        dosage: '',
        frequency: '',
        duration: '',
        notes: ''
      })
    },
    onError: (err: any) => {
      toast({ title: 'Error creating prescription', description: err.message, variant: 'destructive' })
    }
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    createMutation.mutate({
      encounterId: formData.encounterId,
      notes: formData.notes,
      items: [
        {
          medicationName: formData.medicationName,
          dosage: formData.dosage,
          frequency: formData.frequency,
          duration: formData.duration,
          route: 'ORAL',
          quantity: 1
        }
      ]
    })
  }

  // Calculate real metrics from data
  const activeCount = Array.isArray(prescriptions) ? prescriptions.filter((p: any) => p.status === 'ACTIVE').length : 0
  const dispensedCount = Array.isArray(prescriptions) ? prescriptions.filter((p: any) => p.status === 'DISPENSED').length : 0
  const totalCount = Array.isArray(prescriptions) ? prescriptions.length : 0

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-500">
            Prescriptions
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Manage patient medications and e-prescriptions.
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-500/20">
                <Plus className="h-4 w-4" />
                New Prescription
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>New Prescription</DialogTitle>
                <DialogDescription>
                  Write a new prescription linked to a clinical encounter.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="encounterId">Select Encounter</Label>
                  <Select value={formData.encounterId} onValueChange={(value) => setFormData({ ...formData, encounterId: value })} required>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select an encounter..." />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.isArray(encounters) && encounters.map((e: any) => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.patient?.firstName ? `${e.patient.firstName} ${e.patient.lastName}` : (e.patient?.fullName || e.patient?.name || 'Unknown Patient')} - {new Date(e.visitDate || e.startTime || e.createdAt).toLocaleDateString()}
                        </SelectItem>
                      ))}
                      {(!Array.isArray(encounters) || encounters.length === 0) && (
                        <SelectItem value="empty" disabled>No encounters found.</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="medicationName">Medication</Label>
                  <Input id="medicationName" value={formData.medicationName} onChange={(e) => setFormData({ ...formData, medicationName: e.target.value })} placeholder="e.g. Amoxicillin 500mg" required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="dosage">Dosage</Label>
                    <Input id="dosage" value={formData.dosage} onChange={(e) => setFormData({ ...formData, dosage: e.target.value })} placeholder="e.g. 1 Tablet" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="frequency">Frequency</Label>
                    <Input id="frequency" value={formData.frequency} onChange={(e) => setFormData({ ...formData, frequency: e.target.value })} placeholder="e.g. TID" required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="duration">Duration</Label>
                  <Input id="duration" value={formData.duration} onChange={(e) => setFormData({ ...formData, duration: e.target.value })} placeholder="e.g. 7 days" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">Notes (Optional)</Label>
                  <Input id="notes" value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} placeholder="Take after meals" />
                </div>
                <DialogFooter className="pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={createMutation.isPending} className="bg-emerald-600 hover:bg-emerald-700">Submit</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-white/60 dark:bg-zinc-950/60 backdrop-blur-xl border-0 shadow-lg shadow-slate-200/40 dark:shadow-none">
          <CardContent className="p-6 flex flex-col items-center justify-center text-center space-y-2">
            <div className="p-3 bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 rounded-full">
              <Pill className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-3xl">{isLoading ? <Skeleton className="h-9 w-12 mx-auto" /> : activeCount}</h3>
              <p className="text-sm text-muted-foreground font-medium">Active Prescriptions</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white/60 dark:bg-zinc-950/60 backdrop-blur-xl border-0 shadow-lg shadow-slate-200/40 dark:shadow-none">
          <CardContent className="p-6 flex flex-col items-center justify-center text-center space-y-2">
            <div className="p-3 bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400 rounded-full">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-3xl">{isLoading ? <Skeleton className="h-9 w-12 mx-auto" /> : dispensedCount}</h3>
              <p className="text-sm text-muted-foreground font-medium">Dispensed Today</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white/60 dark:bg-zinc-950/60 backdrop-blur-xl border-0 shadow-lg shadow-slate-200/40 dark:shadow-none">
          <CardContent className="p-6 flex flex-col items-center justify-center text-center space-y-2">
            <div className="p-3 bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 rounded-full">
              <FileText className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-3xl">{isLoading ? <Skeleton className="h-9 w-12 mx-auto" /> : totalCount}</h3>
              <p className="text-sm text-muted-foreground font-medium">Total Records</p>
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
                placeholder="Search by patient or medication..."
                className="pl-9 bg-white dark:bg-zinc-900 border-border/50 focus-visible:ring-emerald-500"
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
                  <TableHead>Date & ID</TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead>Medications</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-10 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-10 w-48" /></TableCell>
                      <TableCell><Skeleton className="h-12 w-48" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-24 rounded-full" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-8 w-20 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-40 text-center text-muted-foreground">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <FileText className="h-10 w-10 opacity-20 text-emerald-600" />
                        <p>No prescriptions found.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((prescription: any) => (
                    <TableRow key={prescription.id} className="group hover:bg-emerald-50/30 dark:hover:bg-emerald-950/10 transition-colors">
                      <TableCell>
                        <div className="font-medium text-sm">
                          {prescription.prescribedAt ? new Date(prescription.prescribedAt).toLocaleDateString() : 'N/A'}
                        </div>
                        <div className="text-xs text-muted-foreground font-mono mt-0.5">
                          {prescription.prescriptionNumber || 'N/A'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10 border border-border/50">
                            <AvatarFallback className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 font-medium">
                              {prescription.patient?.fullName?.substring(0, 2).toUpperCase() || 'PT'}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium text-sm text-foreground">{prescription.patient?.fullName || 'Unknown Patient'}</div>
                            <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                              <User className="h-3 w-3" /> Dr. {prescription.doctor?.fullName || 'Unknown'}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1.5">
                          {prescription.items && prescription.items.length > 0 ? (
                            prescription.items.slice(0, 2).map((item: any, i: number) => (
                              <div key={i} className="text-xs font-medium text-slate-700 dark:text-slate-300">
                                • {item.medicationName} {item.strength ? `(${item.strength})` : ''} - {item.dosage}
                              </div>
                            ))
                          ) : (
                            <span className="text-xs text-muted-foreground">No medications</span>
                          )}
                          {prescription.items && prescription.items.length > 2 && (
                            <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium mt-1">
                              +{prescription.items.length - 2} more medications
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(prescription.status || 'DRAFT')}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-slate-600 border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-900">
                            <Printer className="h-3.5 w-3.5" />
                            Print
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
