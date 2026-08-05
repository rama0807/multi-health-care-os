import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Determinate progress / meter.
 *
 * Dependency-free on purpose (no `@radix-ui/react-progress`) — it is a div and
 * an ARIA role, and this repo already carries enough Radix surface.
 *
 * `tone` is explicit rather than derived from the percentage: 90% of a storage
 * quota is a warning, 90% of bed occupancy is just a busy Tuesday, and 90% of
 * a discharge checklist is good news. The component refuses to guess.
 */
export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number
  max?: number
  tone?: "default" | "success" | "warning" | "danger" | "info" | "accent"
  size?: "sm" | "default" | "lg"
  label?: string
}

const TONE_FILL = {
  default: "bg-primary",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  info: "bg-info",
  accent: "bg-brand-accent",
} as const

const SIZE = { sm: "h-1", default: "h-1.5", lg: "h-2.5" } as const

export function Progress({
  value,
  max = 100,
  tone = "default",
  size = "default",
  label,
  className,
  ...props
}: ProgressProps) {
  const safeMax = max > 0 ? max : 100
  const clamped = Math.min(Math.max(Number.isFinite(value) ? value : 0, 0), safeMax)
  const percent = (clamped / safeMax) * 100

  return (
    <div
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={safeMax}
      aria-label={label}
      className={cn("w-full overflow-hidden rounded-full bg-surface-secondary", SIZE[size], className)}
      {...props}
    >
      {/* Width, not transform: a scaled bar blurs its own rounded end cap. */}
      <div
        className={cn("h-full rounded-full transition-[width] duration-slow", TONE_FILL[tone])}
        style={{ width: `${percent}%` }}
      />
    </div>
  )
}

/** Keyboard shortcut hint. */
export function Kbd({ className, ...props }: React.HTMLAttributes<HTMLElement>) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded border border-border bg-surface-secondary px-1 font-sans text-2xs font-medium text-muted-foreground",
        className
      )}
      {...props}
    />
  )
}
