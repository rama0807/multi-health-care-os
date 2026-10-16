/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unused-vars */
'use client'

import { useQuery } from '@tanstack/react-query'
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, User } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useMemo } from 'react'

import { NewAppointmentDialog } from '@/components/dental/new-appointment-dialog'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { listAppointments } from '@/lib/api/appointments'
import { dentalApi } from '@/lib/api/dental'

export default function AppointmentsPage() {
  const router = useRouter()
  const [currentDate, setCurrentDate] = useState(new Date())

  const { data: chairs } = useQuery<any[]>({
    queryKey: ['dental-chairs'],
    queryFn: async () => {
      const res = await dentalApi.listChairs()
      return res?.data || res || []
    },
  })

  // Fetch real appointments for the selected date
  const { data: appointmentsData } = useQuery({
    queryKey: ['appointments', currentDate.toISOString().split('T')[0]],
    queryFn: () => listAppointments({ date: currentDate.toISOString().split('T')[0] }),
  })

  const appointments = useMemo(() => {
    console.log('Appointments Data:', appointmentsData?.data)
    return appointmentsData?.data || []
  }, [appointmentsData])

  const chairList = chairs && chairs.length > 0 ? chairs.map((c: any) => c.name) : ['Chair 1', 'Chair 2', 'Consultation']

  const timeSlots = Array.from({ length: 9 }, (_, i) => {
    const hour = i + 9
    const ampm = hour >= 12 ? 'PM' : 'AM'
    const displayHour = hour > 12 ? hour - 12 : hour
    return `${displayHour}:00 ${ampm}`
  })

  return (
    <div className="flex h-[85vh] flex-col space-y-4">
      {/* Header Controls */}
      <div className="flex justify-between items-center bg-zinc-950/50 p-4 rounded-xl border border-zinc-800">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white">Daily Schedule</h2>
          <p className="text-zinc-400 text-sm">Manage appointments across all operatories.</p>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center bg-zinc-900 rounded-lg p-1 border border-zinc-800">
            <Button variant="ghost" size="icon" onClick={() => setCurrentDate(new Date(currentDate.setDate(currentDate.getDate() - 1)))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2 px-4 text-sm font-medium">
              <CalendarIcon className="h-4 w-4 text-blue-500" />
              {currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </div>
            <Button variant="ghost" size="icon" onClick={() => setCurrentDate(new Date(currentDate.setDate(currentDate.getDate() + 1)))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <NewAppointmentDialog />
        </div>
      </div>

      {/* Calendar Grid */}
      <Card className="flex-1 overflow-hidden bg-zinc-950/80 border-zinc-800 flex flex-col">
        {/* Chair Headers */}
        <div className="grid border-b border-zinc-800 bg-zinc-900/50" style={{ gridTemplateColumns: `100px repeat(${chairList.length}, 1fr)` }}>
          <div className="p-4 flex items-center justify-center font-semibold text-zinc-500 text-xs border-r border-zinc-800">
            TIME
          </div>
          {chairList.map((chair) => (
            <div key={chair} className="p-4 text-center border-r border-zinc-800 last:border-r-0">
              <h3 className="font-semibold text-zinc-200">{chair}</h3>
            </div>
          ))}
        </div>

        {/* Time Grid */}
        <div className="flex-1 overflow-y-auto">
          <div className="relative min-h-[900px]">
            {/* Background Grid */}
            <div className="absolute inset-0 z-0">
              {timeSlots.map((time) => (
                <div key={time} className="grid border-b border-zinc-800/50 h-[100px]" style={{ gridTemplateColumns: `100px repeat(${chairList.length}, 1fr)` }}>
                  <div className="p-2 flex items-start justify-center border-r border-zinc-800 bg-zinc-900/50">
                    <span className="text-xs font-medium text-zinc-500">{time}</span>
                  </div>
                  {chairList.map((_c, i) => (
                    <div key={i} className="border-r border-zinc-800 last:border-r-0" />
                  ))}
                </div>
              ))}
            </div>

            {/* Absolute Positioned Appointments */}
            <div className="absolute inset-0 z-10 grid pointer-events-none" style={{ gridTemplateColumns: `100px repeat(${chairList.length}, 1fr)` }}>
              <div className="pointer-events-auto" /> {/* Time column spacing */}

              {/* Chair Columns */}
              {chairList.map((chairName) => {
                // Filter appointments for this chair/room
                const chairAppts = appointments.filter((a) => a.roomNumber === chairName)

                return (
                  <div key={chairName} className="relative pointer-events-auto h-full border-r border-transparent">
                    {chairAppts.map((appt: any) => {
                      const date = new Date(appt.scheduledAt)
                      const hours = date.getHours()
                      const minutes = date.getMinutes()
                      // Grid starts at 9:00 AM (hour 9)
                      // Each hour is 100px high
                      const topPx = (hours - 9) * 100 + (minutes / 60) * 100
                      const heightPx = (appt.durationMinutes / 60) * 100

                      const endTime = new Date(date.getTime() + appt.durationMinutes * 60000)
                      const formatTime = (d: Date) => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
                      const timingStr = `${formatTime(date)} - ${formatTime(endTime)}`

                      // Dynamic colors based on type
                      const colorMap: any = {
                        OPD: 'bg-green-500/20 border-green-500/50 text-green-400',
                        PROCEDURE: 'bg-purple-500/20 border-purple-500/50 text-purple-400',
                        FOLLOW_UP: 'bg-blue-500/20 border-blue-500/50 text-blue-400',
                      }
                      const colorClass = colorMap[appt.type] || colorMap['OPD']

                      const typeLabelMap: any = {
                        OPD: 'Consultation',
                        FOLLOW_UP: 'Follow Up',
                        PROCEDURE: 'Procedure',
                      }
                      const typeLabel = typeLabelMap[appt.type] || appt.type

                      return (
                        <div
                          key={appt.id}
                          onClick={() => appt.patient?.id && router.push(`/dental/patients/${appt.patient.id}`)}
                          className={`absolute left-1 right-1 border rounded-md p-2 flex flex-col hover:brightness-125 transition-all cursor-pointer shadow-lg ${colorClass}`}
                          style={{ top: `${topPx}px`, height: `${heightPx}px` }}
                        >
                          <div className="flex flex-col flex-1 overflow-hidden">
                            <span className="text-xs font-bold truncate">
                              {appt.patient?.fullName}
                            </span>
                            <span className="text-[10px] opacity-90 font-medium truncate mt-0.5">
                              {timingStr}
                            </span>
                            {heightPx >= 60 && (
                              <span className="text-[10px] opacity-80 truncate mt-0.5">
                                Dr. {appt.doctor?.fullName}
                              </span>
                            )}
                            {heightPx > 40 && (
                              <span className="text-[10px] opacity-80 truncate mt-0.5">
                                {typeLabel} ({appt.durationMinutes}m)
                              </span>
                            )}
                          </div>
                          {appt.status === 'CHECKED_IN' && heightPx > 60 && (
                            <div className="mt-auto flex items-center text-[10px] opacity-80">
                              <User className="h-3 w-3 mr-1" /> Checked In
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}
