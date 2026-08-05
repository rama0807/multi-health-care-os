import { ChevronRight } from "lucide-react"
import Link from "next/link"
import * as React from "react"

import { cn } from "@/lib/utils"

export interface BreadcrumbItem {
  label: string
  /** Omit on the final crumb — the current page is not a link to itself. */
  href?: string
}

/**
 * Where am I, and how do I get back one level.
 *
 * Rendered as a real `<nav aria-label="Breadcrumb">` with an ordered list and
 * `aria-current="page"` on the leaf, because this is the primary orientation
 * cue for a screen-reader user landing deep in a record.
 *
 * Long trails collapse in the middle rather than wrapping to a second line —
 * a wrapping breadcrumb pushes the page title around as data loads.
 */
export function Breadcrumb({
  items,
  maxItems = 4,
  className,
}: {
  items: BreadcrumbItem[]
  maxItems?: number
  className?: string
}) {
  if (items.length === 0) return null

  const collapsed =
    items.length > maxItems
      ? [items[0], { label: "…" } as BreadcrumbItem, ...items.slice(items.length - (maxItems - 2))]
      : items

  return (
    <nav aria-label="Breadcrumb" className={cn("min-w-0", className)}>
      <ol className="flex items-center gap-1 text-xs text-muted-foreground">
        {collapsed.map((item, index) => {
          const isLast = index === collapsed.length - 1
          return (
            <li key={`${item.label}-${index}`} className="flex min-w-0 items-center gap-1">
              {index > 0 && (
                <ChevronRight className="size-3 shrink-0 text-subtle-foreground" aria-hidden="true" />
              )}
              {item.href && !isLast ? (
                <Link
                  href={item.href}
                  className="truncate rounded-xs transition-colors hover:text-foreground"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  className={cn("truncate", isLast && "font-medium text-foreground")}
                  aria-current={isLast ? "page" : undefined}
                >
                  {item.label}
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
