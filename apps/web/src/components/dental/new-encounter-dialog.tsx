'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { dentalApi } from '@/lib/api/dental'
import { listDoctors } from '@/lib/api/doctors'

const formSchema = z.object({
  dentistId: z.string().min(1, 'Please select a dentist'),
  chiefComplaint: z.string().min(3, 'Please enter a chief complaint'),
})

type FormValues = z.infer<typeof formSchema>

interface NewEncounterDialogProps {
  patientId: string
}

export function NewEncounterDialog({ patientId }: NewEncounterDialogProps) {
  const [open, setOpen] = useState(false)
  const { toast } = useToast()
  const queryClient = useQueryClient()

  // Fetch doctors for the dropdown
  const { data: doctorsData, isLoading: doctorsLoading } = useQuery({
    queryKey: ['doctors-list'],
    queryFn: () => listDoctors({ limit: 100 }),
  })

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      dentistId: '',
      chiefComplaint: '',
    },
  })

  const { mutate: createEncounter, isPending } = useMutation({
    mutationFn: (values: FormValues) => {
      return dentalApi.createEncounter({
        patientId,
        dentistId: values.dentistId,
        chiefComplaint: values.chiefComplaint,
      })
    },
    onSuccess: () => {
      toast({
        title: 'Encounter Created',
        description: 'The new clinical encounter has been started successfully.',
      })
      setOpen(false)
      form.reset()
      void queryClient.invalidateQueries({ queryKey: ['dental-encounters', patientId] })
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Error',
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
        description: error?.response?.data?.message || 'Failed to create encounter',
      })
    },
  })

  function onSubmit(values: FormValues) {
    createEncounter(values)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-2" /> New Encounter
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Start New Clinical Encounter</DialogTitle>
          <DialogDescription>
            Record a new visit and chief complaint for this patient.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={(e) => { void form.handleSubmit(onSubmit)(e) }} className="space-y-6 mt-4">
            <FormField
              control={form.control}
              name="dentistId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Attending Dentist</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a doctor" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {doctorsLoading ? (
                        <div className="p-2 text-sm text-muted-foreground flex items-center justify-center">
                          <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading...
                        </div>
                      ) : doctorsData?.data?.length ? (
                        doctorsData.data.map((doctor) => (
                          <SelectItem key={doctor.id} value={doctor.id}>
                            Dr. {doctor.firstName} {doctor.lastName}
                          </SelectItem>
                        ))
                      ) : (
                        <div className="p-2 text-sm text-muted-foreground text-center">
                          No doctors found
                        </div>
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="chiefComplaint"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Chief Complaint</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="e.g. Patient complains of pain in lower right quadrant..." 
                      className="resize-none h-24"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Starting...
                  </>
                ) : (
                  'Start Encounter'
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
