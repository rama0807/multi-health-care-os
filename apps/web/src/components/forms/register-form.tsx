'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { OrganizationType, RegisterOrganizationDto, RegisterOrganizationSchema } from '@medicore/types'
import { AlertCircle, Building, Building2, Check, CheckCircle2, Loader2, Lock, Mail, Phone, Shield, Sparkles, User } from 'lucide-react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { apiClient, setAccessToken } from '@/lib/api/client'
import { cn } from '@/lib/utils'

function getErrorMessage(error: unknown): string {
  const axiosError = error as { response?: { data?: { error?: { message?: string } } } }
  return axiosError?.response?.data?.error?.message ?? 'Something went wrong. Please try again.'
}

export function RegisterForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [serverError, setServerError] = useState<string | null>(null)
  const [isSuccess, setIsSuccess] = useState(false)
  const [createdInfo, setCreatedInfo] = useState<{
    name: string
    type: OrganizationType
    email: string
  } | null>(null)
  const [countdown, setCountdown] = useState(3)

  const queryType = searchParams.get('type') || searchParams.get('product') || ''
  const isDentalPreselected = queryType.toUpperCase() === 'DENTAL'

  const form = useForm<RegisterOrganizationDto>({
    resolver: zodResolver(RegisterOrganizationSchema),
    defaultValues: {
      organizationName: '',
      organizationSlug: '',
      adminFirstName: '',
      adminLastName: '',
      adminEmail: '',
      adminPassword: '',
      phone: '',
      organizationType: isDentalPreselected ? OrganizationType.DENTAL : OrganizationType.HOSPITAL,
    },
  })

  // Keep form in sync if search param changes dynamically
  useEffect(() => {
    if (queryType.toUpperCase() === 'DENTAL') {
      form.setValue('organizationType', OrganizationType.DENTAL)
    } else if (queryType.toUpperCase() === 'HOSPITAL') {
      form.setValue('organizationType', OrganizationType.HOSPITAL)
    }
  }, [queryType, form])

  // Handle countdown redirect to login upon successful creation
  useEffect(() => {
    if (!isSuccess) return

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          router.push('/login?registered=true')
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [isSuccess, router])

  const selectedType = form.watch('organizationType')

  async function onSubmit(values: RegisterOrganizationDto) {
    setServerError(null)
    try {
      await apiClient.post('/auth/register?autoLogin=false', values)
      setAccessToken(null)
      setCreatedInfo({
        name: values.organizationName,
        type: values.organizationType,
        email: values.adminEmail,
      })
      setIsSuccess(true)
    } catch (error) {
      setServerError(getErrorMessage(error))
    }
  }

  const isSubmitting = form.formState.isSubmitting

  if (isSuccess && createdInfo) {
    const isDental = createdInfo.type === OrganizationType.DENTAL
    return (
      <div className="space-y-6 text-center py-4 animate-in fade-in-50 zoom-in-95 duration-300">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="h-8 w-8" />
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            Account Created Successfully!
          </h2>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Your organization account has been created on{' '}
            <span className="font-semibold text-foreground">
              {isDental ? 'Grovyn Dental OS' : 'Grovyn Hospital OS'}
            </span>
            .
          </p>
        </div>

        {/* Summary Details Card */}
        <div className="rounded-xl border border-border bg-muted/30 p-4 text-left text-sm space-y-2.5">
          <div className="flex justify-between items-center py-1 border-b border-border/50 text-xs">
            <span className="text-muted-foreground">Healthcare System</span>
            <span className="font-medium text-foreground flex items-center gap-1.5">
              {isDental ? (
                <>
                  <Sparkles className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                  Dental OS
                </>
              ) : (
                <>
                  <Building2 className="h-3.5 w-3.5 text-primary" />
                  Hospital OS
                </>
              )}
            </span>
          </div>
          <div className="flex justify-between items-center py-1 border-b border-border/50 text-xs">
            <span className="text-muted-foreground">Organization</span>
            <span className="font-medium text-foreground">{createdInfo.name}</span>
          </div>
          <div className="flex justify-between items-center py-1 text-xs">
            <span className="text-muted-foreground">Administrator</span>
            <span className="font-medium text-foreground">{createdInfo.email}</span>
          </div>
        </div>

        {/* Redirect Notice Banner */}
        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground bg-primary/5 dark:bg-primary/10 border border-primary/10 rounded-lg p-3">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
          <span>
            Redirecting to sign-in page in{' '}
            <span className="font-semibold text-foreground">{countdown}</span>s...
          </span>
        </div>

        {/* Direct Navigation Button */}
        <Button
          type="button"
          onClick={() => router.push('/login?registered=true')}
          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
        >
          Sign In Now
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Create an Organization</h1>
        <p className="text-sm text-muted-foreground">
          {selectedType === OrganizationType.DENTAL
            ? 'Set up your practice on Grovyn Dental OS'
            : 'Set up your facility on Grovyn Hospital OS'}
        </p>
      </div>

      {/* Visual OS Mode Selector Toggle */}
      <div className="space-y-2">
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Choose Healthcare Operating System
        </label>
        <div className="grid grid-cols-2 gap-2.5 p-1 rounded-xl bg-muted/50 border border-border">
          <button
            type="button"
            onClick={() => form.setValue('organizationType', OrganizationType.HOSPITAL)}
            className={cn(
              'flex flex-col items-start gap-1 p-3 rounded-lg text-left transition-all border text-xs',
              selectedType === OrganizationType.HOSPITAL
                ? 'bg-card border-primary/40 shadow-sm text-foreground ring-1 ring-primary/20'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-card/40',
            )}
          >
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-1.5 font-semibold text-foreground">
                <Building2 className="h-3.5 w-3.5 text-primary" />
                <span>Hospital OS</span>
              </div>
              {selectedType === OrganizationType.HOSPITAL && (
                <Check className="h-3.5 w-3.5 text-primary" />
              )}
            </div>
            <span className="text-2xs text-muted-foreground leading-snug">
              Multi-dept, OPD, IPD, & Wards
            </span>
          </button>

          <button
            type="button"
            onClick={() => form.setValue('organizationType', OrganizationType.DENTAL)}
            className={cn(
              'flex flex-col items-start gap-1 p-3 rounded-lg text-left transition-all border text-xs',
              selectedType === OrganizationType.DENTAL
                ? 'bg-card border-teal-500/40 shadow-sm text-foreground ring-1 ring-teal-500/20'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-card/40',
            )}
          >
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-1.5 font-semibold text-foreground">
                <Sparkles className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                <span>Dental OS</span>
              </div>
              {selectedType === OrganizationType.DENTAL && (
                <Check className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
              )}
            </div>
            <span className="text-2xs text-muted-foreground leading-snug">
              Odontogram, Chairs, & Lab cases
            </span>
          </button>
        </div>
      </div>


      {serverError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      )}

      <Form {...form}>
        <form onSubmit={(e) => void form.handleSubmit(onSubmit)(e)} className="space-y-4">
          
          <div className="space-y-4 rounded-lg border p-4 bg-muted/20">
            <h3 className="font-medium flex items-center gap-2">
              <Building className="h-4 w-4 text-muted-foreground" />
              Organization Details
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="organizationName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Organization Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Apex Hospital" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="organizationSlug"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Organization Slug</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. apex-hospital" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          <div className="space-y-4 rounded-lg border p-4 bg-muted/20">
            <h3 className="font-medium flex items-center gap-2">
              <Shield className="h-4 w-4 text-muted-foreground" />
              Administrator Details
            </h3>
            
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="adminFirstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First Name</FormLabel>
                    <div className="relative">
                      <User className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <FormControl>
                        <Input placeholder="John" className="pl-9" {...field} />
                      </FormControl>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="adminLastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Doe" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="adminEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Address</FormLabel>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <FormControl>
                        <Input placeholder="admin@example.com" type="email" className="pl-9" {...field} />
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
                  <FormItem>
                    <FormLabel>Phone Number</FormLabel>
                    <div className="relative">
                      <Phone className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <FormControl>
                        <Input placeholder="e.g. 9876543210" className="pl-9" {...field} />
                      </FormControl>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="adminPassword"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Password</FormLabel>
                    <div className="relative">
                      <Lock className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <FormControl>
                        <Input placeholder="********" type="password" className="pl-9" {...field} />
                      </FormControl>
                    </div>
                    <FormDescription>Must contain uppercase, lowercase, and a number.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            Create Organization
          </Button>
        </form>
      </Form>

      <div className="text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link href="/login" className="font-semibold text-primary hover:underline">
          Sign in
        </Link>
      </div>
    </div>
  )
}
