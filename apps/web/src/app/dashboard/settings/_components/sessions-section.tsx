'use client'

import { useQuery } from '@tanstack/react-query'
import { Laptop, Loader2, LogOut, MapPin, Monitor, Smartphone } from 'lucide-react'
import { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { SectionHeader } from '@/components/ui/page-header'
import { Skeleton } from '@/components/ui/skeleton'
import { getSessions } from '@/lib/api/account'
import { useAuth } from '@/lib/auth/auth-context'

import { parseUserAgent } from './format'

function DeviceIcon({ os }: { os: string }) {
  if (os === 'iOS' || os === 'Android') return <Smartphone className="size-4" aria-hidden="true" />
  if (os === 'macOS' || os === 'Windows' || os === 'Linux') return <Laptop className="size-4" aria-hidden="true" />
  return <Monitor className="size-4" aria-hidden="true" />
}

/**
 * `GET /auth/sessions` and `POST /auth/logout-all` are both real - see
 * `lib/api/account.ts` and `lib/auth/auth-context.tsx`. What's genuinely
 * missing is a route to revoke one specific *other* session
 * (`SessionsService.revokeAllSessionsExcept` exists, but is only ever called
 * as a side effect of changing your password - no controller exposes it
 * directly), so per-row revoke is disclosed rather than faked.
 */
export function SessionsSection() {
  const { logoutAll } = useAuth()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  const { data, isLoading } = useQuery({ queryKey: ['account', 'sessions'], queryFn: getSessions })

  async function handleSignOutEverywhere() {
    setSigningOut(true)
    try {
      await logoutAll()
    } finally {
      setSigningOut(false)
      setConfirmOpen(false)
    }
  }

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Sessions"
        description="Every device currently signed in to your account."
        actions={
          <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
                <LogOut className="size-3.5" aria-hidden="true" />
                Sign out everywhere
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>Sign out of every device?</DialogTitle>
                <DialogDescription>
                  This ends every session, including this one - you&apos;ll need to log in again right away.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setConfirmOpen(false)}>
                  Cancel
                </Button>
                <Button variant="destructive" disabled={signingOut} onClick={() => void handleSignOutEverywhere()}>
                  {signingOut && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
                  Sign out everywhere
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Active sessions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading ? (
            <>
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </>
          ) : !data || data.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active sessions.</p>
          ) : (
            data.map((session) => {
              const { browser, os } = parseUserAgent(session.userAgent)
              return (
                <div
                  key={session.sessionId}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex size-8 items-center justify-center rounded-md bg-surface-secondary text-muted-foreground">
                      <DeviceIcon os={os} />
                    </span>
                    <div>
                      <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                        {browser} on {os}
                        {session.isCurrent && (
                          <Badge variant="success" size="sm">
                            This device
                          </Badge>
                        )}
                      </p>
                      <p className="flex items-center gap-1 text-xs text-muted-foreground">
                        {session.ipAddress}
                        <span aria-hidden="true">·</span>
                        <MapPin className="size-3" aria-hidden="true" />
                        Location not available
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Signed in {new Date(session.createdAt).toLocaleString()}
                  </p>
                </div>
              )
            })
          )}
          <p className="pt-1 text-xs text-muted-foreground">
            Revoking a single device isn&apos;t available yet - use &ldquo;Sign out everywhere&rdquo; to end every
            session at once.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
