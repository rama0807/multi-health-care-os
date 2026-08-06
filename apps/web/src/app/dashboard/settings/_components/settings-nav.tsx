'use client'

import {
  Accessibility,
  Bell,
  Info,
  Keyboard,
  Laptop2,
  Palette,
  ShieldCheck,
  Terminal,
  Timer,
  UserRound,
} from 'lucide-react'

import { cn } from '@/lib/utils'

export const SETTINGS_SECTIONS = [
  { value: 'account', label: 'Account', icon: UserRound },
  { value: 'appearance', label: 'Appearance', icon: Palette },
  { value: 'notifications', label: 'Notifications', icon: Bell },
  { value: 'security', label: 'Security', icon: ShieldCheck },
  { value: 'sessions', label: 'Sessions', icon: Timer },
  { value: 'devices', label: 'Devices', icon: Laptop2 },
  { value: 'shortcuts', label: 'Keyboard Shortcuts', icon: Keyboard },
  { value: 'accessibility', label: 'Accessibility', icon: Accessibility },
  { value: 'developer', label: 'Developer', icon: Terminal },
  { value: 'about', label: 'About', icon: Info },
] as const

export type SettingsSectionKey = (typeof SETTINGS_SECTIONS)[number]['value']
export const SETTINGS_SECTION_KEYS: string[] = SETTINGS_SECTIONS.map((s) => s.value)

/**
 * The personal account workspace's left rail. Vertical rather than
 * `SegmentedNav` (the Organization workspace's horizontal pattern) because ten
 * sections in one horizontal strip would wrap or scroll sideways - see
 * `docs/design-system.md`'s page-anatomy section for why each workspace picks
 * the layout that fits its section count.
 */
export function SettingsNav({
  value,
  onChange,
}: {
  value: SettingsSectionKey
  onChange: (value: SettingsSectionKey) => void
}) {
  return (
    <nav
      aria-label="Settings sections"
      className="flex w-full shrink-0 flex-row gap-1 overflow-x-auto rounded-lg bg-surface-secondary p-1 no-scrollbar lg:sticky lg:top-4 lg:w-56 lg:flex-col lg:overflow-visible"
    >
      {SETTINGS_SECTIONS.map((section) => {
        const isActive = section.value === value
        return (
          <button
            key={section.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(section.value)}
            className={cn(
              'inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-left text-sm font-medium transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:w-full',
              isActive
                ? 'bg-surface text-foreground shadow-xs'
                : 'text-muted-foreground hover:bg-surface-hover hover:text-foreground',
            )}
          >
            <section.icon className="size-4 shrink-0" aria-hidden="true" />
            {section.label}
          </button>
        )
      })}
    </nav>
  )
}
