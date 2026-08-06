'use client'

import { quickActions } from '@/components/layout/nav-config'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SectionHeader } from '@/components/ui/page-header'
import { Kbd } from '@/components/ui/progress'
import { useAuth } from '@/lib/auth/auth-context'

/**
 * The only real keyboard shortcut in this app is ⌘K / Ctrl+K, opening the
 * command palette (`components/layout/command-palette.tsx`). Everything it
 * can do - jump to a page, search patients, or run a quick-create action -
 * happens by typing inside the palette, not through a dedicated chord. There
 * is no "G then P"-style navigation binding; this section says so rather
 * than listing chords that don't exist.
 */
export function ShortcutsSection() {
  const { hasPermission } = useAuth()
  const availableActions = quickActions.filter((action) => !action.permission || hasPermission(action.permission))

  return (
    <div className="space-y-4">
      <SectionHeader title="Keyboard Shortcuts" description="What's actually wired up today." />

      <Card>
        <CardHeader>
          <CardTitle>Command palette</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <p className="text-sm font-medium text-foreground">Open command palette</p>
              <p className="text-xs text-muted-foreground">Search patients, jump to any page, or start something new.</p>
            </div>
            <Kbd>⌘K</Kbd>
          </div>

          {availableActions.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium uppercase tracking-wide text-subtle-foreground">
                Reachable from the palette
              </p>
              {availableActions.map((action) => (
                <div key={action.href} className="flex items-center justify-between rounded-md border p-2.5">
                  <span className="flex items-center gap-2 text-sm text-foreground">
                    <action.icon className="size-4 text-muted-foreground" aria-hidden="true" />
                    {action.label}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Kbd>⌘K</Kbd> then type &ldquo;{action.label.toLowerCase()}&rdquo;
                  </span>
                </div>
              ))}
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Dedicated navigation chords (e.g. pressing <Kbd className="mx-0.5">G</Kbd> then{' '}
            <Kbd className="mx-0.5">P</Kbd>) aren&apos;t implemented yet - ⌘K reaches the same pages instantly.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
