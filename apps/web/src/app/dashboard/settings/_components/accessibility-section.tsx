import { Contrast, Eye, Keyboard, PersonStanding, Sparkles } from 'lucide-react'

import { SectionHeader } from '@/components/ui/page-header'

import { NotAvailableCard } from './not-available-card'

const OPTIONS = [
  {
    icon: Contrast,
    title: 'High contrast',
    description: 'A higher-contrast palette beyond the theme’s own light/dark tokens isn’t built yet.',
  },
  {
    icon: Sparkles,
    title: 'Reduce animation',
    description:
      'A screen-wide toggle that skips every transition and animation isn’t built yet. Appearance has a local preview-only version of this.',
  },
  {
    icon: Eye,
    title: 'Focus outlines',
    description: 'Focus rings already follow the design system’s ring token on every control - there is no separate setting to strengthen or hide them.',
  },
  {
    icon: Keyboard,
    title: 'Keyboard navigation',
    description: 'Tables, menus, dialogs and the command palette are all keyboard-operable today - there is no dedicated settings toggle because there is nothing to turn on.',
  },
  {
    icon: PersonStanding,
    title: 'Screen reader support',
    description: 'Pages use semantic headings and ARIA labelling where it matters (see this workspace’s own nav and dialogs), but there is no dedicated screen-reader mode to enable.',
  },
] as const

/**
 * Per this task's explicit instruction: persist accessibility settings only
 * if existing support exists, otherwise show them disabled. None of these
 * five has a settings-level implementation today, so every card here
 * discloses the real, current state of that concern rather than offering a
 * toggle that would do nothing.
 */
export function AccessibilitySection() {
  return (
    <div className="space-y-4">
      <SectionHeader
        title="Accessibility"
        description="What MediCore does today for each of these, and what isn't a real setting yet."
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {OPTIONS.map((option) => (
          <NotAvailableCard key={option.title} icon={option.icon} title={option.title} description={option.description} />
        ))}
      </div>
    </div>
  )
}
