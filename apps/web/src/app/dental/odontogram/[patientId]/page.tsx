/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Info, Save, Settings2, Loader2 } from 'lucide-react'
import { useParams } from 'next/navigation'
import { useState, useEffect } from 'react'

import { OdontogramChart, OdontogramToothData } from '@/components/dental/odontogram-chart'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { dentalApi } from '@/lib/api/dental'

export default function OdontogramPage() {
  const params = useParams()
  const patientId = params.patientId as string
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [activeTooth, setActiveTooth] = useState<number | null>(null)
  const [dentitionType, setDentitionType] = useState<'adult' | 'pediatric'>('adult')
  const [teethData, setTeethData] = useState<OdontogramToothData[]>([])

  // Fetch from DB
  const { data: odontogramData } = useQuery({
    queryKey: ['odontogram', patientId],
    queryFn: async () => {
      const res = await dentalApi.getLatestOdontogram(patientId)
      return res as { data: { teeth: OdontogramToothData[] } }
    },
    enabled: !!patientId,
  })

  // Sync DB to local state on load
  useEffect(() => {
    if (odontogramData?.data?.teeth) {
      setTeethData(odontogramData.data.teeth)
    }
  }, [odontogramData])

  // Save to DB
  const { mutate: saveSnapshot, isPending: isSaving } = useMutation({
    mutationFn: async () => {
      return dentalApi.createOdontogram({
        patientId,
        notes: 'Odontogram Snapshot',
        teeth: teethData,
      })
    },
    onSuccess: () => {
      toast({ title: 'Saved Successfully', description: 'Odontogram snapshot has been recorded.' })
      void queryClient.invalidateQueries({ queryKey: ['odontogram', patientId] })
    },
    onError: () => {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to save odontogram.' })
    }
  })

  const handleConditionSelect = (condition: string) => {
    if (!activeTooth) return
    setTeethData(prev => {
      const existing = prev.findIndex(t => t.toothNumber === activeTooth)
      if (existing >= 0) {
        const updated = [...prev]
        // If clicking same condition again, clear it (toggle off)
        if (updated[existing].condition === condition) {
          updated[existing] = { ...updated[existing], condition: 'SOUND' }
        } else {
          updated[existing] = { ...updated[existing], condition }
        }
        return updated
      }
      return [...prev, { toothNumber: activeTooth, condition }]
    })
  }

  const handleSurfaceToggle = (surface: string) => {
    if (!activeTooth) return
    setTeethData(prev => {
      const existing = prev.findIndex(t => t.toothNumber === activeTooth)
      if (existing >= 0) {
        const updated = [...prev]
        const currentSurfaces = updated[existing].surfaces || []
        if (currentSurfaces.includes(surface)) {
          updated[existing] = { ...updated[existing], surfaces: currentSurfaces.filter(s => s !== surface) }
        } else {
          updated[existing] = { ...updated[existing], surfaces: [...currentSurfaces, surface] }
        }
        return updated
      }
      return [...prev, { toothNumber: activeTooth, condition: 'SOUND', surfaces: [surface] }]
    })
  }

  const getActiveToothData = () => {
    return teethData.find(t => t.toothNumber === activeTooth)
  }
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-500">Interactive Odontogram</h1>
          <p className="text-muted-foreground mt-1 text-sm">Visualize, record conditions, and plan treatments seamlessly.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="gap-2 backdrop-blur-sm bg-white/50 dark:bg-zinc-900/50">
            <Settings2 className="h-4 w-4" />
            Preferences
          </Button>
          <Button
            className="gap-2 shadow-lg shadow-blue-500/20"
            onClick={() => saveSnapshot()}
            disabled={isSaving}
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Snapshot
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card className="border-0 shadow-xl shadow-slate-200/40 dark:shadow-none bg-white/60 dark:bg-zinc-950/60 backdrop-blur-xl">
            <CardHeader className="border-b border-border/50 bg-muted/20">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl">
                    {dentitionType === 'adult' ? 'Permanent Dentition' : 'Primary Dentition'}
                  </CardTitle>
                  <CardDescription>Select a tooth to modify its condition or surfaces.</CardDescription>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex bg-muted/50 p-1 rounded-lg">
                    <Button
                      variant={dentitionType === 'adult' ? 'default' : 'ghost'}
                      size="sm"
                      className="text-xs h-7 px-3 rounded-md shadow-none"
                      onClick={() => setDentitionType('adult')}
                    >
                      Adult
                    </Button>
                    <Button
                      variant={dentitionType === 'pediatric' ? 'default' : 'ghost'}
                      size="sm"
                      className="text-xs h-7 px-3 rounded-md shadow-none"
                      onClick={() => setDentitionType('pediatric')}
                    >
                      Pediatric
                    </Button>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-full">
                    <Info className="h-3.5 w-3.5" /> ISO System
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-8">
              <OdontogramChart 
                activeTooth={activeTooth} 
                onSelectTooth={setActiveTooth} 
                teethData={teethData} 
                type={dentitionType} 
              />
            </CardContent>
          </Card>
        </div>

        <div>
          <Card className="h-full border-0 shadow-xl shadow-slate-200/40 dark:shadow-none bg-white/80 dark:bg-zinc-950/80 backdrop-blur-xl">
            <CardHeader className="border-b border-border/50">
              <CardTitle>Tooth Detail {activeTooth ? `#${activeTooth}` : ''}</CardTitle>
              <CardDescription>
                {activeTooth ? 'Record findings for the selected tooth' : 'Select a tooth from the chart'}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              {activeTooth ? (
                <Tabs defaultValue="condition" className="w-full">
                  <TabsList className="w-full grid grid-cols-3 mb-6 bg-muted/50 p-1">
                    <TabsTrigger value="condition" className="rounded-md">Condition</TabsTrigger>
                    <TabsTrigger value="surfaces" className="rounded-md">Surfaces</TabsTrigger>
                    <TabsTrigger value="history" className="rounded-md">History</TabsTrigger>
                  </TabsList>

                  <TabsContent value="condition" className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="grid grid-cols-2 gap-3">
                      {['SOUND', 'CARIES', 'RESTORED_COMPOSITE', 'MISSING', 'IMPLANT', 'CROWN', 'FRACTURE', 'EXTRACTION'].map((cond) => {
                        const isSelected = getActiveToothData()?.condition === cond
                        return (
                          <Button
                            key={cond}
                            variant={isSelected ? "default" : "outline"}
                            className={`justify-start transition-all duration-300 ${isSelected ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400'}`}
                            onClick={() => handleConditionSelect(cond)}
                          >
                            <CheckCircle2 className={`h-4 w-4 mr-2 ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} />
                            <span className="capitalize">{cond.toLowerCase().replace('_', ' ')}</span>
                          </Button>
                        )
                      })}
                    </div>
                  </TabsContent>

                  <TabsContent value="surfaces" className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="flex justify-center p-6 border rounded-xl bg-gradient-to-b from-muted/50 to-muted/10">
                      {/* Interactive surface selector representation */}
                      <div className="relative w-32 h-32">
                        {['B', 'L', 'M', 'D', 'O'].map((surface) => {
                          const isSelected = getActiveToothData()?.surfaces?.includes(surface)
                          let positionClasses = ''
                          if (surface === 'B') positionClasses = 'top-0 left-1/2 -translate-x-1/2 w-16 h-8 rounded-t-xl'
                          if (surface === 'L') positionClasses = 'bottom-0 left-1/2 -translate-x-1/2 w-16 h-8 rounded-b-xl'
                          if (surface === 'M') positionClasses = 'left-0 top-1/2 -translate-y-1/2 w-8 h-16 rounded-l-xl'
                          if (surface === 'D') positionClasses = 'right-0 top-1/2 -translate-y-1/2 w-8 h-16 rounded-r-xl'
                          if (surface === 'O') positionClasses = 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded'

                          return (
                            <div
                              key={surface}
                              onClick={() => handleSurfaceToggle(surface)}
                              className={`absolute border cursor-pointer transition-colors flex items-center justify-center font-medium
                                ${positionClasses}
                                ${isSelected ? 'bg-blue-500 border-blue-600 text-white' : 'bg-zinc-200 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 hover:bg-blue-200 dark:hover:bg-blue-900 text-xs'}
                              `}
                            >
                              {surface}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="history" className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="flex flex-col items-center justify-center text-center py-12 text-muted-foreground">
                      <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
                        <Info className="h-6 w-6" />
                      </div>
                      <p className="font-medium text-foreground">No historical records</p>
                      <p className="text-sm">This tooth has not been modified previously.</p>
                    </div>
                  </TabsContent>
                </Tabs>
              ) : (
                <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground animate-in fade-in zoom-in-95 duration-500">
                  <div className="h-24 w-24 rounded-3xl bg-gradient-to-br from-blue-100 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/10 flex items-center justify-center mb-6 shadow-inner border border-blue-200/50 dark:border-blue-800/50">
                    <svg 
                      xmlns="http://www.w3.org/2000/svg" 
                      viewBox="0 0 24 24" 
                      fill="none" 
                      stroke="currentColor" 
                      strokeWidth="1.25" 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      className="h-12 w-12 text-blue-500 animate-pulse"
                    >
                      <path d="M 7 2 C 3 2 3 7 3 9 C 3 13 4 16 5 19 L 6 22 C 6.5 23 8 23 9 22 L 11 17 C 11.5 16 12.5 16 13 17 L 15 22 C 16 23 17.5 23 18 22 L 19 19 C 20 16 21 13 21 9 C 21 7 21 2 17 2 C 15 2 13 4 12 4 C 11 4 9 2 7 2 Z" fill="currentColor" fillOpacity="0.1" />
                    </svg>
                  </div>
                  <p className="font-medium text-zinc-700 dark:text-zinc-300 text-lg">No Tooth Selected</p>
                  <p className="text-sm mt-1 max-w-[200px] text-center">Click on any tooth in the chart to view and edit its details.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
