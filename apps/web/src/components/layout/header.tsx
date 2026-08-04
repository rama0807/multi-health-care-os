'use client'

import { Bell, LogOut, Settings, User } from 'lucide-react'
import { useRouter } from 'next/navigation'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAuth } from '@/lib/auth/auth-context'

import { CommandPalette } from './command-palette'

function initials(firstName: string, lastName: string): string {
  return `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase()
}

export function Header() {
  const { user, logout } = useAuth()
  const router = useRouter()

  async function handleLogout() {
    await logout()
    router.push('/login')
  }

  return (
    <header className="flex h-14 items-center justify-between border-b bg-card px-6">
      {/* Search */}
      <CommandPalette />

      {/* Right side */}
      <div className="flex items-center gap-2">
        <button className="relative rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">
          <Bell className="h-4 w-4" />
          <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-destructive" />
        </button>

        {user && (
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-2 rounded-md p-1.5 outline-none transition-colors hover:bg-accent">
              <Avatar className="h-7 w-7">
                <AvatarFallback className="text-xs">
                  {initials(user.firstName, user.lastName)}
                </AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col space-y-0.5">
                  <p className="text-sm font-medium">
                    {user.firstName} {user.lastName}
                  </p>
                  <p className="text-xs font-normal text-muted-foreground">{user.email}</p>
                  {user.roles.length > 0 && (
                    <p className="text-xs font-normal text-muted-foreground">
                      {user.roles.join(', ')}
                    </p>
                  )}
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push('/dashboard/settings')}>
                <User className="mr-2 h-4 w-4" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push('/dashboard/settings')}>
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => void handleLogout()}>
                <LogOut className="mr-2 h-4 w-4" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  )
}
