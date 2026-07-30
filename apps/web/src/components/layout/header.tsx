'use client'

import { Bell, Search } from 'lucide-react'

export function Header() {
  return (
    <header className="flex h-14 items-center justify-between border-b bg-card px-6">
      {/* Search */}
      <div className="flex items-center gap-2 rounded-md border bg-background px-3 py-1.5 text-sm text-muted-foreground w-72">
        <Search className="h-3.5 w-3.5" />
        <span>Search patients, appointments...</span>
        <kbd className="ml-auto text-xs bg-muted px-1.5 py-0.5 rounded">⌘K</kbd>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2">
        <button className="relative rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors">
          <Bell className="h-4 w-4" />
          <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-destructive" />
        </button>
      </div>
    </header>
  )
}
