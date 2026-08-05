import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { Loader2 } from "lucide-react"
import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Design System V2.
 *
 * Heights step 7/8/9/10 rather than the shadcn default 9/10/11 — enterprise
 * density. Every variant resolves through brand tokens, so a tenant's colour
 * reaches the fill, the hover, the active state and the focus ring without a
 * component change.
 *
 * Pre-V2 variants (`default`, `destructive`, `outline`, `secondary`, `ghost`,
 * `link`) and sizes are all preserved — roughly ninety pages depend on them.
 */
const buttonVariants = cva(
  "relative inline-flex select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-md text-sm font-medium transition-[background-color,border-color,color,box-shadow] duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-xs hover:bg-primary-hover active:bg-primary-active",
        /** Tinted brand button — the workhorse for secondary page actions. */
        soft: "bg-primary-subtle text-primary-subtle-foreground hover:bg-primary-subtle/70",
        destructive:
          "bg-destructive text-destructive-foreground shadow-xs hover:bg-destructive/90",
        danger:
          "bg-danger text-danger-foreground shadow-xs hover:bg-danger/90",
        success:
          "bg-success text-success-foreground shadow-xs hover:bg-success/90",
        outline:
          "border border-input bg-surface shadow-xs hover:bg-surface-hover hover:text-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary-hover",
        ghost: "hover:bg-surface-hover hover:text-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        xs: "h-7 rounded-sm px-2 text-xs [&_svg]:size-3.5",
        sm: "h-8 rounded-md px-2.5",
        default: "h-9 px-3.5",
        lg: "h-10 rounded-md px-5",
        icon: "h-9 w-9",
        "icon-sm": "h-8 w-8",
        "icon-xs": "h-7 w-7 rounded-sm [&_svg]:size-3.5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  /**
   * Swaps the label for a spinner and disables the button. The button keeps
   * its width while loading — a shrinking button under the cursor causes
   * mis-clicks, which in this domain can mean a double-charged invoice.
   */
  loading?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, children, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"

    // `asChild` renders an arbitrary element (usually a Link); injecting a
    // spinner would break Slot's single-child contract, so loading state is
    // only decorated on a real <button>.
    if (asChild) {
      return (
        <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props}>
          {children}
        </Comp>
      )
    }

    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading && <Loader2 className="animate-spin" aria-hidden="true" />}
        {children}
      </button>
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
