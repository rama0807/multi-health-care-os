'use client'

import { OrganizationType } from '@medicore/types'
import { Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

import { Header } from '@/components/layout/header'
import { Sidebar } from '@/components/layout/sidebar'
import { useAuth } from '@/lib/auth/auth-context'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, user } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login')
    }
  }, [isLoading, isAuthenticated, router])

  // Dental OS users landing here (e.g. from the root "/" redirect or a stale
  // bookmark) are sent to the dental shell. This is a UX convenience, not a
  // security boundary — the backend DentalGuard enforces endpoint access.
  useEffect(() => {
    if (
      !isLoading &&
      isAuthenticated &&
      user &&
      user.organizationType === OrganizationType.DENTAL
    ) {
      router.replace('/dental')
    }
  }, [isLoading, isAuthenticated, user, router])

  if (isLoading || !isAuthenticated || user?.organizationType === OrganizationType.DENTAL) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header basePath="/dashboard" />
        {/*
         * The main region is the only scroll container in the shell - the
         * sidebar and header stay put, which is what lets tables inside a page
         * use sticky headers of their own without two scrollbars fighting.
         */}
        <main id="main-content" className="flex-1 overflow-y-auto px-5 py-5">
          {children}
        </main>
      </div>
    </div>
  )
}
