/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
'use client'

import type { Patient } from '@medicore/types'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertCircle, Stethoscope, Package, Plus, Clock, Truck, CheckCircle2 } from 'lucide-react'
import { useParams } from 'next/navigation'
import { useState } from 'react'

import { ImagingTab } from '@/components/dental/imaging-tab'
import { LabCaseDetailsSheet } from '@/components/dental/lab-case-details-sheet'
import { LedgerTab } from '@/components/dental/ledger-tab'
import { MedicalHistoryTab } from '@/components/dental/medical-history-tab'
import { NewEncounterDialog } from '@/components/dental/new-encounter-dialog'
import { NewLabCaseDialog } from '@/components/dental/new-lab-case-dialog'
import { NewTreatmentPlanDialog } from '@/components/dental/new-treatment-plan-dialog'
import { OdontogramChart, type OdontogramToothData } from '@/components/dental/odontogram-chart'
import { RecordAcceptanceDialog } from '@/components/dental/record-acceptance-dialog'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { dentalApi } from '@/lib/api/dental'
import { getPatient } from '@/lib/api/patients'
import { cn } from '@/lib/utils'

export interface EncounterItem {
  id: string
  dentist?: { lastName: string }
  visitDate?: string | Date
  createdAt: string | Date
  chiefComplaint?: string
}

export interface TreatmentPlanItemRecord {
  id: string
  toothNumber?: number
  surfaces: string[]
  procedureName: string
  procedureCode?: string
  estimatedCost: number
}

export interface TreatmentPlanOptionRecord {
  id: string
  label: string
  totalCost: number
  netCost: number
  acceptance?: { status: string; notes?: string }
  treatmentPlan: TreatmentPlanItemRecord[]
}

export interface TreatmentPlanRecord {
  id: string
  title: string
  createdAt: string
  options: TreatmentPlanOptionRecord[]
}

