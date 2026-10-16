/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-misused-promises */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, ShieldAlert } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { dentalApi } from '@/lib/api/dental'

const medicalHistorySchema = z.object({
  allergies: z.string().optional(),
  currentMedications: z.string().optional(),
  conditions: z.string().optional(),
  preMedicationNotes: z.string().optional(),
})

const safetyAlertSchema = z.object({
  alertType: z.string().min(1, 'Type is required'),
  severity: z.string().min(1, 'Severity is required'),
  description: z.string().min(1, 'Description is required'),
})

interface MedicalHistoryTabProps {
  patientId: string
  dentalProfileData: any
}

export function MedicalHistoryTab({ patientId, dentalProfileData }: MedicalHistoryTabProps) {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const medicalHistory = dentalProfileData?.medicalHistories?.[0]

  const historyForm = useForm<z.infer<typeof medicalHistorySchema>>({
    resolver: zodResolver(medicalHistorySchema),
    defaultValues: {
      allergies: medicalHistory?.allergies?.join(', ') || '',
      currentMedications: medicalHistory?.currentMedications?.join(', ') || '',
      conditions: medicalHistory?.conditions?.join(', ') || '',
      preMedicationNotes: medicalHistory?.preMedicationNotes || '',
    },
  })

  const alertForm = useForm<z.infer<typeof safetyAlertSchema>>({
    resolver: zodResolver(safetyAlertSchema),
    defaultValues: {
      alertType: 'ALLERGY',
      severity: 'HIGH',
      description: '',
    },
  })

  const historyMutation = useMutation({
    mutationFn: (values: z.infer<typeof medicalHistorySchema>) => {
      return dentalApi.createMedicalHistory(patientId, {
        patientId,
        allergies: values.allergies?.split(',').map(s => s.trim()).filter(Boolean) || [],
        currentMedications: values.currentMedications?.split(',').map(s => s.trim()).filter(Boolean) || [],
        conditions: values.conditions?.split(',').map(s => s.trim()).filter(Boolean) || [],
        preMedicationNotes: values.preMedicationNotes,
      })
    },
    onSuccess: () => {
      toast({ title: 'Success', description: 'Medical history updated' })
      void queryClient.invalidateQueries({ queryKey: ['dental-patient-profile', patientId] })
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to save medical history' })
      console.error(error)
    }
  })

  const alertMutation = useMutation({
    mutationFn: (values: z.infer<typeof safetyAlertSchema>) => {
      return dentalApi.createSafetyAlert(patientId, { ...values, patientId })
    },
    onSuccess: () => {
      toast({ title: 'Alert Added', description: 'Safety alert has been recorded.' })
      alertForm.reset()
      void queryClient.invalidateQueries({ queryKey: ['dental-patient-profile', patientId] })
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to add safety alert' })
      console.error(error)
    }
  })

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Medical History Form */}
      <Card>
        <CardHeader>
          <CardTitle>Medical History</CardTitle>
          <CardDescription>Record clinical conditions, allergies, and medications.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...historyForm}>
            <form onSubmit={historyForm.handleSubmit((d) => historyMutation.mutate(d))} className="space-y-4">
              <FormField
                control={historyForm.control}
                name="conditions"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Medical Conditions (Comma separated)</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Hypertension, Diabetes" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={historyForm.control}
                name="allergies"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Allergies (Comma separated)</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Penicillin, Latex" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={historyForm.control}
                name="currentMedications"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Current Medications (Comma separated)</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Metformin, Aspirin" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={historyForm.control}
                name="preMedicationNotes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pre-Medication Notes</FormLabel>
                    <FormControl>
                      <Textarea placeholder="e.g. Requires amoxicillin 2g 1hr prior to procedure" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={historyMutation.isPending}>
                {historyMutation.isPending ? 'Saving...' : 'Save Medical History'}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Safety Alerts */}
      <div className="space-y-6">
        <Card className="border-red-200 dark:border-red-900 bg-red-50/20 dark:bg-red-950/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <ShieldAlert className="h-5 w-5" />
              Add Safety Alert
            </CardTitle>
            <CardDescription>Critical alerts prominently displayed across the patient chart.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...alertForm}>
              <form onSubmit={alertForm.handleSubmit((d) => alertMutation.mutate(d))} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={alertForm.control}
                    name="alertType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Type</FormLabel>
                        <FormControl>
                          <select
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            {...field}
                          >
                            <option value="ALLERGY">Allergy</option>
                            <option value="MEDICAL_CONDITION">Medical Condition</option>
                            <option value="MEDICATION">Medication Alert</option>
                            <option value="BEHAVIORAL">Behavioral</option>
                          </select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={alertForm.control}
                    name="severity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Severity</FormLabel>
                        <FormControl>
                          <select
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            {...field}
                          >
                            <option value="LOW">Low</option>
                            <option value="MEDIUM">Medium</option>
                            <option value="HIGH">High</option>
                            <option value="CRITICAL">Critical</option>
                          </select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={alertForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Alert Description</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Severe Penicillin Allergy (Anaphylaxis)" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" variant="destructive" disabled={alertMutation.isPending}>
                  <Plus className="h-4 w-4 mr-2" />
                  {alertMutation.isPending ? 'Adding...' : 'Add Alert'}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        {dentalProfileData?.safetyAlerts?.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-semibold">Active Alerts</h4>
            {dentalProfileData.safetyAlerts.map((alert: any) => (
              <div key={alert.id} className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-lg flex flex-col gap-1">
                <div className="flex gap-2 items-center">
                  <Badge variant="outline" className="bg-red-100 text-red-800 border-red-200">{alert.severity}</Badge>
                  <span className="text-xs font-semibold text-muted-foreground uppercase">{alert.alertType}</span>
                </div>
                <span className="text-red-900 dark:text-red-200 font-medium">{alert.description}</span>
                <span className="text-[10px] text-muted-foreground">Added: {new Date(alert.createdAt).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
