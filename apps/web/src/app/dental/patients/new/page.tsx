'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import type { CreatePatientDto } from '@medicore/types'
import { CreatePatientSchema, Gender, BloodGroup } from '@medicore/types'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, CalendarIcon, User, Phone, Mail, Droplets, Users } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { dentalApi } from '@/lib/api/dental'
import { createPatient } from '@/lib/api/patients'

export default function RegisterDentalPatientPage() {
  const router = useRouter()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const form = useForm<CreatePatientDto>({
    resolver: zodResolver(CreatePatientSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      phone: '',
      email: '',
      dateOfBirth: '',
      gender: Gender.MALE,
    },
  })

  const { mutate, isPending } = useMutation({
    mutationFn: async (values: CreatePatientDto) => {
      // 1. Create the base hospital patient record
      const newPatient = await createPatient(values)
      // 2. Automatically provision the Dental OS profile
      try {
        await dentalApi.createPatientProfile(newPatient.id, {
          patientId: newPatient.id,
        })
      } catch (err) {
        console.warn('Dental profile provision note:', err)
      }
      return newPatient
    },
    onSuccess: (newPatient) => {
      toast({
        title: 'Patient registered successfully',
        description: `${newPatient.firstName} ${newPatient.lastName ?? ''} has been added to your clinic.`,
      })
      // Clear the form fields
      form.reset({
        firstName: '',
        lastName: '',
        phone: '',
        email: '',
        dateOfBirth: '',
        gender: Gender.MALE,
      })
      // Refresh patient lists and navigate directly to the new patient's chart
      void queryClient.invalidateQueries({ queryKey: ['dental-patients'] })
      void queryClient.invalidateQueries({ queryKey: ['patients'] })
      router.push(`/dental/patients/${newPatient.id}`)
      router.refresh()
    },
    onError: (error: Error & { response?: { data?: { message?: string } } }) => {
      toast({
        variant: 'destructive',
        title: 'Registration failed',
        description: error.response?.data?.message || error.message || 'An error occurred while creating the patient',
      })
    },
  })

  function onSubmit(values: CreatePatientDto) {
    mutate(values)
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dental/patients">
            <ChevronLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Register New Patient</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Create a unified patient record that syncs across Dental and Hospital modules securely.
          </p>
        </div>
      </div>

      <Card className="border-0 shadow-xl shadow-slate-200/40 dark:shadow-none bg-white/60 dark:bg-zinc-950/60 backdrop-blur-xl">
        <CardHeader>
          <CardTitle>Personal Details</CardTitle>
          <CardDescription>Enter the patient&apos;s basic contact and demographic information.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={(e) => { void form.handleSubmit(onSubmit)(e) }} className="space-y-6">

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>First Name</FormLabel>
                      <div className="relative flex items-center">
                        <User className="absolute left-3 h-4 w-4 text-muted-foreground pointer-events-none" />
                        <FormControl>
                          <Input className="pl-10" placeholder="John" {...field} />
                        </FormControl>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Last Name</FormLabel>
                      <div className="relative flex items-center">
                        <User className="absolute left-3 h-4 w-4 text-muted-foreground pointer-events-none" />
                        <FormControl>
                          <Input className="pl-10" placeholder="Doe" {...field} />
                        </FormControl>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Mobile Number</FormLabel>
                      <div className="relative flex items-center">
                        <Phone className="absolute left-3 h-4 w-4 text-muted-foreground pointer-events-none" />
                        <FormControl>
                          <Input className="pl-10" placeholder="9876543210" {...field} />
                        </FormControl>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Email (Optional)</FormLabel>
                      <div className="relative flex items-center">
                        <Mail className="absolute left-3 h-4 w-4 text-muted-foreground pointer-events-none" />
                        <FormControl>
                          <Input className="pl-10" placeholder="john@example.com" type="email" {...field} />
                        </FormControl>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="dateOfBirth"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Date of Birth</FormLabel>
                      <div className="relative flex items-center">
                        <CalendarIcon className="absolute left-3 h-4 w-4 text-muted-foreground pointer-events-none" />
                        <FormControl>
                          <Input
                            type="date"
                            className="pl-10 text-foreground cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer bg-background transition-colors hover:bg-muted/50 focus-visible:ring-1 focus-visible:ring-primary"
                            {...field}
                          />
                        </FormControl>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="gender"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Gender</FormLabel>
                      <div className="relative flex items-center">
                        <Users className="absolute left-3 h-4 w-4 text-muted-foreground pointer-events-none z-10" />
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger className="pl-10">
                              <SelectValue placeholder="Select gender" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value={Gender.MALE}>Male</SelectItem>
                            <SelectItem value={Gender.FEMALE}>Female</SelectItem>
                            <SelectItem value={Gender.OTHER}>Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="bloodGroup"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Blood Group</FormLabel>
                      <div className="relative flex items-center">
                        <Droplets className="absolute left-3 h-4 w-4 text-muted-foreground pointer-events-none z-10" />
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger className="pl-10">
                              <SelectValue placeholder="Select blood group" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value={BloodGroup.A_POSITIVE}>A+</SelectItem>
                            <SelectItem value={BloodGroup.A_NEGATIVE}>A-</SelectItem>
                            <SelectItem value={BloodGroup.B_POSITIVE}>B+</SelectItem>
                            <SelectItem value={BloodGroup.B_NEGATIVE}>B-</SelectItem>
                            <SelectItem value={BloodGroup.AB_POSITIVE}>AB+</SelectItem>
                            <SelectItem value={BloodGroup.AB_NEGATIVE}>AB-</SelectItem>
                            <SelectItem value={BloodGroup.O_POSITIVE}>O+</SelectItem>
                            <SelectItem value={BloodGroup.O_NEGATIVE}>O-</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex justify-end gap-4 pt-4 border-t border-border/50">
                <Button variant="outline" type="button" asChild>
                  <Link href="/dental/patients">Cancel</Link>
                </Button>
                <Button type="submit" disabled={isPending} className="shadow-lg shadow-blue-500/20">
                  {isPending ? 'Registering...' : 'Register Patient'}
                </Button>
              </div>

            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
