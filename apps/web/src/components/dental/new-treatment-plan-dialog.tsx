/* eslint-disable @typescript-eslint/no-unsafe-assignment */
'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Loader2, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
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
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { dentalApi } from '@/lib/api/dental'

const itemSchema = z.object({
  procedureName: z.string().min(1, 'Procedure name is required'),
  toothNumber: z.number().optional().or(z.string().transform((v) => (v ? Number(v) : undefined))),
  estimatedCost: z.number().min(0).or(z.string().transform(Number)),
})

const formSchema = z.object({
  title: z.string().min(3, 'Title is required'),
  description: z.string().optional(),
  items: z.array(itemSchema).min(1, 'At least one procedure is required'),
})

type FormValues = z.infer<typeof formSchema>

interface NewTreatmentPlanDialogProps {
  patientId: string
  encounterId?: string
}

export function NewTreatmentPlanDialog({ patientId, encounterId }: NewTreatmentPlanDialogProps) {
  const [open, setOpen] = useState(false)
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: '',
      description: '',
      items: [{ procedureName: '', estimatedCost: 0 }],
    },
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'items',
  })

  const { mutate: createPlan, isPending } = useMutation({
    mutationFn: (values: FormValues) => {
      // Calculate total cost for the default option
      const totalCost = values.items.reduce((sum, item) => sum + Number(item.estimatedCost), 0)

      return dentalApi.createTreatmentPlan({
        patientId,
        encounterId,
        title: values.title,
        description: values.description,
        options: [
          {
            label: 'Option A (Recommended)',
            totalCost,
            netCost: totalCost,
            discount: 0,
            items: values.items.map((item, index) => ({
              procedureName: item.procedureName,
              toothNumber: item.toothNumber,
              estimatedCost: Number(item.estimatedCost),
              sequence: index + 1,
            })),
          },
        ],
      })
    },
    onSuccess: () => {
      toast({
        title: 'Treatment Plan Created',
        description: 'The treatment plan has been successfully created.',
      })
      setOpen(false)
      form.reset()
      void queryClient.invalidateQueries({ queryKey: ['dental-treatment-plans', patientId] })
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Error',
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        description: error?.response?.data?.message || 'Failed to create treatment plan',
      })
    },
  })

  function onSubmit(values: FormValues) {
    createPlan(values)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-2" /> Create Plan
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Treatment Plan</DialogTitle>
          <DialogDescription>
            Propose a new treatment plan for the patient.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={(e) => { void form.handleSubmit(onSubmit)(e) }} className="space-y-6 mt-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Plan Title</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Full Mouth Restoration" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Additional notes for the patient..."
                      className="resize-none h-20"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold">Procedures</h4>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => append({ procedureName: '', estimatedCost: 0 })}
                >
                  <Plus className="h-4 w-4 mr-1" /> Add Item
                </Button>
              </div>

              {fields.map((field, index) => (
                <div key={field.id} className="grid grid-cols-12 gap-3 items-end p-3 rounded-lg border border-border/50 bg-muted/20">
                  <div className="col-span-5">
                    <FormField
                      control={form.control}
                      name={`items.${index}.procedureName`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs text-muted-foreground">Procedure Name</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. Composite Restoration" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="col-span-3">
                    <FormField
                      control={form.control}
                      name={`items.${index}.toothNumber`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs text-muted-foreground">Tooth #</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. 11" {...field} value={field.value || ''} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="col-span-3">
                    <FormField
                      control={form.control}
                      name={`items.${index}.estimatedCost`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs text-muted-foreground">Cost</FormLabel>
                          <FormControl>
                            <Input type="number" placeholder="0" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="col-span-1 pb-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-red-500 hover:text-red-700 hover:bg-red-100/50"
                      onClick={() => remove(index)}
                      disabled={fields.length === 1}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-border/50">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating...
                  </>
                ) : (
                  'Create Plan'
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
