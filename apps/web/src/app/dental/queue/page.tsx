/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unused-vars */
'use client'

import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { Activity, Clock, CheckCircle2, UserCircle2, Settings2, Filter, Stethoscope } from 'lucide-react'
import { useState } from 'react'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { listAppointments } from '@/lib/api/appointments'
import { cn } from '@/lib/utils'

type QueueStatus = 'SCHEDULED' | 'WAITING' | 'IN_CHAIR' | 'CHECKED_OUT'

const COLUMNS: { id: QueueStatus; label: string; icon: any; color: string; bg: string }[] = [
  { id: 'SCHEDULED', label: 'Scheduled', icon: Clock, color: 'text-zinc-500', bg: 'bg-zinc-100 dark:bg-zinc-900/50' },
  { id: 'WAITING', label: 'Waiting Room', icon: UserCircle2, color: 'text-amber-500', bg: 'bg-amber-100/50 dark:bg-amber-900/20' },
  { id: 'IN_CHAIR', label: 'In Chair', icon: Stethoscope, color: 'text-blue-500', bg: 'bg-blue-100/50 dark:bg-blue-900/20' },
  { id: 'CHECKED_OUT', label: 'Checked Out', icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-100/50 dark:bg-emerald-900/20' },
]

export default function ChairQueuePage() {
  const [filter, setFilter] = useState('')

  // Fetch today's appointments
  const { data: queueData, isLoading } = useQuery({
    queryKey: ['dental-chair-queue-live'],
    queryFn: async () => {
      const today = new Date()
      // Fetch all appointments for today
      const res = await listAppointments({
        date: today.toISOString().split('T')[0],
        limit: 100,
      } as any)

      const items = Array.isArray(res) ? res : ((res as any)?.data || [])

      // Map standard appointment statuses to our QueueStatus buckets
      return items.map((app: any) => {
        let mappedStatus: QueueStatus = 'SCHEDULED'
        if (app.status === 'CHECKED_IN') mappedStatus = 'WAITING'
        if (app.status === 'IN_PROGRESS') mappedStatus = 'IN_CHAIR'
        if (app.status === 'COMPLETED') mappedStatus = 'CHECKED_OUT'

        return {
          id: app.id,
          patientName: app.patient ? `${app.patient.firstName} ${app.patient.lastName}` : 'Unknown Patient',
          status: mappedStatus,
          time: format(new Date(app.startTime), 'hh:mm a'),
          provider: app.doctor ? `Dr. ${app.doctor.lastName}` : 'Unassigned',
          type: app.reason || 'Consultation',
          chair: app.roomName || (mappedStatus === 'IN_CHAIR' ? 'Dental Chair' : undefined),
          waitTime: mappedStatus === 'WAITING' ? 'Waiting' : undefined,
        }
      })
    },
    // Refetch every minute for live dashboard updates
    refetchInterval: 60000
  })

  const items = queueData || []
  const filtered = items.filter((item: { patientName: string }) => item.patientName.toLowerCase().includes(filter.toLowerCase()))

  return (
    <div className="space-y-6 h-[calc(100vh-100px)] flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between shrink-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-500">
            Chair Queue
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Live tracker for patient flow and operatory utilization.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Filter className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Filter patients..."
              className="pl-9 w-64 backdrop-blur-sm bg-white/50 dark:bg-zinc-900/50"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>
          <Button variant="outline" className="gap-2 backdrop-blur-sm bg-white/50 dark:bg-zinc-900/50">
            <Settings2 className="h-4 w-4" />
            Manage Chairs
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-pulse flex flex-col items-center gap-4 text-muted-foreground">
            <Activity className="h-8 w-8 animate-bounce text-blue-500" />
            Loading live queue...
          </div>
        </div>
      ) : (
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 overflow-hidden">
          {COLUMNS.map(col => {
            const colItems = filtered.filter((i: { status: string }) => i.status === col.id)
            return (
              <div key={col.id} className="flex flex-col h-full bg-muted/20 rounded-xl border border-border/50 overflow-hidden">
                <div className={cn("p-4 border-b border-border/50 flex items-center justify-between shrink-0", col.bg)}>
                  <div className="flex items-center gap-2">
                    <col.icon className={cn("h-5 w-5", col.color)} />
                    <h3 className="font-semibold text-sm tracking-tight">{col.label}</h3>
                  </div>
                  <Badge variant="secondary" className="bg-white/50 dark:bg-black/20 text-xs">
                    {colItems.length}
                  </Badge>
                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-3">
                  {colItems.map((item: any) => (
                    <Card key={item.id} className="cursor-pointer group hover:border-blue-400 hover:shadow-md transition-all">
                      <CardContent className="p-4 relative overflow-hidden">
                        {/* Drag Handle Indicator */}
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-zinc-200 dark:bg-zinc-800 group-hover:bg-blue-400 transition-colors" />

                        <div className="flex justify-between items-start mb-2 pl-2">
                          <div className="font-semibold text-sm">{item.patientName}</div>
                          <div className="text-xs text-muted-foreground flex items-center font-medium">
                            {item.time}
                          </div>
                        </div>

                        <div className="flex flex-col gap-2 pl-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded">
                              {item.type}
                            </span>
                            {item.waitTime && (
                              <span className="text-[10px] text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-1.5 py-0.5 rounded font-medium flex items-center gap-1">
                                <Clock className="w-3 h-3" /> {item.waitTime}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center justify-between pt-2 border-t border-border/50 mt-1">
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Avatar className="h-4 w-4">
                                <AvatarFallback className="text-[8px] bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100">
                                  {typeof item.provider === 'string' ? item.provider.charAt(4) : 'U'}
                                </AvatarFallback>
                              </Avatar>
                              {item.provider}
                            </div>

                            {item.chair && (
                              <Badge variant="outline" className="text-[10px] border-blue-200 dark:border-blue-900 bg-transparent">
                                {item.chair}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}

                  {colItems.length === 0 && (
                    <div className="h-24 flex items-center justify-center text-xs text-muted-foreground italic border-2 border-dashed border-border/50 rounded-lg">
                      Empty
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
