/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Loader2 } from 'lucide-react'
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
  vendorId: z.string().min(1, 'Please select a lab/vendor'),
  restorationName: z.string().min(1, 'Restoration name is required'),
  notes: z.string().optional(),
  measurements: z.array(z.object({
    toothNumber: z.number().optional().or(z.string().transform((v) => (v ? Number(v) : undefined))),
    shade: z.string().optional(),
    restorationMaterial: z.string().optional(),
  })).min(1, 'At least one tooth/measurement is required'),
})

type FormValues = z.infer<typeof formSchema>

interface NewLabCaseDialogProps {
  patientId: string
  procedureId?: string
}

export function NewLabCaseDialog({ patientId, procedureId }: NewLabCaseDialogProps) {
  const [open, setOpen] = useState(false)
  const { toast } = useToast()
  const queryClient = useQueryClient()

  // Fetch vendors
  const { data: vendorsData, isLoading: vendorsLoading } = useQuery({
    queryKey: ['dental-vendors'],
    queryFn: () => dentalApi.listVendors(),
  })

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      vendorId: '',
      restorationName: '',
      notes: '',
      measurements: [{ toothNumber: undefined, shade: '', restorationMaterial: '' }],
    },
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'measurements',
  })

  const { mutate: createLabCase, isPending } = useMutation({
    mutationFn: (values: FormValues) => {
      return dentalApi.createLabCase({
        patientId,
        procedureId,
        vendorId: values.vendorId,
        restorationName: values.restorationName,
        notes: values.notes,
        measurements: values.measurements.map(m => ({
          toothNumber: m.toothNumber,
          shade: m.shade,
          restorationMaterial: m.restorationMaterial,
        }))
      })
    },
    onSuccess: () => {
      toast({
        title: 'Lab Case Created',
        description: 'The new lab case has been created successfully.',
      })
      setOpen(false)
      form.reset()
      void queryClient.invalidateQueries({ queryKey: ['dental-lab-cases', patientId] })
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error?.response?.data?.message || 'Failed to create lab case',
      })
    },
  })

  function onSubmit(values: FormValues) {
    createLabCase(values)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-2" /> New Lab Order
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Lab Case</DialogTitle>
          <DialogDescription>
            Send a new restoration order to a vendor.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={(e) => { void form.handleSubmit(onSubmit)(e) }} className="space-y-6 mt-4">

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="vendorId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Lab / Vendor</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select vendor" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {vendorsLoading ? (
                          <div className="p-2 text-sm text-center">Loading...</div>
                        ) : vendorsData?.data?.length ? (
                          vendorsData.data.map((vendor: any) => (
                            <SelectItem key={vendor.id} value={vendor.id}>
                              {vendor.name}
                            </SelectItem>
                          ))
                        ) : (
                          <div className="p-2 text-sm text-center">No vendors found</div>
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="restorationName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Restoration Type</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Zirconia Crown" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold">Measurements & Units</h4>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => append({ toothNumber: undefined, shade: '', restorationMaterial: '' })}
                >
                  <Plus className="h-4 w-4 mr-1" /> Add Tooth
                </Button>
              </div>

              {fields.map((field, index) => (
                <div key={field.id} className="grid grid-cols-12 gap-3 items-end p-3 rounded-lg border border-border/50 bg-muted/20">
                  <div className="col-span-3">
                    <FormField
                      control={form.control}
                      name={`measurements.${index}.toothNumber`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs text-muted-foreground">Tooth #</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. 11" {...field} value={field.value || ''} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="col-span-4">
                    <FormField
                      control={form.control}
                      name={`measurements.${index}.shade`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs text-muted-foreground">Shade</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. A2" {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="col-span-4">
                    <FormField
                      control={form.control}
                      name={`measurements.${index}.restorationMaterial`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs text-muted-foreground">Material</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. PFM" {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="col-span-1 pb-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-red-500 hover:bg-red-100/50"
                      onClick={() => remove(index)}
                      disabled={fields.length === 1}
                    >
                      -
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Lab Instructions</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Special instructions for the lab..."
                      className="resize-none h-20"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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
                  'Submit Order'
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
