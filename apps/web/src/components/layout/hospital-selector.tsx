'use client'

import { Building2, Check, ChevronDown } from 'lucide-react'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useWorkspace } from '@/providers/workspace-provider'

/**
 * The working-context selector in the top bar.
 *
 * There is exactly one of these in the application - the sidebar shows the
 * resulting context but does not offer a second way to change it, so the two
 * can never disagree.
 *
 * It renders nothing when the user belongs to a single hospital: a dropdown
 * with one option is a control that teaches the user their choice does not
 * matter.
 */
export function HospitalSelector() {
  const { hospitals, activeHospital, activeHospitalId, setActiveHospitalId, canSwitch } =
    useWorkspace()

  if (!canSwitch || hospitals.length === 0) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex h-8 max-w-[13rem] items-center gap-1.5 rounded-md border border-border bg-surface px-2 text-sm text-foreground outline-none transition-colors hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-ring">
        <Building2 className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="truncate">{activeHospital?.name ?? 'All hospitals'}</span>
        <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          Working context
        </DropdownMenuLabel>

        <DropdownMenuItem onClick={() => setActiveHospitalId(null)}>
          <Building2 className="text-muted-foreground" />
          <span className="flex-1">All hospitals</span>
          {activeHospitalId === null && <Check className="size-3.5" />}
        </DropdownMenuItem>

        {hospitals.map((hospital) => (
          <DropdownMenuItem key={hospital.id} onClick={() => setActiveHospitalId(hospital.id)}>
            <Building2 className="text-muted-foreground" />
            <span className="flex-1 truncate">{hospital.name}</span>
            {activeHospitalId === hospital.id && <Check className="size-3.5" />}
          </DropdownMenuItem>
        ))}

        <DropdownMenuSeparator />
        {/* Stated rather than implied: this is a remembered preference today,
            not yet a data filter. See `WorkspaceProvider` and TD-0075. */}
        <p className="px-2 py-1.5 text-2xs leading-snug text-muted-foreground">
          Remembered on this device. Module pages are not yet filtered by this
          selection.
        </p>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
