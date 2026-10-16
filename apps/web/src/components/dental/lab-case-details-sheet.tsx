/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Edit } from 'lucide-react'
import { useState, useEffect } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetBody } from '@/components/ui/sheet'
import { useToast } from '@/hooks/use-toast'
import { dentalApi } from '@/lib/api/dental'

export function LabCaseDetailsSheet({
  labCase,
  onClose,
}: {
  labCase: any
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const [statusDraft, setStatusDraft] = useState<string>('')

  useEffect(() => {
    if (labCase) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      setStatusDraft(labCase.status)
    }
  }, [labCase])

  const updateMutation = useMutation({
    mutationFn: (newStatus: string) => dentalApi.updateLabCaseStatus(labCase.id, { status: newStatus }),
    onSuccess: () => {
      toast({ title: 'Status Updated', description: 'Lab case status was updated successfully.' })
      void queryClient.invalidateQueries({ queryKey: ['dental-lab-cases'] })
    }
  })

  const handleUpdateStatus = () => {
    if (!labCase || !statusDraft || statusDraft === labCase.status) return
    updateMutation.mutate(statusDraft)
    labCase.status = statusDraft
  }

  return (
    <Sheet open={!!labCase} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="sm:max-w-md">
        <SheetHeader className="mb-0 border-b pb-4">
          <SheetTitle className="text-xl">Lab Case Details</SheetTitle>
          <SheetDescription>
            Case ID: <span className="font-mono text-xs">{labCase?.id}</span>
          </SheetDescription>
        </SheetHeader>

        {labCase && (
          <SheetBody className="space-y-6">
            <div className="grid grid-cols-3 gap-y-6 gap-x-4 text-sm">
              <div className="font-medium text-muted-foreground">Patient</div>
              <div className="col-span-2 text-foreground font-medium capitalize">
                {labCase.patient?.firstName} {labCase.patient?.lastName}
              </div>

              <div className="font-medium text-muted-foreground">Restoration</div>
              <div className="col-span-2 text-foreground font-medium capitalize">{labCase.restorationName}</div>

              <div className="font-medium text-muted-foreground">Vendor</div>
              <div className="col-span-2 text-foreground font-medium capitalize">{labCase.vendor?.name || 'Unassigned'}</div>

              <div className="font-medium text-muted-foreground">Notes</div>
              <div className="col-span-2 text-foreground">{labCase.notes || 'No notes provided.'}</div>
            </div>

            <div className="border-t pt-6 space-y-4">
              <h4 className="font-medium flex items-center gap-2">
                <Edit className="h-4 w-4" /> Update Status
              </h4>
              <div className="flex items-center gap-3">
                <Select value={statusDraft} onValueChange={setStatusDraft}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DRAFT">Draft</SelectItem>
                    <SelectItem value="SENT_TO_VENDOR">Sent to Lab</SelectItem>
                    <SelectItem value="RECEIVED">Received</SelectItem>
                    <SelectItem value="REMAKE">Remake</SelectItem>
                    <SelectItem value="COMPLETED">Completed</SelectItem>
                    <SelectItem value="CANCELLED">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  onClick={handleUpdateStatus}
                  disabled={updateMutation.isPending || statusDraft === labCase.status}
                  className="shrink-0"
                >
                  {updateMutation.isPending ? 'Updating...' : 'Save'}
                </Button>
              </div>
            </div>

            {labCase.measurements && labCase.measurements.length > 0 && (
              <div className="border-t pt-6 space-y-4">
                <h4 className="font-medium text-sm text-muted-foreground">Measurements & Specifications</h4>
                <div className="space-y-3">
                  {labCase.measurements.map((m: any, idx: number) => (
                    <Card key={idx} className="bg-muted/30 border-0 shadow-none">
                      <CardContent className="p-4 text-sm grid gap-2">
                        <div className="flex justify-between font-medium">
                          <span>Tooth #{m.toothNumber}</span>
                          <span className="text-muted-foreground">{m.restorationMaterial}</span>
                        </div>
                        {m.shade && <div>Shade: {m.shadeSystem ? `${m.shadeSystem} - ` : ''}{m.shade}</div>}
                        {m.notes && <div className="text-muted-foreground italic">&quot;{m.notes}&quot;</div>}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </SheetBody>
        )}
      </SheetContent>
    </Sheet>
  )
}
