/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unused-vars */
'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { createAppointment } from '@/lib/api/appointments'
import { dentalApi } from '@/lib/api/dental'
import { listDoctors } from '@/lib/api/doctors'
import { listPatients } from '@/lib/api/patients'

export function NewAppointmentDialog() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)

  const [patientId, setPatientId] = useState('')
  const [doctorId, setDoctorId] = useState('')
  const [roomNumber, setRoomNumber] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [time, setTime] = useState('09:00')
  const duration = '60'
  const [type, setType] = useState('OPD')

  const { data: patients } = useQuery({ queryKey: ['patients'], queryFn: () => listPatients({}) })
  const { data: doctors } = useQuery({ queryKey: ['doctors'], queryFn: () => listDoctors({}) })
  const { data: chairs } = useQuery({
    queryKey: ['dental-chairs'], queryFn: async () => {
      const res = await dentalApi.listChairs()
      return res?.data || res || []
    }
  })

  const mutation = useMutation({
    mutationFn: async () => {
      if (!patientId || !doctorId || !date || !time) throw new Error('Missing required fields')

      const scheduledAt = new Date(`${date}T${time}:00`).toISOString()

      return createAppointment({
        patientId,
        doctorId,
        scheduledAt,
        durationMinutes: parseInt(duration),
        type: type as any,
        roomNumber,
      })
    },
    onSuccess: () => {
      toast({ title: 'Appointment Booked', description: 'The schedule has been updated.' })
      setPatientId('')
      setDoctorId('')
      setRoomNumber('')
      setDate(new Date().toISOString().split('T')[0])
      setTime('')
      setType('OPD')
      setOpen(false)
      void queryClient.invalidateQueries({ queryKey: ['appointments'] })
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message
      toast({ title: 'Error', description: msg, variant: 'destructive' })
    }
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20">
          <Plus className="h-4 w-4 mr-2" />
          New Appointment
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Book Appointment</DialogTitle>
          <DialogDescription>Schedule a new patient visit on the calendar.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label>Patient</Label>
            <Select value={patientId} onValueChange={setPatientId}>
              <SelectTrigger><SelectValue placeholder="Select Patient" /></SelectTrigger>
              <SelectContent>
                {patients?.data?.map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>{p.firstName} {p.lastName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Doctor</Label>
            <Select value={doctorId} onValueChange={setDoctorId}>
              <SelectTrigger><SelectValue placeholder="Select Doctor" /></SelectTrigger>
              <SelectContent>
                {doctors?.data?.map((d: any) => (
                  <SelectItem key={d.id} value={d.id}>Dr. {d.firstName} {d.lastName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Chair / Operatory</Label>
            <Select value={roomNumber} onValueChange={setRoomNumber}>
              <SelectTrigger><SelectValue placeholder="Select Chair" /></SelectTrigger>
              <SelectContent>
                {chairs?.map((c: any) => (
                  <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Date</Label>
            <div className="relative">
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                onClick={(e) => {
                  try {
                    (e.target as HTMLInputElement).showPicker?.()
                  } catch (err) { /* empty */ }
                }}
                className="cursor-pointer pr-10 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-3 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-50"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Time</Label>
            <div className="grid grid-cols-4 gap-2 max-h-32 overflow-y-auto p-2 border border-zinc-800 rounded-md bg-zinc-950/50">
              {['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30'].map((t) => (
                <Button
                  key={t}
                  type="button"
                  variant={time === t ? "default" : "outline"}
                  size="sm"
                  className={time === t ? "bg-blue-600 text-white" : "border-zinc-800 text-xs hover:bg-zinc-800 hover:text-white"}
                  onClick={() => setTime(t)}
                >
                  {(() => {
                    const [h, m] = t.split(':')
                    const numH = parseInt(h)
                    const ampm = numH >= 12 ? 'PM' : 'AM'
                    const displayH = numH > 12 ? numH - 12 : numH
                    return `${displayH}:${m} ${ampm}`
                  })()}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2 mt-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="OPD">Consultation</SelectItem>
                  <SelectItem value="FOLLOW_UP">Follow Up</SelectItem>
                  <SelectItem value="PROCEDURE">Procedure / Treatment</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
          {mutation.isPending ? 'Booking...' : 'Book Appointment'}
        </Button>
      </DialogContent>
    </Dialog>
  )
}
