import type { Metadata } from 'next'
import { Suspense } from 'react'

import { VerifyEmailStatus } from '@/components/forms/verify-email-status'

export const metadata: Metadata = {
  title: 'Verify Email',
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailStatus />
    </Suspense>
  )
}
