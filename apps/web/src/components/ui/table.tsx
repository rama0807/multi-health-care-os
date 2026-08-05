"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Design System V2 — the table primitives.
 *
 * What changed, and why:
 *
 * - **Sticky headers.** A lab queue or a stock ledger is hundreds of rows long.
 *   Losing the column labels after one scroll is the single biggest usability
 *   failure a dense table can have, so `<TableHeader sticky>` is available on
 *   every table and is the default inside `<TableContainer>`.
 * - **A real scroll container.** The old `<Table>` wrapped itself in
 *   `overflow-auto` with no height, so it could never actually scroll — the
 *   *page* scrolled instead, which is what made sticky headers impossible.
 *   Scrolling is now the container's job, and the container is opt-in.
 * - **Density.** Cells are 12px vertical at `comfortable`, 8px at `compact`.
 *   Set once on `<Table density>`; every cell inherits through CSS rather than
 *   each page passing a className to fifty `<TableCell>`s.
 * - **Selection is a first-class row state**, visually distinct from hover, so
 *   a bulk action never leaves you unsure what it will apply to.
 *
 * Numeric columns must use `align="right"` on both the head and the cell —
 * combined with the global `tabular-nums`, that is what makes a currency column
 * comparable at a glance.
 */

type Density = "comfortable" | "compact"

const DensityContext = React.createContext<Density>("comfortable")

const DENSITY_CELL: Record<Density, string> = {
  comfortable: "px-3 py-3",
  compact: "px-2.5 py-1.5",
}

const DENSITY_HEAD: Record<Density, string> = {
  comfortable: "h-9 px-3",
  compact: "h-8 px-2.5",
}

/**
 * Scroll viewport for a table. Give it a `max-h-*` and the header sticks while
 * the body scrolls; without one it grows to content and the page scrolls
 * instead (still correct, just not sticky).
 */
const TableContainer = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "relative w-full overflow-auto overscroll-x-contain rounded-lg border bg-surface",
        className
      )}
      {...props}
    />
  )
)
TableContainer.displayName = "TableContainer"

interface TableProps extends React.HTMLAttributes<HTMLTableElement> {
  density?: Density
  /**
   * Wraps the table in its own scroll container. Kept `true` by default so the
   * pre-V2 call sites that relied on `<Table>` providing its own overflow
   * wrapper keep working unchanged.
   */
  container?: boolean
  containerClassName?: string
}

const Table = React.forwardRef<HTMLTableElement, TableProps>(
  ({ className, density = "comfortable", container = true, containerClassName, ...props }, ref) => {
    const table = (
      <table
        ref={ref}
        className={cn("w-full caption-bottom border-separate border-spacing-0 text-sm", className)}
        {...props}
      />
    )

    return (
      <DensityContext.Provider value={density}>
        {container ? (
          <TableContainer className={cn("border-0 bg-transparent", containerClassName)}>
            {table}
          </TableContainer>
        ) : (
          table
        )}
      </DensityContext.Provider>
    )
  }
)
Table.displayName = "Table"

const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement> & { sticky?: boolean }
>(({ className, sticky = true, ...props }, ref) => (
  <thead
    ref={ref}
    className={cn(
      "bg-surface-secondary [&_th]:border-b",
      // `border-separate` above means the header's bottom border travels with
      // it while stuck — a collapsed border would be left behind at the top of
      // the scrolled content.
      sticky && "sticky top-0 z-sticky",
      className
    )}
    {...props}
  />
))
TableHeader.displayName = "TableHeader"

const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody ref={ref} className={cn("[&_tr:last-child_td]:border-0", className)} {...props} />
))
TableBody.displayName = "TableBody"

const TableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    className={cn(
      "sticky bottom-0 z-sticky bg-surface-secondary font-medium [&_td]:border-t",
      className
    )}
    {...props}
  />
))
TableFooter.displayName = "TableFooter"

interface TableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  selected?: boolean
  /** Adds pointer affordance + keyboard access for a row that navigates. */
  interactive?: boolean
}

