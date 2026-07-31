'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { ForgotPasswordSchema, type ForgotPasswordDto } from '@medicore/types'
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { useForm } from 'react-hook-form'


import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { apiClient } from '@/lib/api/client'

function getErrorMessage(error: unknown): string {
  const axiosError = error as { response?: { data?: { error?: { message?: string } } } }
  return axiosError?.response?.data?.error?.message ?? 'Something went wrong. Please try again.'
}

export function ForgotPasswordForm() {
  const [serverError, setServerError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  const form = useForm<ForgotPasswordDto>({
    resolver: zodResolver(ForgotPasswordSchema),
    defaultValues: { email: '' },
  })

  async function onSubmit(values: ForgotPasswordDto) {
    setServerError(null)
    try {
      await apiClient.post('/auth/forgot-password', values)
      setSubmitted(true)
    } catch (error) {
      setServerError(getErrorMessage(error))
    }
  }

  if (submitted) {
    return (
      <div className="space-y-4">
        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>
            If that email exists, a password reset link has been sent. Check your inbox.
          </AlertDescription>
        </Alert>
        <Link href="/login" className="text-sm font-medium text-primary hover:underline">
          Back to sign in
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Forgot password</h1>
        <p className="text-sm text-muted-foreground">
          Enter your email and we&apos;ll send you a reset link
        </p>
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
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="you@hospital.com" autoComplete="email" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Send reset link
          </Button>

          <Link
            href="/login"
            className="block text-center text-sm font-medium text-primary hover:underline"
          >
            Back to sign in
          </Link>
        </form>
      </Form>
    </div>
  )
}
