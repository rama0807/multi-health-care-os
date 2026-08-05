import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Timeline and activity feed.
 *
 * MediCore renders chronology on at least six surfaces — the patient
 * cross-module timeline, the doctor audit trail, claim lifecycle, bed
 * allocation history, notification centre, MAR dose history. They were each
 * drawn differently. This is the one shape.
 *
 * Two deliberate choices:
 *
 * - The connector line is drawn by the *item*, not the container, and the last
 *   item omits it. A container-drawn rail always overshoots the final node.
 * - Timestamps take a `<time dateTime>` element with an absolute value in the
 *   `title`, so a relative label ("2h ago") stays hoverable and machine
 *   readable. In a clinical record, "when exactly" is not optional.
 */

export type TimelineTone = "default" | "success" | "warning" | "danger" | "info" | "muted"

const NODE_TONE: Record<TimelineTone, string> = {
  default: "border-primary-border bg-primary-subtle text-primary-subtle-foreground",
  success: "border-success-border bg-success-subtle text-success-subtle-foreground",
  warning: "border-warning-border bg-warning-subtle text-warning-subtle-foreground",
  danger: "border-danger-border bg-danger-subtle text-danger-subtle-foreground",
  info: "border-info-border bg-info-subtle text-info-subtle-foreground",
  muted: "border-border bg-surface-secondary text-subtle-foreground",
}

export function Timeline({ className, ...props }: React.HTMLAttributes<HTMLOListElement>) {
  return <ol className={cn("relative space-y-0", className)} {...props} />
}

// `title` is deliberately widened from the DOM attribute (a string tooltip) to
// a ReactNode, so a timeline entry can carry a badge or a link in its heading.
export interface TimelineItemProps extends Omit<React.HTMLAttributes<HTMLLIElement>, 'title'> {
  title: React.ReactNode
  description?: React.ReactNode
  /** Who did it. */
  actor?: React.ReactNode
  /** ISO string — rendered as a real `<time>` element. */
  timestamp?: string
  /** Human label for the timestamp; falls back to the raw ISO value. */
  timestampLabel?: React.ReactNode
  icon?: React.ElementType
  tone?: TimelineTone
  /** Omits the connector below this node. Set on the final item. */
  last?: boolean
}

export function TimelineItem({
  title,
  description,
  actor,
  timestamp,
  timestampLabel,
  icon: Icon,
  tone = "default",
  last = false,
  className,
  children,
  ...props
}: TimelineItemProps) {
  return (
    <li className={cn("relative flex gap-3 pb-4 last:pb-0", className)} {...props}>
      <div className="flex flex-col items-center">
        <span
          className={cn(
            "flex size-6 shrink-0 items-center justify-center rounded-full border",
            NODE_TONE[tone]
          )}
          aria-hidden="true"
        >
          {Icon ? <Icon className="size-3" /> : <span className="size-1.5 rounded-full bg-current" />}
        </span>
        {!last && <span aria-hidden="true" className="mt-1 w-px flex-1 bg-border" />}
      </div>

      <div className="-mt-0.5 min-w-0 flex-1 pb-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
          <p className="text-sm font-medium text-foreground">{title}</p>
          {timestamp && (
            <time
              dateTime={timestamp}
              title={timestamp}
              className="shrink-0 text-xs tabular-nums text-muted-foreground"
            >
              {timestampLabel ?? timestamp}
            </time>
          )}
        </div>

        {description && (
          <p className="mt-0.5 text-pretty text-sm text-muted-foreground">{description}</p>
        )}
        {actor && <p className="mt-0.5 text-xs text-subtle-foreground">{actor}</p>}
        {children && <div className="mt-2">{children}</div>}
      </div>
    </li>
  )
}

/**
 * A compact activity list — same chronology, no rail. For sidebars and card
 * bodies where the vertical connector would be more ink than information.
 */
export function ActivityFeed({ className, ...props }: React.HTMLAttributes<HTMLUListElement>) {
  return <ul className={cn("divide-y divide-border", className)} {...props} />
}

export function ActivityFeedItem({
  title,
  description,
  timestamp,
  timestampLabel,
  icon: Icon,
  tone = "muted",
  className,
  ...props
}: Omit<TimelineItemProps, "last">) {
  return (
    <li className={cn("flex items-start gap-2.5 py-2.5 first:pt-0 last:pb-0", className)} {...props}>
      <span
        className={cn(
          "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md border",
          NODE_TONE[tone]
        )}
        aria-hidden="true"
      >
        {Icon ? <Icon className="size-3" /> : <span className="size-1.5 rounded-full bg-current" />}
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-foreground">{title}</p>
        {description && (
          <p className="truncate text-xs text-muted-foreground">{description}</p>
        )}
      </div>

      {timestamp && (
        <time
          dateTime={timestamp}
          title={timestamp}
          className="shrink-0 text-xs tabular-nums text-subtle-foreground"
        >
          {timestampLabel ?? timestamp}
        </time>
      )}
    </li>
  )
}