export default function Patient360Page() {
  const params = useParams()

  const patientId = (params?.id as string) || 'unknown'
  const [activeTooth, setActiveTooth] = useState<number | null>(null)
  const [dentitionType, setDentitionType] = useState<'adult' | 'pediatric'>('adult')
  const [selectedLabCase, setSelectedLabCase] = useState<any>(null)

  const { toast } = useToast()

  const { data: patient, isLoading } = useQuery<Patient>({
    queryKey: ['dental-patient', patientId],
    queryFn: () => getPatient(patientId) as unknown as Promise<Patient>,
  })

  // Fetch Dental Profile (includes medical histories and safety alerts)
  const { data: dentalProfileData } = useQuery<any>({
    queryKey: ['dental-patient-profile', patientId],
    queryFn: async () => {
      const res = await dentalApi.getPatientProfile(patientId)
      return res?.data || res
    },
    enabled: !!patientId,
  })

  // 1. Fetch real Odontogram data from database
  const { data: odontogramData } = useQuery<{ data: { teeth: OdontogramToothData[] } }>({
    queryKey: ['odontogram', patientId],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const res = await dentalApi.getLatestOdontogram(patientId)
      return res as { data: { teeth: OdontogramToothData[] } }
    },
    enabled: !!patientId,
  })

  // 1.5 Fetch real Clinical Encounters
  const { data: encountersData, isLoading: encountersLoading } = useQuery<{ data: { data: EncounterItem[] } }>({
    queryKey: ['dental-encounters', patientId],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const res = await dentalApi.listEncounters({ patientId })
      return res as { data: { data: EncounterItem[] } }
    },
    enabled: !!patientId,
  })

  // 1.6 Fetch Treatment Plans
  const { data: treatmentPlansData, isLoading: treatmentPlansLoading } = useQuery<TreatmentPlanRecord[]>({
    queryKey: ['dental-treatment-plans', patientId],
    queryFn: async () => {
      const res = await dentalApi.listTreatmentPlans({ patientId })
      // Some interceptors might wrap in { data }, but typically findMany returns an array.
      return (res?.data || res) as unknown as TreatmentPlanRecord[]
    },
    enabled: !!patientId,
  })

  // 1.7 Fetch Lab Cases
  const { data: labCasesData, isLoading: labCasesLoading } = useQuery<any[]>({
    queryKey: ['dental-lab-cases', patientId],
    queryFn: async () => {
      const res = await dentalApi.listLabCases({ patientId })
      return (res?.data || res) as any[]
    },
    enabled: !!patientId,
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

  const queryClient = useQueryClient()

  // 2. Mutation to save tooth conditions
  const { mutate: saveCondition, isPending: isSavingCondition } = useMutation({
    mutationFn: (condition: string) => {
      if (!activeTooth) return Promise.reject(new Error('No tooth selected')) // Safety check

      // Build the teeth array from existing data, plus our new condition
      const existingTeeth: OdontogramToothData[] = odontogramData?.data?.teeth || []
      const newTeeth = existingTeeth.map((t) => ({
        toothNumber: t.toothNumber,
        condition: t.toothNumber === activeTooth ? condition : t.condition,
        surfaces: t.surfaces || [],
        notes: t.notes || ''
      }))

      // If the tooth didn't exist in the chart yet, add it
      if (activeTooth && !newTeeth.find((t) => t.toothNumber === activeTooth)) {
        newTeeth.push({
          toothNumber: activeTooth,
          condition,
          surfaces: [],
          notes: ''
        })
      }

      return dentalApi.createOdontogram({
        patientId,
        notes: `Recorded ${condition} on tooth ${activeTooth}`,
        teeth: newTeeth
      })
    },
    onSuccess: (_, condition) => {
      toast({
        title: 'Tooth Updated',
        description: `Successfully saved ${condition} for Tooth #${activeTooth}`,
      })
      void queryClient.invalidateQueries({ queryKey: ['odontogram', patientId] })
    },
    onError: () => {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to save tooth condition to database.',
      })
    }
  })

  if (isLoading) return <div className="p-8 text-center animate-pulse">Loading Patient 360...</div>
  if (!patient) return <div className="p-8 text-center text-red-500">Patient not found</div>

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* ── Header & Alerts ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">{patient.firstName} {patient.lastName}</h1>
            <Badge variant="outline" className="bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
              {patient.uhid}
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm">
            {patient.dateOfBirth ? `${new Date().getFullYear() - new Date(patient.dateOfBirth).getFullYear()}y` : 'Age unknown'} • {patient.gender} • Blood: {patient.bloodGroup?.replace('_POSITIVE', '+').replace('_NEGATIVE', '-') || 'Unknown'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">Edit Profile</Button>
          <Button className="shadow-lg shadow-blue-500/20">Book Appointment</Button>
        </div>
      </div>

      {/* Safety Alerts */}
      {dentalProfileData?.safetyAlerts?.length > 0 && (
        <Alert variant="destructive" className="bg-red-50/50 dark:bg-red-950/20 border-red-200 dark:border-red-900">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Medical Alerts & Allergies</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-4 mt-2">
              {dentalProfileData.safetyAlerts.map((alert: any) => (
                <li key={alert.id} className="font-medium text-red-900 dark:text-red-200">
                  <span className="font-bold uppercase text-xs mr-2 border border-red-300 dark:border-red-800 rounded px-1">{alert.alertType}</span>
                  {alert.description}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* ── Main Connected Workflow Workspace ── */}
      <Tabs defaultValue="medical" className="w-full">
        <TabsList className="grid grid-cols-2 md:grid-cols-7 w-full h-auto gap-2 bg-transparent p-0">
          <TabsTrigger value="medical" className="data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm rounded-lg py-2.5 border border-transparent data-[state=active]:border-border/50">
            Medical
          </TabsTrigger>
          <TabsTrigger value="odontogram" className="data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm rounded-lg py-2.5 border border-transparent data-[state=active]:border-border/50">
            Odontogram
          </TabsTrigger>
          <TabsTrigger value="encounters" className="data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm rounded-lg py-2.5 border border-transparent data-[state=active]:border-border/50">
            Encounters
          </TabsTrigger>
          <TabsTrigger value="treatment" className="data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm rounded-lg py-2.5 border border-transparent data-[state=active]:border-border/50">
            Treatment Plans
          </TabsTrigger>
          <TabsTrigger value="lab" className="data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm rounded-lg py-2.5 border border-transparent data-[state=active]:border-border/50">
            Lab Cases
          </TabsTrigger>
          <TabsTrigger value="imaging" className="data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm rounded-lg py-2.5 border border-transparent data-[state=active]:border-border/50">
            Imaging (CBCT/RVG)
          </TabsTrigger>
          <TabsTrigger value="billing" className="data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm rounded-lg py-2.5 border border-transparent data-[state=active]:border-border/50">
            Ledger
          </TabsTrigger>
        </TabsList>

        <div className="mt-6">

          {/* 0. Medical History Tab */}
          <TabsContent value="medical" className="m-0 focus-visible:outline-none">
            <MedicalHistoryTab patientId={patientId} dentalProfileData={dentalProfileData} />
          </TabsContent>

          {/* 1. Odontogram Tab */}
          <TabsContent value="odontogram" className="m-0 focus-visible:outline-none">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <Card className="h-full border-0 shadow-xl shadow-slate-200/40 dark:shadow-none bg-white/60 dark:bg-zinc-950/60 backdrop-blur-xl">
                  <CardHeader className="border-b border-border/50">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-lg">
                          {dentitionType === 'adult' ? 'Permanent Dentition' : 'Primary Dentition'}
                        </CardTitle>
                        <CardDescription>FDI ISO System</CardDescription>
                      </div>
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
                    </div>
                  </CardHeader>
                  <CardContent className="p-8">
                    <OdontogramChart
                      activeTooth={activeTooth}
                      onSelectTooth={setActiveTooth}
                      teethData={odontogramData?.data?.teeth || []}
                      type={dentitionType}
                    />
                  </CardContent>
                </Card>
              </div>
              <div>
                <Card className="h-full border-0 shadow-xl shadow-slate-200/40 dark:shadow-none bg-white/80 dark:bg-zinc-950/80 backdrop-blur-xl">
                  <CardHeader className="border-b border-border/50">
                    <CardTitle className="text-lg">Tooth {activeTooth ? `#${activeTooth}` : 'Details'}</CardTitle>
                    <CardDescription>
                      {activeTooth ? 'Record findings and plan treatments' : 'Select a tooth'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-6">
                    {activeTooth ? (
                      <div className="space-y-6">
                        <div>
                          <h4 className="text-sm font-medium mb-3">Conditions</h4>
                          <div className="flex flex-wrap gap-2">
                            {[
                              { id: 'CARIES', label: 'Caries' },
                              { id: 'RESTORED_COMPOSITE', label: 'Restored' },
                              { id: 'MISSING', label: 'Missing' },
                              { id: 'CROWN', label: 'Crown' }
                            ].map(cond => {
                              const existingTeeth: OdontogramToothData[] = odontogramData?.data?.teeth || []
                              const currentTooth = existingTeeth.find((t) => t.toothNumber === activeTooth)
                              const isActiveCondition = currentTooth?.condition === cond.id

                              return (
                                <Badge
                                  key={cond.id}
                                  variant={isActiveCondition ? "default" : "secondary"}
                                  className={cn(
                                    "cursor-pointer transition-colors",
                                    isActiveCondition
                                      ? "bg-blue-600 hover:bg-blue-700"
                                      : "hover:bg-blue-100 dark:hover:bg-blue-900",
                                    isSavingCondition && "opacity-50 pointer-events-none"
                                  )}
                                  onClick={() => saveCondition(cond.id)}
                                >
                                  + {cond.label}
                                </Badge>
                              )
                            })}
                          </div>
                        </div>
                        <hr className="border-border/50" />
                        <div>
                          <h4 className="text-sm font-medium mb-3">Quick Actions</h4>
                          <div className="grid gap-2">
                            <Button variant="outline" size="sm" className="justify-start">
                              <Plus className="h-3 w-3 mr-2" /> Add to Treatment Plan
                            </Button>
                            <Button variant="outline" size="sm" className="justify-start">
                              <Package className="h-3 w-3 mr-2" /> Request Lab Case (Crown/Cap)
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">
                        Select a tooth on the chart to interact.
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* 2. Encounters Tab */}
          <TabsContent value="encounters" className="m-0 focus-visible:outline-none">
            <Card className="border-0 shadow-xl shadow-slate-200/40 dark:shadow-none bg-white/60 dark:bg-zinc-950/60 backdrop-blur-xl">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Clinical Encounters</CardTitle>
                    <CardDescription>Chief complaint, HPI, examination, and plans.</CardDescription>
                  </div>
                  <NewEncounterDialog patientId={patientId} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {encountersLoading ? (
                    <div className="text-sm text-muted-foreground p-4 text-center">Loading encounters...</div>
                  ) : encountersData?.data?.data?.length ? (
                    encountersData.data.data.map((encounter) => (
                      <div key={encounter.id} className="flex gap-4 p-4 rounded-lg border border-border/50 bg-background/50 hover:bg-muted/50 transition-colors cursor-pointer">
                        <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0 text-blue-600">
                          <Stethoscope className="h-5 w-5" />
                        </div>
                        <div className="flex-1">
                          <div className="flex justify-between items-start">
                            <h4 className="font-medium text-foreground">
                              Consultation with Dr. {encounter.dentist?.lastName || 'Dentist'}
                            </h4>
                            <span className="text-xs text-muted-foreground">
                              {new Date(encounter.visitDate || encounter.createdAt).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                            {encounter.chiefComplaint || 'No chief complaint recorded.'}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-muted-foreground p-8 text-center border-2 border-dashed rounded-lg">
                      No clinical encounters found for this patient.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 3. Treatment Plans Tab */}
          <TabsContent value="treatment" className="m-0 focus-visible:outline-none">
            <Card className="border-0 shadow-xl shadow-slate-200/40 dark:shadow-none bg-white/60 dark:bg-zinc-950/60 backdrop-blur-xl">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Treatment Plans</CardTitle>
                    <CardDescription>Presentable, executable plans for patient acceptance.</CardDescription>
                  </div>
                  <NewTreatmentPlanDialog patientId={patientId} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {treatmentPlansLoading ? (
                    <div className="text-sm text-muted-foreground p-4 text-center">Loading plans...</div>
                  ) : treatmentPlansData?.length ? (
                    treatmentPlansData.map((plan) => (
                      <div key={plan.id} className="rounded-xl border border-border/50 overflow-hidden">
                        <div className="bg-muted/30 p-4 flex flex-col sm:flex-row sm:justify-between sm:items-center border-b border-border/50 gap-4">
                          <div>
                            <div className="flex items-center gap-3">
                              <h4 className="font-semibold text-foreground">{plan.title}</h4>
                              {(() => {
                                const status = plan.options?.[0]?.acceptance?.status || 'PENDING';
                                let colorClass = 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-500 border-yellow-200 dark:border-yellow-900';
                                if (status === 'ACCEPTED') colorClass = 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-500 border-green-200 dark:border-green-900';
                                if (status === 'DECLINED') colorClass = 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-500 border-red-200 dark:border-red-900';
                                if (status === 'CALLBACK_REQUESTED') colorClass = 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-500 border-blue-200 dark:border-blue-900';
                                return <Badge variant="outline" className={`text-[10px] uppercase ${colorClass}`}>{status.replace('_', ' ')}</Badge>
                              })()}
                            </div>
                            <div className="flex gap-3 text-xs text-muted-foreground mt-1">
                              <span>Created: {new Date(plan.createdAt).toLocaleDateString()}</span>
                            </div>
                          </div>
                          {plan.options.length > 0 && (
                            <div className="text-right mt-3 sm:mt-0">
                              <div className="text-lg font-bold text-foreground">₹{Number(plan.options[0].netCost).toLocaleString()}</div>
                              <div className="text-xs text-muted-foreground">Estimated Cost ({plan.options[0].label})</div>
                            </div>
                          )}
                        </div>

                        {plan.options.length > 0 && plan.options[0].treatmentPlan?.length > 0 ? (
                          <div className="p-4 space-y-3 bg-background/50">
                            {plan.options[0].treatmentPlan.map((item) => (
                              <div key={item.id} className="flex justify-between text-sm items-center py-2 border-b border-border/20 last:border-0">
                                <div className="flex items-center gap-3">
                                  {item.toothNumber && (
                                    <span className="font-mono bg-muted px-2 py-0.5 rounded text-xs">{item.toothNumber}</span>
                                  )}
                                  <span>{item.procedureName}</span>
                                </div>
                                <span className="font-medium">₹{Number(item.estimatedCost).toLocaleString()}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="p-4 text-sm text-muted-foreground bg-background/50">No items in this plan.</div>
                        )}

                        <div className="bg-muted/20 p-3 border-t border-border/50 flex items-center justify-end gap-2">
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => toast({ title: 'Edit Plan', description: 'Editing existing plans is coming in a future update. You can create a new plan.' })}>
                              Edit
                            </Button>
                            {plan.options?.[0]?.id && (
                              <RecordAcceptanceDialog
                                patientId={patientId}
                                optionId={plan.options[0].id}
                                currentStatus={plan.options[0].acceptance?.status}
                                currentNotes={plan.options[0].acceptance?.notes}
                              />
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-muted-foreground p-8 text-center border-2 border-dashed rounded-lg">
                      No treatment plans found for this patient.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="lab" className="m-0 focus-visible:outline-none">
            <Card className="border-0 shadow-xl shadow-slate-200/40 dark:shadow-none bg-white/60 dark:bg-zinc-950/60 backdrop-blur-xl">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Lab Cases</CardTitle>
                    <CardDescription>Manage and track lab restorations (crowns, bridges, etc).</CardDescription>
                  </div>
                  <NewLabCaseDialog patientId={patientId} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {labCasesLoading ? (
                    <div className="text-sm text-muted-foreground p-4 text-center">Loading lab cases...</div>
                  ) : labCasesData?.length ? (
                    labCasesData.map((labCase) => (
                      <div key={labCase.id} className="flex flex-col gap-3 p-4 rounded-lg border border-border/50 bg-background/50 hover:bg-muted/50 transition-colors">
                        <div className="flex justify-between items-start">
                          <div className="flex gap-4 items-center">
                            <div className="h-10 w-10 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center flex-shrink-0 text-orange-600">
                              <Package className="h-5 w-5" />
                            </div>
                            <div>
                              <h4 className="font-medium text-foreground">
                                {labCase.restorationName}
                              </h4>
                              <div className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                                <span>Vendor: {labCase.vendor?.name || 'Unknown'}</span>
                                <span>•</span>
                                {getStatusBadge(labCase.status)}
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                              {new Date(labCase.createdAt).toLocaleDateString()}
                            </span>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              className="h-8 text-xs font-medium"
                              onClick={() => setSelectedLabCase(labCase)}
                            >
                              View Details
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-muted-foreground p-8 text-center border-2 border-dashed rounded-lg flex flex-col items-center gap-2">
                      <Package className="h-8 w-8 opacity-50" />
                      <p>No active lab cases for this patient.</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <LabCaseDetailsSheet 
              labCase={selectedLabCase} 
              onClose={() => setSelectedLabCase(null)} 
            />
          </TabsContent>

          <TabsContent value="imaging" className="m-0 focus-visible:outline-none">
            <ImagingTab patientId={patientId} />
          </TabsContent>

          <TabsContent value="billing" className="m-0 focus-visible:outline-none">
            <LedgerTab patientId={patientId} />
          </TabsContent>

        </div>
      </Tabs>
    </div>
  )
}
