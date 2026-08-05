import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react"
import Link from "next/link"
import * as React from "react"

import { EmptyValue } from "@/components/ui/empty-state"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

/**
 * The KPI tile used by every dashboard in the application.
 *
 * Two rules are enforced here rather than left to each page:
 *
 * 1. **A null measurement renders as an em dash, never as zero.** "No lab
 *    orders were placed today" and "we could not compute today's lab orders"
 *    are different statements, and a finance or clinical dashboard that
 *    conflates them is lying quietly.
 * 2. **A trend never asserts a direction it was not given.** `trend.direction`
 *    is explicit, because "down" is good for readmissions and bad for
 *    collections — the tile cannot infer polarity from the sign.
 */

export interface StatCardTrend {
  value: string
  /** Which way the number moved. */
  direction: "up" | "down" | "flat"
  /** Whether that movement is good, bad, or neither *for this metric*. */
  intent?: "positive" | "negative" | "neutral"
  /** e.g. "vs. last week" */
  label?: string
}

export interface StatCardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  label: string
  /** `null`/`undefined` renders the not-recorded dash, not a zero. */
  value: React.ReactNode
  icon?: React.ElementType
  hint?: React.ReactNode
  trend?: StatCardTrend
  /** Makes the whole tile a link to the drill-down view. */
  href?: string
  loading?: boolean
  /** Tints the icon chip — use to carry a status meaning, e.g. critical count. */
  tone?: "default" | "success" | "warning" | "danger" | "info"
}

const TONE_CHIP: Record<NonNullable<StatCardProps["tone"]>, string> = {
  default: "bg-primary-subtle text-primary-subtle-foreground",
  success: "bg-success-subtle text-success-subtle-foreground",
  warning: "bg-warning-subtle text-warning-subtle-foreground",
  danger: "bg-danger-subtle text-danger-subtle-foreground",
  info: "bg-info-subtle text-info-subtle-foreground",
}

const TREND_INTENT: Record<NonNullable<StatCardTrend["intent"]>, string> = {
  positive: "text-success-subtle-foreground",
  negative: "text-danger-subtle-foreground",
  neutral: "text-muted-foreground",
}

const TREND_ICON = {
  up: ArrowUpRight,
  down: ArrowDownRight,
  flat: ArrowRight,
} as const

export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  trend,
  href,
  loading = false,
  tone = "default",
  className,
  ...props
}: StatCardProps) {
  const TrendIcon = trend ? TREND_ICON[trend.direction] : null

  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        {Icon && (
          <span
            className={cn(
              "flex size-7 shrink-0 items-center justify-center rounded-md",
              TONE_CHIP[tone]
            )}
          >
            <Icon className="size-3.5" aria-hidden="true" />
          </span>
        )}
      </div>

      <div className="mt-2">
        {loading ? (
          <Skeleton className="h-7 w-20" />
        ) : (
          <p className="text-2xl font-semibold tabular-nums tracking-tight text-foreground">
            {value === null || value === undefined || value === "" ? <EmptyValue /> : value}
          </p>
        )}
      </div>

      {(trend || hint) && (
        <div className="mt-2 flex items-center gap-1.5 text-xs">
          {trend && TrendIcon && (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 font-medium tabular-nums",
                TREND_INTENT[trend.intent ?? "neutral"]
              )}
            >
              <TrendIcon className="size-3" aria-hidden="true" />
              {trend.value}
            </span>
          )}
          {(trend?.label || hint) && (
            <span className="truncate text-muted-foreground">{trend?.label ?? hint}</span>
          )}
        </div>
      )}
    </>
  )

  const shell = cn(
    "group relative rounded-lg border bg-surface p-4 shadow-xs transition-[border-color,box-shadow] duration-fast",
    href && "hover:border-border-strong hover:shadow-sm",
    className
  )

  if (href) {
    return (
      <Link
        href={href}
        className={cn(
          shell,
          "block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        )}
      >
        {body}
      </Link>
    )
  }

  return (
    <div className={shell} {...props}>
      {body}
    </div>
  )
}

/** Responsive tile row. Defaults to the 4-up rhythm most dashboards use. */
export function StatCardGrid({
  className,
  columns = 4,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { columns?: 2 | 3 | 4 | 5 | 6 }) {
  return (
    <div
      className={cn(
        "grid gap-3",
        columns === 2 && "sm:grid-cols-2",
        columns === 3 && "sm:grid-cols-2 lg:grid-cols-3",
        columns === 4 && "sm:grid-cols-2 lg:grid-cols-4",
        columns === 5 && "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5",
        columns === 6 && "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6",
        className
      )}
      {...props}
    />
  )
}
