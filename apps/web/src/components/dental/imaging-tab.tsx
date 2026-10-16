/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FileImage, ImagePlus, Upload } from 'lucide-react'
import { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { dentalApi } from '@/lib/api/dental'

interface ImagingTabProps {
  patientId: string
}

export function ImagingTab({ patientId }: ImagingTabProps) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [viewingRecord, setViewingRecord] = useState<any>(null)

  // Form State (Mocking a real file upload for now)
  const [imagingType, setImagingType] = useState('CBCT')
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  const { data: records, isLoading } = useQuery<any[]>({
    queryKey: ['dental-imaging', patientId],
    queryFn: async () => {
      const res = await dentalApi.listImagingRecords(patientId)
      return res?.data || res || []
    },
    enabled: !!patientId,
  })

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFile) throw new Error('No file selected')
      
      const formData = new FormData()
      formData.append('file', selectedFile)
      formData.append('imagingType', imagingType)
      if (title) formData.append('title', title)
      if (notes) formData.append('notes', notes)
      
      return dentalApi.uploadImagingRecord(patientId, formData)
    },
    onSuccess: () => {
      toast({ title: 'Upload Complete', description: 'Imaging record saved securely.' })
      setOpen(false)
      setTitle('')
      setNotes('')
      setSelectedFile(null)
      void queryClient.invalidateQueries({ queryKey: ['dental-imaging', patientId] })
    },
    onError: (err) => {
      toast({ variant: 'destructive', title: 'Upload Failed', description: 'Could not save the image.' })
      console.error(err)
    }
  })

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Imaging & CBCT</h2>
          <p className="text-muted-foreground">Manage X-Rays, CBCT scans, and intraoral photos.</p>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Upload className="h-4 w-4 mr-2" />
              Upload Scan
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Upload New Imaging</DialogTitle>
              <DialogDescription>
                Upload DICOM, JPEG, or PNG files to the patient&apos;s record.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Scan Type</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={imagingType}
                  onChange={(e) => setImagingType(e.target.value)}
                >
                  <option value="OPG">OPG (Panoramic)</option>
                  <option value="CBCT">CBCT (3D Volume)</option>
                  <option value="BITEWING">Bitewing</option>
                  <option value="PERIAPICAL">Periapical (PA)</option>
                  <option value="INTRAORAL_PHOTO">Intraoral Photo</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Title / Description</Label>
                <Input placeholder="e.g. Pre-op Implant Planning Scan" value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>File Upload</Label>
                <label 
                  htmlFor="file-upload"
                  className="border-2 border-dashed border-border rounded-lg p-6 flex flex-col items-center justify-center bg-muted/20 text-muted-foreground hover:bg-muted/40 transition-colors cursor-pointer block"
                >
                  <input 
                    id="file-upload" 
                    type="file" 
                    className="hidden" 
                    accept=".dcm,image/jpeg,image/png" 
                    onChange={(e) => {
                      if (e.target.files && e.target.files.length > 0) {
                        setSelectedFile(e.target.files[0])
                        if (!title) setTitle(e.target.files[0].name)
                      }
                    }}
                  />
                  {selectedFile ? (
                    <>
                      <FileImage className="h-8 w-8 mb-2 text-primary mx-auto" />
                      <span className="text-sm font-medium block text-center text-primary">{selectedFile.name}</span>
                      <span className="text-xs mt-1 block text-center">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</span>
                    </>
                  ) : (
                    <>
                      <ImagePlus className="h-8 w-8 mb-2 opacity-50 mx-auto" />
                      <span className="text-sm font-medium block text-center">Click to browse or drag and drop</span>
                      <span className="text-xs mt-1 block text-center">DICOM, JPEG, PNG (Max 500MB)</span>
                    </>
                  )}
                </label>
              </div>
              <div className="space-y-2">
                <Label>Clinical Notes</Label>
                <Textarea placeholder="Findings or notes..." value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
              <Button className="w-full" onClick={() => uploadMutation.mutate()} disabled={uploadMutation.isPending}>
                {uploadMutation.isPending ? 'Uploading...' : 'Save Record'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          <div className="col-span-full text-center p-8 text-muted-foreground">Loading records...</div>
        ) : records && records.length > 0 ? (
          records.map((record: any) => (
            <Card key={record.id} className="overflow-hidden hover:border-primary/50 transition-colors">
              <div 
                className="h-40 bg-zinc-900 flex items-center justify-center relative group cursor-pointer"
                onClick={() => setViewingRecord(record)}
              >
                <FileImage className="h-12 w-12 text-zinc-700 group-hover:text-zinc-500 transition-colors" />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <Button variant="secondary" size="sm" onClick={(e) => { e.stopPropagation(); setViewingRecord(record) }}>View Scan</Button>
                </div>
              </div>
              <CardContent className="p-4 space-y-2">
                <div className="flex justify-between items-start gap-2">
                  <h3 className="font-semibold text-sm line-clamp-1">{record.title || record.imagingType}</h3>
                  <Badge variant="secondary" className="text-[10px]">{record.imagingType}</Badge>
                </div>
                {record.notes && <p className="text-xs text-muted-foreground line-clamp-2">{record.notes}</p>}
                <div className="pt-2 text-[10px] text-muted-foreground flex justify-between border-t border-border/50">
                  <span>{new Date(record.takenAt).toLocaleDateString()}</span>
                  <span>{(record.fileSizeBytes / 1024 / 1024).toFixed(1)} MB</span>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="col-span-full text-center p-12 border-2 border-dashed rounded-xl text-muted-foreground bg-muted/10">
            <FileImage className="h-8 w-8 mx-auto mb-3 opacity-20" />
            <p>No imaging records found.</p>
            <p className="text-sm mt-1">Upload a scan to securely attach it to the patient&apos;s record.</p>
          </div>
        )}
      </div>

      <Dialog open={!!viewingRecord} onOpenChange={(open) => !open && setViewingRecord(null)}>
        <DialogContent className="max-w-4xl bg-zinc-950 border-zinc-800">
          <DialogHeader>
            <DialogTitle className="text-zinc-100">{viewingRecord?.title || viewingRecord?.imagingType}</DialogTitle>
            <DialogDescription className="text-zinc-400">
              DICOM / Image Viewer Placeholder
            </DialogDescription>
          </DialogHeader>
          <div className="h-[60vh] flex items-center justify-center bg-black rounded-md overflow-hidden relative">
            <div className="absolute top-4 right-4 bg-black/50 text-white px-2 py-1 rounded text-xs">
              {viewingRecord?.imagingType}
            </div>
            <FileImage className="h-32 w-32 text-zinc-800" />
            <p className="absolute bottom-4 text-zinc-500 text-sm">
              In production, a full WebGL DICOM viewer mounts here.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
