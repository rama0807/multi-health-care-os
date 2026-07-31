'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { ResetPasswordSchema } from '@medicore/types'
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'


import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { apiClient } from '@/lib/api/client'

const ResetPasswordFormSchema = ResetPasswordSchema.extend({
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
})

type ResetPasswordFormValues = z.infer<typeof ResetPasswordFormSchema>

function getErrorMessage(error: unknown): string {
  const axiosError = error as { response?: { data?: { error?: { message?: string } } } }
  return axiosError?.response?.data?.error?.message ?? 'Something went wrong. Please try again.'
}

export function ResetPasswordForm() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const [serverError, setServerError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const form = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(ResetPasswordFormSchema),
    defaultValues: { token, password: '', confirmPassword: '' },
  })

  async function onSubmit(values: ResetPasswordFormValues) {
    setServerError(null)
    try {
      await apiClient.post('/auth/reset-password', { token, password: values.password })
      setSuccess(true)
    } catch (error) {
      setServerError(getErrorMessage(error))
    }
  }

  if (!token) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          This reset link is missing its token. Request a new one from the{' '}
          <Link href="/forgot-password" className="underline">
            forgot password
          </Link>{' '}
          page.
        </AlertDescription>
      </Alert>
    )
  }

  if (success) {
    return (
      <div className="space-y-4">
        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>Your password has been reset. You can now sign in.</AlertDescription>
        </Alert>
        <Link href="/login" className="text-sm font-medium text-primary hover:underline">
          Go to sign in
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Reset password</h1>
        <p className="text-sm text-muted-foreground">Choose a new password for your account</p>
      </div>

      {serverError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      )}

      <Form {...form}>
        <form onSubmit={(e) => void form.handleSubmit(onSubmit)(e)} className="space-y-4">
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>New password</FormLabel>
                <FormControl>
                  <Input type="password" autoComplete="new-password" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Confirm password</FormLabel>
                <FormControl>
                  <Input type="password" autoComplete="new-password" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Reset password
          </Button>
        </form>
      </Form>
    </div>
  )
}
