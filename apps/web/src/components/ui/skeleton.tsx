import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Loading placeholders.
 *
 * The rule this system follows: a skeleton must occupy the **same geometry**
 * as the content it stands in for. A centred spinner that is replaced by a
 * dense table shifts every row under the pointer at the exact moment the user
 * starts reading. `<TableSkeleton>` and `<StatCardSkeleton>` exist so pages get
 * that for free instead of hand-rolling a different guess each time.
 */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn("skeleton-shimmer rounded-md bg-surface-secondary", className)}
      {...props}
    />
  )
}

/** A block of text lines with a short final line, the way real copy wraps. */
function SkeletonText({
  lines = 3,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { lines?: number }) {
  return (
    <div className={cn("space-y-2", className)} {...props}>
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          className={cn("h-3.5", index === lines - 1 ? "w-2/5" : "w-full")}
        />
      ))}
    </div>
  )
}

function TableSkeleton({
  rows = 6,
  columns = 5,
  className,
}: {
  rows?: number
  columns?: number
  className?: string
}) {
  return (
    <div
      className={cn("overflow-hidden rounded-lg border bg-surface", className)}
      role="status"
      aria-label="Loading table"
    >
      <div className="flex gap-4 border-b bg-surface-secondary px-4 py-2.5">
        {Array.from({ length: columns }).map((_, index) => (
          <Skeleton key={index} className="h-3 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex gap-4 border-b px-4 py-3 last:border-0">
          {Array.from({ length: columns }).map((_, columnIndex) => (
            <Skeleton
              key={columnIndex}
              className={cn("h-3.5 flex-1", columnIndex === 0 && "max-w-[40%]")}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

function StatCardSkeleton({ count = 4, className }: { count?: number; className?: string }) {
  return (
    <div
      className={cn("grid gap-3 sm:grid-cols-2 lg:grid-cols-4", className)}
      role="status"
      aria-label="Loading statistics"
    >
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="rounded-lg border bg-surface p-4">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-3 h-7 w-16" />
          <Skeleton className="mt-3 h-3 w-20" />
        </div>
      ))}
    </div>
  )
}

export { Skeleton, SkeletonText, TableSkeleton, StatCardSkeleton }
