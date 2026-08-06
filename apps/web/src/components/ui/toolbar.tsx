"use client"

import { Search, X } from "lucide-react"
import * as React from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

/**
 * The filter/search bar that sits above every list in the application, and the
 * selection bar that replaces it when rows are checked.
 *
 * The one behaviour worth calling out: `<FilterBar>` renders a "Clear" control
 * whenever `activeCount > 0`. Filtered-empty results are the most common way a
 * user concludes "the data is gone" - a visible, counted escape hatch is what
 * prevents that, and it only works if every list surfaces it the same way.
 */

export interface FilterBarProps extends React.HTMLAttributes<HTMLDivElement> {
  /** How many filters are currently narrowing the result set. */
  activeCount?: number
  onClear?: () => void
  /** Right-aligned controls: density toggle, column picker, export. */
  trailing?: React.ReactNode
}

export function FilterBar({
  activeCount = 0,
  onClear,
  trailing,
  children,
  className,
  ...props
}: FilterBarProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-lg border bg-surface p-2",
        className
      )}
      {...props}
    >
      {children}

      {activeCount > 0 && onClear && (
        <Button variant="ghost" size="sm" onClick={onClear} className="text-muted-foreground">
          <X />
          Clear
          <span className="ml-0.5 rounded-full bg-secondary px-1.5 text-2xs font-semibold tabular-nums text-secondary-foreground">
            {activeCount}
          </span>
        </Button>
      )}

      {trailing && <div className="ml-auto flex items-center gap-2">{trailing}</div>}
    </div>
  )
}

export interface SearchInputProps
  extends Omit<React.ComponentProps<"input">, "onChange" | "value"> {
  value: string
  onValueChange: (value: string) => void
  containerClassName?: string
}

/**
 * Search field with a leading icon and a clear button that appears only when
 * there is something to clear. Escape clears it too - the shortcut people
 * already expect from every other search box they use.
 */
export const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  ({ value, onValueChange, className, containerClassName, placeholder = "Search…", ...props }, ref) => (
    <div className={cn("relative min-w-0 flex-1 sm:max-w-xs", containerClassName)}>
      <Search
        className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-subtle-foreground"
        aria-hidden="true"
      />
      <Input
        ref={ref}
        type="search"
        inputMode="search"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onValueChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape" && value) {
            event.preventDefault()
            onValueChange("")
          }
        }}
        className={cn("h-8 pl-8 pr-8 [&::-webkit-search-cancel-button]:appearance-none", className)}
        {...props}
      />
      {value && (
        <button
          type="button"
          onClick={() => onValueChange("")}
          aria-label="Clear search"
          className="absolute right-1.5 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center rounded-xs text-subtle-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  )
)
SearchInput.displayName = "SearchInput"

/**
 * Bulk-action bar for a table with rows selected.
 *
 * Docked to the bottom of the viewport rather than pushing the table down:
 * a bar that appears *in flow* shifts every row the instant a checkbox is
 * ticked, so the second row you meant to tick has moved by the time you get
 * there. Renders nothing at all when the count is zero.
 */
export function BulkActionBar({
  count,
  onClear,
  children,
  noun = "item",
  className,
}: {
  count: number
  onClear?: () => void
  children?: React.ReactNode
  /** Singular noun; pluralised with a trailing "s". */
  noun?: string
  className?: string
}) {
  if (count <= 0) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "pointer-events-none fixed inset-x-0 bottom-4 z-sticky flex justify-center px-4",
        className
      )}
    >
      <div className="pointer-events-auto flex animate-slide-up items-center gap-3 rounded-lg border bg-popover px-3 py-2 text-popover-foreground shadow-lg">
        <span className="text-sm font-medium tabular-nums">
          {count} {noun}
          {count === 1 ? "" : "s"} selected
        </span>
        <span className="h-4 w-px bg-border" aria-hidden="true" />
        <div className="flex items-center gap-1.5">{children}</div>
        {onClear && (
          <Button variant="ghost" size="icon-xs" onClick={onClear} aria-label="Clear selection">
            <X />
          </Button>
        )}
      </div>
    </div>
  )
}

/** Vertical rule between toolbar groups. */
export function ToolbarSeparator({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cn("h-5 w-px shrink-0 bg-border", className)} />
}
