'use client'

import * as React from 'react'

import { cn } from '@/lib/utils'

export interface SegmentedNavItem<T extends string> {
  value: T
  label: string
  icon?: React.ElementType
}

/**
 * A premium segmented control for section-level navigation - the Organization
 * workspace's replacement for a flat `<Tabs>` strip. Unlike `TabsList` (an
 * underline indicator on a plain row), the active segment is a raised pill
 * inside a tinted track, which reads as "you are here" without relying on
 * colour alone.
 */
export function SegmentedNav<T extends string>({
  items,
  value,
  onChange,
  size = 'default',
  className,
}: {
  items: readonly SegmentedNavItem<T>[]
  value: T
  onChange: (value: T) => void
  size?: 'default' | 'sm'
  className?: string
}) {
  return (
    <nav
      aria-label="Section"
      className={cn(
        'inline-flex w-full items-center gap-1 overflow-x-auto rounded-lg bg-surface-secondary p-1 no-scrollbar',
        className,
      )}
    >
      {items.map((item) => {
        const isActive = item.value === value
        const Icon = item.icon
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(item.value)}
            className={cn(
              'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md font-medium transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              size === 'sm' ? 'h-7 px-2.5 text-xs' : 'h-8 px-3 text-sm',
              isActive
                ? 'bg-surface text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {Icon && <Icon className={size === 'sm' ? 'size-3.5' : 'size-4'} aria-hidden="true" />}
            {item.label}
          </button>
        )
      })}
    </nav>
  )
}
