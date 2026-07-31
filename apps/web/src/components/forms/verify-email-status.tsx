'use client'

import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { apiClient } from '@/lib/api/client'

type Status = 'verifying' | 'success' | 'error'

function getErrorMessage(error: unknown): string {
  const axiosError = error as { response?: { data?: { error?: { message?: string } } } }
  return axiosError?.response?.data?.error?.message ?? 'This verification link is invalid or expired.'
}

export function VerifyEmailStatus() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const [status, setStatus] = useState<Status>('verifying')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setMessage('This verification link is missing its token.')
      return
    }

    let cancelled = false
    apiClient
      .post('/auth/verify-email', { token })
      .then(() => {
        if (!cancelled) setStatus('success')
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setStatus('error')
          setMessage(getErrorMessage(error))
        }
      })

    return () => {
      cancelled = true
    }
  }, [token])

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Verify email</h1>
      </div>

      {status === 'verifying' && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Verifying your email address...
        </div>
      )}

      {status === 'success' && (
        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>Your email has been verified.</AlertDescription>
        </Alert>
      )}

      {status === 'error' && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}

      <Link href="/login" className="block text-sm font-medium text-primary hover:underline">
        Back to sign in
      </Link>
    </div>
  )
}
