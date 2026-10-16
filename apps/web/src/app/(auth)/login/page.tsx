import type { Metadata } from 'next'
import { Suspense } from 'react'

import { LoginForm } from '@/components/forms/login-form'
import { Skeleton } from '@/components/ui/skeleton'

export const metadata: Metadata = {
  title: 'Sign In | Grovyn Healthcare OS',
  description: 'Sign in to access Grovyn Hospital OS or Grovyn Dental OS.',
}

function LoginLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-36" />
        <Skeleton className="h-4 w-56" />
      </div>
      <Skeleton className="h-10 w-full rounded-md" />
      <Skeleton className="h-10 w-full rounded-md" />
      <Skeleton className="h-10 w-full rounded-md" />
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginLoading />}>
      <LoginForm />
    </Suspense>
  )
}
