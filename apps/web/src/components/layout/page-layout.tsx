import * as React from 'react'

import { PageHeader, type PageHeaderProps } from '@/components/ui/page-header'
import { cn } from '@/lib/utils'

/**
 * The one page skeleton every screen in MediCore uses.
 *
 * Breadcrumb → title → actions → content, with an optional right-hand utility
 * column. Pages that adopt this get identical margins, identical header
 * geometry and identical scroll behaviour for free, which is most of what makes
 * a large application feel like one product instead of forty.
 *
 * The utility column stacks *below* the content under `xl`, rather than
 * shrinking: a 280px sidebar of patient vitals squeezed to 140px is unreadable,
 * and on a laptop the main content deserves the width.
 */
export interface PageLayoutProps extends PageHeaderProps {
  /** Right-hand utility column — related records, activity, help. */
  aside?: React.ReactNode
  /** Tabs or a filter bar bonded to the header. */
  toolbar?: React.ReactNode
  /** Caps the content width for readability. `full` for dense tables. */
  width?: 'default' | 'narrow' | 'full'
  contentClassName?: string
}

const WIDTH: Record<NonNullable<PageLayoutProps['width']>, string> = {
  narrow: 'max-w-3xl',
  default: 'max-w-[1600px]',
  full: 'max-w-none',
}

export function PageLayout({
  aside,
  toolbar,
  width = 'default',
  className,
  contentClassName,
  children,
  ...headerProps
}: PageLayoutProps) {
  return (
    <div className={cn('mx-auto w-full space-y-4', WIDTH[width], className)}>
      <PageHeader {...headerProps}>{toolbar}</PageHeader>

      {aside ? (
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start">
          <div className={cn('min-w-0 flex-1 space-y-4', contentClassName)}>{children}</div>
          <aside className="w-full shrink-0 space-y-4 xl:w-80">{aside}</aside>
        </div>
      ) : (
        <div className={cn('space-y-4', contentClassName)}>{children}</div>
      )}
    </div>
  )
}

/**
 * Vertical rhythm for a stack of sections inside a page. Exists so pages stop
 * inventing their own `space-y-6` / `space-y-8` / `mt-10`.
 */
export function PageSection({
  className,
  ...props
}: React.HTMLAttributes<HTMLElement>) {
  return <section className={cn('space-y-3', className)} {...props} />
}