const TableRow = React.forwardRef<HTMLTableRowElement, TableRowProps>(
  ({ className, selected, interactive, onClick, onKeyDown, ...props }, ref) => (
    <tr
      ref={ref}
      data-state={selected ? "selected" : undefined}
      // A clickable row is a real control: it takes focus and responds to
      // Enter, so it is not mouse-only.
      tabIndex={interactive ? 0 : undefined}
      role={interactive ? "button" : undefined}
      onClick={onClick}
      onKeyDown={(event) => {
        if (interactive && event.key === "Enter" && event.currentTarget === event.target) {
          event.currentTarget.click()
        }
        onKeyDown?.(event)
      }}
      className={cn(
        "group/row transition-colors duration-fast",
        "hover:bg-surface-hover",
        "data-[state=selected]:bg-primary-subtle data-[state=selected]:hover:bg-primary-subtle",
        interactive &&
          "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
        className
      )}
      {...props}
    />
  )
)
TableRow.displayName = "TableRow"

interface TableHeadProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  align?: "left" | "center" | "right"
  /** Pins the column horizontally — for an identity column on a wide table. */
  sticky?: boolean
}

const TableHead = React.forwardRef<HTMLTableCellElement, TableHeadProps>(
  ({ className, align = "left", sticky, ...props }, ref) => {
    const density = React.useContext(DensityContext)
    return (
      <th
        ref={ref}
        className={cn(
          DENSITY_HEAD[density],
          "whitespace-nowrap border-border bg-surface-secondary align-middle text-xs font-medium uppercase tracking-wide text-muted-foreground",
          align === "left" && "text-left",
          align === "center" && "text-center",
          align === "right" && "text-right",
          sticky && "sticky left-0 z-raised",
          "[&:has([role=checkbox])]:w-10 [&:has([role=checkbox])]:pr-0",
          className
        )}
        {...props}
      />
    )
  }
)
TableHead.displayName = "TableHead"

interface TableCellProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
  align?: "left" | "center" | "right"
  sticky?: boolean
}

const TableCell = React.forwardRef<HTMLTableCellElement, TableCellProps>(
  ({ className, align = "left", sticky, ...props }, ref) => {
    const density = React.useContext(DensityContext)
    return (
      <td
        ref={ref}
        className={cn(
          DENSITY_CELL[density],
          "border-b border-border align-middle text-foreground",
          align === "left" && "text-left",
          align === "center" && "text-center",
          align === "right" && "text-right tabular-nums",
          sticky &&
            "sticky left-0 z-raised bg-surface group-hover/row:bg-surface-hover group-data-[state=selected]/row:bg-primary-subtle",
          "[&:has([role=checkbox])]:w-10 [&:has([role=checkbox])]:pr-0",
          className
        )}
        {...props}
      />
    )
  }
)
TableCell.displayName = "TableCell"

const TableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.HTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, ref) => (
  <caption ref={ref} className={cn("mt-3 text-xs text-muted-foreground", className)} {...props} />
))
TableCaption.displayName = "TableCaption"

/**
 * Row actions that stay out of the way until the row is hovered or focused.
 * They remain in the DOM and reachable by keyboard at all times — hiding them
 * with `display:none` until hover would make them mouse-only.
 */
const TableRowActions = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex items-center justify-end gap-1 opacity-0 transition-opacity duration-fast",
        "group-hover/row:opacity-100 group-focus-within/row:opacity-100",
        // Touch and reduced-motion users never hover; show them unconditionally.
        "[@media(hover:none)]:opacity-100 motion-reduce:opacity-100",
        className
      )}
      {...props}
    />
  )
)
TableRowActions.displayName = "TableRowActions"

/** Full-width message row for empty / error states inside a table body. */
function TableEmptyRow({
  colSpan,
  children,
  className,
}: {
  colSpan: number
  children: React.ReactNode
  className?: string
}) {
  return (
    <tr>
      <td colSpan={colSpan} className={cn("border-b-0 p-0", className)}>
        {children}
      </td>
    </tr>
  )
}

export {
  Table,
  TableContainer,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
  TableRowActions,
  TableEmptyRow,
}
