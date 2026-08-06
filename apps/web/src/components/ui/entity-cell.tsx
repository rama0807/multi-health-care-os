import * as React from "react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

/**
 * The identity cell - the leftmost column of nearly every table here: a
 * patient, a doctor, a vendor, a drug batch.
 *
 * Standardising it does two things a per-page implementation kept getting
 * wrong. The secondary line (UHID, phone, batch number) is rendered in a
 * *monospace* face when it is an identifier, so two UHIDs stacked in adjacent
 * rows can be compared column-by-column. And both lines truncate rather than
 * wrap, so row heights stay uniform and the table keeps its rhythm.
 */

/** `Priya Sharma` → `PS`. Falls back to a single glyph for one-word names. */
export function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export interface EntityCellProps extends React.HTMLAttributes<HTMLDivElement> {
  name: React.ReactNode
  /** UHID, phone, employee code - rendered monospace when `mono`. */
  secondary?: React.ReactNode
  /** Set for identifiers; leave off for prose like a department name. */
  mono?: boolean
  avatarUrl?: string | null
  /** Defaults to initials derived from `name` when it is a plain string. */
  fallback?: string
  showAvatar?: boolean
  /** A status dot or badge rendered after the name. */
  badge?: React.ReactNode
}

export function EntityCell({
  name,
  secondary,
  mono = false,
  avatarUrl,
  fallback,
  showAvatar = true,
  badge,
  className,
  ...props
}: EntityCellProps) {
  const initials =
    fallback ?? (typeof name === "string" ? initialsFrom(name) : "?")

  return (
    <div className={cn("flex min-w-0 items-center gap-2.5", className)} {...props}>
      {showAvatar && (
        <Avatar className="size-7 shrink-0">
          {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
          <AvatarFallback className="bg-primary-subtle text-2xs font-semibold text-primary-subtle-foreground">
            {initials}
          </AvatarFallback>
        </Avatar>
      )}

      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="truncate font-medium text-foreground">{name}</span>
          {badge}
        </div>
        {secondary !== null && secondary !== undefined && secondary !== "" && (
          <div
            className={cn(
              "truncate text-xs text-muted-foreground",
              mono && "font-mono tracking-tight"
            )}
          >
            {secondary}
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Two stacked lines with no avatar - a value over its qualifier, e.g. an
 * amount over its due date, or a test name over its reference range.
 */
export function StackedCell({
  primary,
  secondary,
  align = "left",
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  primary: React.ReactNode
  secondary?: React.ReactNode
  align?: "left" | "right"
}) {
  return (
    <div className={cn("min-w-0", align === "right" && "text-right", className)} {...props}>
      <div className="truncate text-foreground">{primary}</div>
      {secondary !== null && secondary !== undefined && secondary !== "" && (
        <div className="truncate text-xs text-muted-foreground">{secondary}</div>
      )}
    </div>
  )
}
