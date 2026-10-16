/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle, Loader2 } from 'lucide-react'
import { useState, useEffect } from 'react'
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

const formSchema = z.object({
  status: z.enum(['ACCEPTED', 'DECLINED', 'DEFERRED', 'CALLBACK_REQUESTED']),
  notes: z.string().optional(),
})

type FormValues = z.infer<typeof formSchema>

interface RecordAcceptanceDialogProps {
  patientId: string
  optionId: string
  currentStatus?: string
  currentNotes?: string
}

export function RecordAcceptanceDialog({ patientId, optionId, currentStatus, currentNotes }: RecordAcceptanceDialogProps) {
  const [open, setOpen] = useState(false)
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      status: (currentStatus as FormValues['status']) || 'ACCEPTED',
      notes: currentNotes || '',
    },
  })

  // Update form if props change when dialog opens
  useEffect(() => {
    if (open) {
      form.reset({
        status: (currentStatus as FormValues['status']) || 'ACCEPTED',
        notes: currentNotes || '',
      })
    }
  }, [open, currentStatus, currentNotes, form])

  const { mutate: recordAcceptance, isPending } = useMutation({
    mutationFn: (values: FormValues) => {
      return dentalApi.recordAcceptance(patientId, {
        optionId,
        status: values.status,
        notes: values.notes,
      })
    },
    onSuccess: () => {
      toast({
        title: 'Acceptance Recorded',
        description: 'The treatment plan acceptance status has been updated.',
      })
      setOpen(false)
      form.reset()
      void queryClient.invalidateQueries({ queryKey: ['dental-treatment-plans', patientId] })
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error?.response?.data?.message || 'Failed to record acceptance',
      })
    },
  })

  function onSubmit(values: FormValues) {
    recordAcceptance(values)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="bg-green-600 hover:bg-green-700">
          <CheckCircle className="h-4 w-4 mr-2" />
          Record Acceptance
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Record Acceptance</DialogTitle>
          <DialogDescription>
            Update the patient&apos;s decision on this treatment option.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={(e) => { void form.handleSubmit(onSubmit)(e) }} className="space-y-6 mt-4">
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="ACCEPTED">Accepted</SelectItem>
                      <SelectItem value="DECLINED">Declined</SelectItem>
                      <SelectItem value="DEFERRED">Deferred</SelectItem>
                      <SelectItem value="CALLBACK_REQUESTED">Needs Callback</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Any additional notes..."
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
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
                  </>
                ) : (
                  'Save Record'
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
