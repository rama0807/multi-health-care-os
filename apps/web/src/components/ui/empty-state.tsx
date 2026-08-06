import { AlertTriangle, Inbox, SearchX } from "lucide-react"
import * as React from "react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/**
 * The four states a data surface can be in besides "has data".
 *
 * These are separate on purpose. "No patients yet" and "no patients match
 * *this filter*" call for completely different actions - the first wants a
 * create button, the second wants a clear-filters button - and collapsing them
 * into one grey "No data" is the single most common way a dashboard wastes a
 * user's time.
 *
 * A missing value is likewise never rendered as `0`: `<EmptyValue />` prints an
 * em dash, because "we did not measure this" and "this is zero" are different
 * clinical and financial facts.
 */

type EmptyStateVariant = "empty" | "search" | "error"

const ICONS: Record<EmptyStateVariant, React.ElementType> = {
  empty: Inbox,
  search: SearchX,
  error: AlertTriangle,
}

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: EmptyStateVariant
  icon?: React.ElementType
  title: string
  description?: React.ReactNode
  /** Primary call to action. */
  action?: { label: string; onClick?: () => void; href?: string; icon?: React.ElementType }
  /** Secondary escape hatch - usually "Clear filters". */
  secondaryAction?: { label: string; onClick?: () => void }
  /** Sits inline inside a card/table body rather than owning the viewport. */
  compact?: boolean
}

export function EmptyState({
  variant = "empty",
  icon,
  title,
  description,
  action,
  secondaryAction,
  compact = false,
  className,
  ...props
}: EmptyStateProps) {
  const Icon = icon ?? ICONS[variant]
  const ActionIcon = action?.icon

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compact ? "gap-2 px-4 py-8" : "gap-3 px-6 py-14",
        className
      )}
      {...props}
    >
      <div
        className={cn(
          "flex items-center justify-center rounded-full ring-1 ring-inset ring-border/60",
          compact ? "size-9" : "size-12",
          variant === "error"
            ? "bg-danger-subtle text-danger-subtle-foreground"
            : "bg-surface-secondary text-subtle-foreground"
        )}
      >
        <Icon className={compact ? "size-4" : "size-5"} aria-hidden="true" />
      </div>

      <div className="space-y-1">
        <p className={cn("font-medium text-foreground", compact ? "text-sm" : "text-base")}>
          {title}
        </p>
        {description && (
          <p className="mx-auto max-w-sm text-pretty text-sm text-muted-foreground">
            {description}
          </p>
        )}
      </div>

      {(action || secondaryAction) && (
        <div className="mt-1 flex items-center gap-2">
          {action &&
            (action.href ? (
              <Button size="sm" asChild>
                <a href={action.href}>
                  {ActionIcon && <ActionIcon />}
                  {action.label}
                </a>
              </Button>
            ) : (
              <Button size="sm" onClick={action.onClick}>
                {ActionIcon && <ActionIcon />}
                {action.label}
              </Button>
            ))}
          {secondaryAction && (
            <Button size="sm" variant="ghost" onClick={secondaryAction.onClick}>
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * The canonical rendering of "no value". Never substitute `0`, `-`, or an empty
 * cell - an em dash with a screen-reader label says *not recorded* explicitly.
 */
export function EmptyValue({ label = "Not recorded" }: { label?: string }) {
  return (
    <span className="text-subtle-foreground" title={label}>
      <span aria-hidden="true">-</span>
      <span className="sr-only">{label}</span>
    </span>
  )
}
