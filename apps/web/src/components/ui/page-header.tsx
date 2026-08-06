import * as React from "react"

import { Breadcrumb, type BreadcrumbItem } from "@/components/ui/breadcrumb"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

/**
 * The header every page in MediCore wears.
 *
 * The shape is fixed - breadcrumb, title, optional status/metadata, actions on
 * the right - so that moving between Billing, Radiology and IPD feels like
 * moving inside one product rather than between three that were built in
 * different months. Pages supply content; they do not re-decide the layout.
 */

export interface PageHeaderProps extends Omit<React.HTMLAttributes<HTMLElement>, "title"> {
  title: React.ReactNode
  description?: React.ReactNode
  breadcrumbs?: BreadcrumbItem[]
  /** Sits inline after the title - a status badge, a record number, an avatar. */
  badge?: React.ReactNode
  /** Metadata row under the title: UHID, admitted date, ordering doctor. */
  meta?: React.ReactNode
  /** Buttons, right-aligned. Primary action last, the way a dialog reads. */
  actions?: React.ReactNode
  /** Tabs or a filter bar bonded to the bottom edge of the header. */
  children?: React.ReactNode
  loading?: boolean
}

export function PageHeader({
  title,
  description,
  breadcrumbs,
  badge,
  meta,
  actions,
  children,
  loading = false,
  className,
  ...props
}: PageHeaderProps) {
  return (
    <header className={cn("space-y-3", className)} {...props}>
      {breadcrumbs && breadcrumbs.length > 0 && <Breadcrumb items={breadcrumbs} />}

      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            {loading ? (
              <Skeleton className="h-6 w-56" />
            ) : (
              <h1 className="truncate text-xl font-semibold tracking-tight text-foreground">
                {title}
              </h1>
            )}
            {!loading && badge}
          </div>

          {description && !loading && (
            <p className="max-w-2xl text-pretty text-sm text-muted-foreground">{description}</p>
          )}

          {meta && !loading && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-0.5 text-xs text-muted-foreground">
              {meta}
            </div>
          )}
        </div>

        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>

      {children}
    </header>
  )
}

/**
 * A single `label · value` pair for the header's `meta` row. Renders nothing
 * at all when the value is missing, rather than an orphaned label.
 */
export function PageHeaderMeta({
  label,
  children,
  icon: Icon,
}: {
  label?: string
  children?: React.ReactNode
  icon?: React.ElementType
}) {
  if (children === null || children === undefined || children === "") return null

  return (
    <span className="inline-flex items-center gap-1.5">
      {Icon && <Icon className="size-3.5 text-subtle-foreground" aria-hidden="true" />}
      {label && <span className="text-subtle-foreground">{label}</span>}
      <span className="font-medium text-foreground">{children}</span>
    </span>
  )
}

/**
 * A heading inside a page - the divider between "Vitals" and "Diagnoses" on an
 * encounter, for instance. Deliberately much quieter than `PageHeader`: one
 * page, one `<h1>`.
 */
export function SectionHeader({
  title,
  description,
  actions,
  className,
  ...props
}: Omit<React.HTMLAttributes<HTMLDivElement>, "title"> & {
  title: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
}) {
  return (
    <div
      className={cn("flex items-start justify-between gap-4 pb-1", className)}
      {...props}
    >
      <div className="min-w-0 space-y-0.5">
        <h2 className="text-sm font-semibold tracking-tight text-foreground">{title}</h2>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  )
}
