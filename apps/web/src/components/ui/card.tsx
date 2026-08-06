import { cva, type VariantProps } from "class-variance-authority"
import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Design System V2.
 *
 * Two changes from the shadcn default, both about density: padding drops from
 * 24px to 16px, and `CardTitle` drops from `text-2xl` to `text-base`. A 24px
 * `<h3>` inside a card competes with the page's own `<h1>`, and in a system
 * where a dashboard stacks a dozen cards it produced a page with twelve
 * headlines and no hierarchy.
 *
 * Depth comes from the border. `elevated` adds a shadow and is for surfaces
 * that genuinely float; a card sitting in page flow does not. `interactive`
 * is for a card that is itself a control (wraps a `<Link>` or `onClick`) - it
 * lifts on hover so the whole tile reads as clickable, not just its label.
 */
const cardVariants = cva(
  "rounded-lg border bg-card text-card-foreground transition-shadow duration-fast",
  {
    variants: {
      variant: {
        default: "shadow-xs",
        elevated: "shadow-md",
        /** No shadow, muted fill - for a nested/inset panel inside a card. */
        inset: "border-border/70 bg-surface-secondary shadow-none",
        ghost: "border-transparent bg-transparent shadow-none",
        /** A card that is a link or button - hover lifts it off the page. */
        interactive:
          "cursor-pointer shadow-xs hover:border-border-strong hover:shadow-md",
      },
    },
    defaultVariants: { variant: "default" },
  }
)

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof cardVariants>
>(({ className, variant, ...props }, ref) => (
  <div ref={ref} className={cn(cardVariants({ variant }), className)} {...props} />
))
Card.displayName = "Card"

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1 p-4", className)}
    {...props}
  />
))
CardHeader.displayName = "CardHeader"

/**
 * Header row for a card that carries actions - title on the left, controls on
 * the right, aligned on the same baseline.
 */
const CardToolbar = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "flex flex-wrap items-center justify-between gap-x-4 gap-y-2 p-4",
      className
    )}
    {...props}
  />
))
CardToolbar.displayName = "CardToolbar"

const CardTitle = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-base font-semibold leading-tight tracking-tight", className)}
    {...props}
  />
))
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-4 pt-0", className)} {...props} />
))
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center gap-2 border-t bg-surface-secondary/50 px-4 py-3", className)}
    {...props}
  />
))
CardFooter.displayName = "CardFooter"

export {
  Card,
  CardHeader,
  CardToolbar,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
  cardVariants,
}
