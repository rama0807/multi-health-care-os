"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"
import * as React from "react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export interface PaginationProps extends React.HTMLAttributes<HTMLDivElement> {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
}

function getPageNumbers(page: number, totalPages: number): Array<number | "ellipsis"> {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1)

  const candidates = [1, 2, totalPages - 1, totalPages, page - 1, page, page + 1]
  const sorted = [...new Set(candidates)].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b)

  const result: Array<number | "ellipsis"> = []
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) result.push("ellipsis")
    result.push(p)
  })
  return result
}

function Pagination({ page, totalPages, onPageChange, className, ...props }: PaginationProps) {
  if (totalPages <= 1) return null

  return (
    <div className={cn("flex items-center justify-center gap-1", className)} {...props}>
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        aria-label="Previous page"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      {getPageNumbers(page, totalPages).map((p, i) =>
        p === "ellipsis" ? (
          <span key={`ellipsis-${i}`} className="px-2 text-sm text-muted-foreground">
            &hellip;
          </span>
        ) : (
          <Button
            key={p}
            variant={p === page ? "default" : "outline"}
            size="icon"
            className="h-8 w-8"
            onClick={() => onPageChange(p)}
          >
            {p}
          </Button>
        )
      )}

      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
        aria-label="Next page"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  )
}

export { Pagination }
