'use client'

import type { AuthenticatedUser } from '@medicore/types'
import { Loader2 } from 'lucide-react'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'

import { humanizeRole, initials } from './format'
import { useSettingsFooterState } from './settings-footer-context'

export interface SettingsHeaderProps {
  user?: AuthenticatedUser
  loading: boolean
}

/**
 * The identity strip every section sits under - who you are, your role in
 * this organization, how complete your basic profile is, and (when a section
 * has unsaved changes) the one Save/Discard control for the whole workspace.
 *
 * "Profile completion" only counts the three fields this app actually has for
 * a user today (name, email, avatar) - see `account-section.tsx` for why job
 * title, bio, timezone and the rest aren't counted: there is nowhere in the
 * API that stores or returns them yet.
 */
export function SettingsHeader({ user, loading }: SettingsHeaderProps) {
  const footer = useSettingsFooterState()

  if (loading || !user) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-border bg-surface p-4">
        <Skeleton className="size-14 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-3.5 w-64" />
        </div>
      </div>
    )
  }

  const basics = [Boolean(user.firstName && user.lastName), Boolean(user.email), Boolean(user.avatar)]
  const completed = basics.filter(Boolean).length

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border bg-surface p-4">
      <div className="flex min-w-0 items-center gap-3">
        <Avatar className="size-14">
          {user.avatar ? <AvatarImage src={user.avatar} alt="" /> : null}
          <AvatarFallback className="bg-primary-subtle text-base font-semibold text-primary-subtle-foreground">
            {initials(user.firstName, user.lastName)}
          </AvatarFallback>
        </Avatar>

        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-lg font-semibold tracking-tight text-foreground">
              {user.firstName} {user.lastName}
            </h1>
            {user.roles.map((role) => (
              <Badge key={role} variant="outline">
                {humanizeRole(role)}
              </Badge>
            ))}
          </div>
          <p className="truncate text-sm text-muted-foreground">{user.email}</p>
          <div className="flex flex-wrap items-center gap-3 pt-0.5 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              Profile
              <Progress value={completed} max={3} size="sm" className="w-16" label="Profile completion" />
              {completed}/3
            </span>
            <span
              className="cursor-help underline decoration-dotted"
              title="MediCore doesn't record a self-service last-active timestamp today."
            >
              Last active — not tracked yet
            </span>
          </div>
        </div>
      </div>

      {footer.isDirty && (
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-xs font-medium text-warning-subtle-foreground">Unsaved changes</span>
          <Button variant="outline" size="sm" onClick={footer.onDiscard} disabled={footer.saving}>
            Discard
          </Button>
          <Button size="sm" onClick={footer.onSave} disabled={footer.saving}>
            {footer.saving && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
            Save changes
          </Button>
        </div>
      )}
    </div>
  )
}
