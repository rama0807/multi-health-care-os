import type { Metadata } from 'next'
import { Suspense } from 'react'

import { RegisterForm } from '@/components/forms/register-form'
import { Skeleton } from '@/components/ui/skeleton'

export const metadata: Metadata = {
  title: 'Register Organization | Grovyn Healthcare OS',
  description: 'Create an organization account on Grovyn Hospital OS or Grovyn Dental OS.',
}

function RegisterLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>
      <Skeleton className="h-16 w-full rounded-xl" />
      <Skeleton className="h-44 w-full rounded-lg" />
      <Skeleton className="h-60 w-full rounded-lg" />
    </div>
  )
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<RegisterLoading />}>
      <RegisterForm />
    </Suspense>
  )
}

