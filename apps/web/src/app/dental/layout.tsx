'use client'

import { OrganizationType } from '@medicore/types'
import { Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

import { dentalNavigation } from '@/components/layout/dental-nav-config'
import { Header } from '@/components/layout/header'
import { Sidebar } from '@/components/layout/sidebar'
import { useAuth } from '@/lib/auth/auth-context'

/**
 * Application shell for the Grovyn Dental OS experience.
 *
 * Mirrors the structure of `dashboard/layout.tsx` (sidebar + header + scrollable
 * main) but feeds the dental navigation config into the Sidebar and redirects
 * non-dental users back to the hospital dashboard.
 *
 * The layout does NOT duplicate any sidebar/header rendering logic — it reuses
 * the same `<Sidebar>` and `<Header>` components. The only difference is the
 * `sections` prop passed to Sidebar.
 */
export default function DentalLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, user } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login')
    }
  }, [isLoading, isAuthenticated, router])

  // Redirect non-dental users to the hospital dashboard
  useEffect(() => {
    if (
      !isLoading &&
      isAuthenticated &&
      user &&
      user.organizationType !== OrganizationType.DENTAL
    ) {
      router.replace('/dashboard')
    }
  }, [isLoading, isAuthenticated, user, router])

  if (isLoading || !isAuthenticated || user?.organizationType !== OrganizationType.DENTAL) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar sections={dentalNavigation} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header basePath="/dental" />
        <main id="main-content" className="flex-1 overflow-y-auto px-5 py-5">
          {children}
        </main>
      </div>
    </div>
  )
}
