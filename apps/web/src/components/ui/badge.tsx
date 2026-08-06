import { cva, type VariantProps } from "class-variance-authority"
import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Design System V2.
 *
 * Badges are square-ish (`rounded`, not `rounded-full`) and use tint + tinted
 * text rather than a solid fill. A screen showing thirty statuses at once -
 * which every queue in this application does - turns into confetti with solid
 * pills, and the row content stops being the thing you read first.
 *
 * For domain status values, prefer `<StatusBadge>`: it maps a status string to
 * a *tone* once, centrally, so "CANCELLED" is never amber on one page and grey
 * on the next.
 */
const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center gap-1 whitespace-nowrap rounded border px-1.5 py-0.5 text-xs font-medium leading-tight transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 [&_svg]:size-3 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "border-primary-border bg-primary-subtle text-primary-subtle-foreground",
        /** Solid brand - reserve for a single emphatic badge, e.g. a count. */
        solid: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        outline: "border-border text-muted-foreground",
        neutral: "border-neutral-border bg-neutral-subtle text-neutral-subtle-foreground",
        success: "border-success-border bg-success-subtle text-success-subtle-foreground",
        warning: "border-warning-border bg-warning-subtle text-warning-subtle-foreground",
        danger: "border-danger-border bg-danger-subtle text-danger-subtle-foreground",
        info: "border-info-border bg-info-subtle text-info-subtle-foreground",
        /** Pre-V2 alias for `danger`, kept for existing pages. */
        destructive: "border-danger-border bg-danger-subtle text-danger-subtle-foreground",
        accent:
          "border-brand-accent-border bg-brand-accent-subtle text-brand-accent-subtle-foreground",
      },
      size: {
        default: "px-1.5 py-0.5 text-xs",
        sm: "px-1 py-0 text-2xs",
        lg: "px-2 py-1 text-xs",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  /**
   * Prefixes a filled dot in the badge's own tone. Colour alone must never be
   * the only signal (WCAG 1.4.1), and the label carries that - the dot is the
   * scannability aid on a dense queue.
   */
  dot?: boolean
}

function Badge({ className, variant, size, dot = false, children, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant, size }), className)} {...props}>
      {dot && (
        <span
          aria-hidden="true"
          className="size-1.5 shrink-0 rounded-full bg-current opacity-70"
        />
      )}
      {children}
    </div>
  )
}

export { Badge, badgeVariants }
