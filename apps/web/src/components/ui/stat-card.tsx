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
 *    collections - the tile cannot infer polarity from the sign.
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
  /** Tints the icon chip - use to carry a status meaning, e.g. critical count. */
  tone?: "default" | "success" | "warning" | "danger" | "info"
  /**
   * Optional trend shape, rendered as a tiny inline sparkline. Decorative only
   * - for a real chart, link to the module's report instead of trying to make
   * this tile do more than a KPI glance should.
   */
  sparklineData?: number[]
}

/** A minimal inline trend line - no chart library, no axes, no tooltip. */
function Sparkline({ data, className }: { data: number[]; className?: string }) {
  if (data.length < 2) return null
  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1
  const points = data
    .map((point, index) => {
      const x = (index / (data.length - 1)) * 100
      const y = 18 - ((point - min) / range) * 16
      return `${x},${y}`
    })
    .join(" ")

  return (
    <svg
      viewBox="0 0 100 20"
      preserveAspectRatio="none"
      className={cn("h-5 w-16", className)}
      aria-hidden="true"
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
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
  sparklineData,
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
              "flex size-8 shrink-0 items-center justify-center rounded-md ring-1 ring-inset ring-border/60",
              TONE_CHIP[tone]
            )}
          >
            <Icon className="size-4" aria-hidden="true" />
          </span>
        )}
      </div>

      <div className="mt-2.5">
        {loading ? (
          <Skeleton className="h-7 w-20" />
        ) : (
          <p className="text-2xl font-bold leading-none tracking-tight text-foreground tabular-nums">
            {value === null || value === undefined || value === "" ? <EmptyValue /> : value}
          </p>
        )}
      </div>

      {(trend || hint) && (
        <div className="mt-2.5 flex items-center justify-between gap-2 text-xs">
          <div className="flex min-w-0 items-center gap-1.5">
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
          {!loading && sparklineData && sparklineData.length > 1 && (
            <Sparkline
              data={sparklineData}
              className={cn(
                "shrink-0",
                trend?.intent === "positive" && "text-success-subtle-foreground",
                trend?.intent === "negative" && "text-danger-subtle-foreground",
                (!trend?.intent || trend.intent === "neutral") && "text-primary/60"
              )}
            />
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
