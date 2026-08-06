'use client'

import { SystemRole } from '@medicore/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SectionHeader } from '@/components/ui/page-header'
import { TableSkeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/ui/status-badge'
import { Table, TableBody, TableCell, TableContainer, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'
import {
  activateHospital,
  deactivateHospital,
  listHospitalsWithCounts,
  onboardHospital,
} from '@/lib/api/organization'
import { useAuth } from '@/lib/auth/auth-context'

import { formatDate } from './format'

interface DepartmentDraft {
  name: string
  code: string
}

export function HospitalsPanel() {
  const { toast } = useToast()
  const { hasPermission } = useAuth()
  const queryClient = useQueryClient()

  const canCreate = hasPermission('hospitals.create')
  const canUpdate = hasPermission('hospitals.update')
  const canDeactivate = hasPermission('hospitals.delete')

  const hospitalsQuery = useQuery({
    queryKey: ['organization', 'hospitals'],
    queryFn: listHospitalsWithCounts,
  })

  const [wizardOpen, setWizardOpen] = useState(false)
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [city, setCity] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [departments, setDepartments] = useState<DepartmentDraft[]>([{ name: '', code: '' }])
  const [adminEmail, setAdminEmail] = useState('')
  const [adminFirstName, setAdminFirstName] = useState('')
  const [adminLastName, setAdminLastName] = useState('')

  function resetWizard() {
    setStep(1)
    setName('')
    setCode('')
    setCity('')
    setPhone('')
    setEmail('')
    setDepartments([{ name: '', code: '' }])
    setAdminEmail('')
    setAdminFirstName('')
    setAdminLastName('')
  }

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['organization'] })
  }

  const onboardMutation = useMutation({
    mutationFn: onboardHospital,
    onSuccess: (result) => {
      invalidate()
      setWizardOpen(false)
      resetWizard()
      toast({
        title: 'Hospital onboarded',
        description: result.admin
          ? `${result.hospital.name} created with ${result.departments.length} department(s); login sent to ${result.admin.email}.`
          : `${result.hospital.name} created with ${result.departments.length} department(s).`,
      })
    },
    onError: (error: { response?: { data?: { message?: string } } }) =>
      toast({
        title: 'Could not onboard hospital',
        description: error.response?.data?.message ?? 'Please check the details and try again.',
        variant: 'destructive',
      }),
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, activate }: { id: string; activate: boolean }) =>
      activate ? activateHospital(id) : deactivateHospital(id),
    onSuccess: (_data, variables) => {
      invalidate()
      toast({ title: variables.activate ? 'Hospital activated' : 'Hospital deactivated' })
    },
    onError: (error: { response?: { data?: { message?: string } } }) =>
      toast({
        title: 'Could not update hospital',
        description: error.response?.data?.message ?? 'Please try again.',
        variant: 'destructive',
      }),
  })

  function submitWizard() {
    const cleanedDepartments = departments
      .filter((d) => d.name.trim() && d.code.trim())
      .map((d) => ({ name: d.name.trim(), code: d.code.trim().toUpperCase() }))

    const wantsAdmin = Boolean(adminEmail.trim())

    onboardMutation.mutate({
      name: name.trim(),
      code: code.trim().toUpperCase(),
      city: city.trim() || undefined,
      phone: phone.trim() || undefined,
      email: email.trim() || undefined,
      departments: cleanedDepartments.length ? cleanedDepartments : undefined,
      admin: wantsAdmin
        ? {
            email: adminEmail.trim(),
            firstName: adminFirstName.trim(),
            lastName: adminLastName.trim(),
            systemRole: SystemRole.ORG_ADMIN,
          }
        : undefined,
    })
  }

  const hospitals = hospitalsQuery.data ?? []
  const step1Valid = name.trim().length >= 2 && /^[A-Za-z0-9-]{2,20}$/.test(code.trim())
  const step3Valid =
    !adminEmail.trim() || (Boolean(adminFirstName.trim()) && Boolean(adminLastName.trim()))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <SectionHeader
          title="Hospitals"
          description={`${hospitals.length} hospital${hospitals.length === 1 ? '' : 's'} in this organization.`}
        />
        {canCreate && (
          <Dialog
            open={wizardOpen}
            onOpenChange={(open) => {
              setWizardOpen(open)
              if (!open) resetWizard()
            }}
          >
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-1.5 h-4 w-4" />
                Onboard hospital
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Onboard hospital - step {step} of 3</DialogTitle>
              </DialogHeader>

              {step === 1 && (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label htmlFor="hosp-name">Hospital name</Label>
                    <Input
                      id="hosp-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="MediCore Main Hospital"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="hosp-code">Code</Label>
                    <Input
                      id="hosp-code"
                      value={code}
                      onChange={(e) => setCode(e.target.value.toUpperCase())}
                      placeholder="MAIN"
                    />
                    <p className="text-xs text-muted-foreground">
                      Uppercase letters, digits and hyphens. Unique within the organization.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="hosp-city">City</Label>
                      <Input id="hosp-city" value={city} onChange={(e) => setCity(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="hosp-phone">Phone</Label>
                      <Input
                        id="hosp-phone"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="hosp-email">Email</Label>
                    <Input
                      id="hosp-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Add the departments this hospital opens with. Optional - you can add more later.
                  </p>
                  {departments.map((dept, index) => (
                    <div key={index} className="flex items-end gap-2">
                      <div className="flex-1 space-y-1">
                        <Label htmlFor={`dept-name-${index}`}>Name</Label>
                        <Input
                          id={`dept-name-${index}`}
                          value={dept.name}
                          onChange={(e) =>
                            setDepartments((prev) =>
                              prev.map((d, i) => (i === index ? { ...d, name: e.target.value } : d)),
                            )
                          }
                        />
                      </div>
                      <div className="w-32 space-y-1">
                        <Label htmlFor={`dept-code-${index}`}>Code</Label>
                        <Input
                          id={`dept-code-${index}`}
                          value={dept.code}
                          onChange={(e) =>
                            setDepartments((prev) =>
                              prev.map((d, i) =>
                                i === index ? { ...d, code: e.target.value.toUpperCase() } : d,
                              ),
                            )
                          }
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="Remove department"
                        onClick={() => setDepartments((prev) => prev.filter((_, i) => i !== index))}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setDepartments((prev) => [...prev, { name: '', code: '' }])}
                  >
                    Add department
                  </Button>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Optionally provision an administrator login scoped to this hospital. Leave the
                    email blank to skip.
                  </p>
                  <div className="space-y-1">
                    <Label htmlFor="admin-email">Administrator email</Label>
                    <Input
                      id="admin-email"
                      type="email"
                      value={adminEmail}
                      onChange={(e) => setAdminEmail(e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="admin-first">First name</Label>
                      <Input
                        id="admin-first"
                        value={adminFirstName}
                        onChange={(e) => setAdminFirstName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="admin-last">Last name</Label>
                      <Input
                        id="admin-last"
                        value={adminLastName}
                        onChange={(e) => setAdminLastName(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              )}

              <DialogFooter className="gap-2 sm:justify-between">
                <Button
                  type="button"
                  variant="outline"
                  disabled={step === 1}
                  onClick={() => setStep((s) => (s === 3 ? 2 : 1))}
                >
                  Back
                </Button>
                {step < 3 ? (
                  <Button
                    type="button"
                    disabled={step === 1 && !step1Valid}
                    onClick={() => setStep((s) => (s === 1 ? 2 : 3))}
                  >
                    Next
                  </Button>
                ) : (
                  <Button
                    type="button"
                    disabled={!step1Valid || !step3Valid || onboardMutation.isPending}
                    onClick={submitWizard}
                  >
                    {onboardMutation.isPending ? 'Creating…' : 'Create hospital'}
                  </Button>
                )}
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {hospitalsQuery.isLoading ? (
        <TableSkeleton rows={5} columns={9} />
      ) : hospitals.length === 0 ? (
        <EmptyState
          title="No hospitals yet"
          description="Use “Onboard hospital” to add the first one."
          action={canCreate ? { label: 'Onboard hospital', onClick: () => setWizardOpen(true) } : undefined}
        />
      ) : (
        <TableContainer>
          <Table container={false}>
            <TableHeader>
              <TableRow>
                <TableHead>Hospital</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>City</TableHead>
                <TableHead align="right">Departments</TableHead>
                <TableHead align="right">Doctors</TableHead>
                <TableHead align="right">Staff</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Status</TableHead>
                <TableHead align="right" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {hospitals.map((hospital) => (
                <TableRow key={hospital.id}>
                  <TableCell className="font-medium">{hospital.name}</TableCell>
                  <TableCell>{hospital.code}</TableCell>
                  <TableCell>{hospital.city ?? '-'}</TableCell>
                  <TableCell align="right">{hospital._count.departments}</TableCell>
                  <TableCell align="right">{hospital._count.doctors}</TableCell>
                  <TableCell align="right">{hospital._count.staff}</TableCell>
                  <TableCell>{formatDate(hospital.createdAt)}</TableCell>
                  <TableCell>
                    <StatusBadge status={hospital.isActive ? 'ACTIVE' : 'INACTIVE'} />
                  </TableCell>
                  <TableCell align="right">
                    {hospital.isActive
                      ? canDeactivate && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={toggleMutation.isPending}
                            onClick={() => toggleMutation.mutate({ id: hospital.id, activate: false })}
                          >
                            Deactivate
                          </Button>
                        )
                      : canUpdate && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={toggleMutation.isPending}
                            onClick={() => toggleMutation.mutate({ id: hospital.id, activate: true })}
                          >
                            Activate
                          </Button>
                        )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <p className="text-xs text-muted-foreground">
        Deactivating a hospital hides it from pickers and blocks new activity. It deliberately does
        not cascade to departments, staff, or in-flight admissions.
      </p>
    </div>
  )
}
