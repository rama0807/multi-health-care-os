import * as React from "react"

import { Badge, type BadgeProps } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

/**
 * One place that decides what a domain status *looks* like.
 *
 * MediCore has around twenty status vocabularies - appointments, encounters,
 * lab orders, radiology, dispensing, invoices, claims, admissions, nursing
 * tasks, procurement. Before this, each page picked its own colour, so
 * "Cancelled" was grey in Pharmacy and red in Billing, and a nurse moving
 * between queues had to re-learn the palette on every screen.
 *
 * The mapping is by *meaning*, not by module:
 *
 * - `success` - a terminal good outcome (Completed, Paid, Dispensed, Settled)
 * - `info`    - actively in flight (In Progress, Under Review, Preparing)
 * - `warning` - waiting on a human (Pending, Submitted, Ordered, Draft-ish)
 * - `danger`  - failed, refused, or clinically urgent (Rejected, Critical)
 * - `neutral` - inert (Draft, Cancelled, Closed, Inactive, Archived)
 *
 * Cancelled is deliberately neutral and not red: a cancelled appointment is a
 * normal administrative event, and reserving red for genuine failure is what
 * keeps red meaningful on a screen a clinician scans in two seconds.
 */

export type StatusTone = NonNullable<BadgeProps["variant"]>

const STATUS_TONES: Record<string, StatusTone> = {
  // ── Terminal, good ──────────────────────────────────────────────────────
  COMPLETED: "success",
  COMPLETE: "success",
  SUCCEEDED: "success",
  ACTIVE: "success",
  APPROVED: "success",
  PAID: "success",
  SETTLED: "success",
  DISPENSED: "success",
  REPORTED: "success",
  RELEASED: "success",
  VERIFIED: "success",
  RECEIVED: "success",
  CONFIRMED: "success",
  DISCHARGED: "success",
  AVAILABLE: "success",
  PRESENT: "success",
  NORMAL: "success",
  RESOLVED: "success",
  DELIVERED: "success",
  ADMINISTERED: "success",
  SENT: "success",

  // ── In flight ───────────────────────────────────────────────────────────
  IN_PROGRESS: "info",
  IN_CONSULTATION: "info",
  UNDER_REVIEW: "info",
  PREPARING: "info",
  PROCESSING: "info",
  ARRIVED: "info",
  ADMITTED: "info",
  SAMPLE_COLLECTED: "info",
  PARTIALLY_RECEIVED: "info",
  PARTIALLY_APPROVED: "info",
  PARTIALLY_SETTLED: "info",
  PARTIALLY_PAID: "info",
  SCHEDULED: "info",
  READY: "info",
  OCCUPIED: "info",
  RESERVED: "info",
  ON_LEAVE: "info",
  AMENDED: "info",
  TRIALING: "info",

  // ── Waiting on a human ──────────────────────────────────────────────────
  PENDING: "warning",
  SUBMITTED: "warning",
  ORDERED: "warning",
  REQUESTED: "warning",
  AWAITING_APPROVAL: "warning",
  PENDING_APPROVAL: "warning",
  OVERDUE: "warning",
  LOW_STOCK: "warning",
  EXPIRING: "warning",
  DUE: "warning",
  LATE: "warning",
  HALF_DAY: "warning",
  DELAYED: "warning",
  HELD: "warning",
  DISPUTED: "warning",
  MAINTENANCE: "warning",
  UNDER_RENOVATION: "warning",
  CLEANING: "warning",
  QUEUED: "warning",
  RETRYING: "warning",

  // ── Failed / urgent ─────────────────────────────────────────────────────
  REJECTED: "danger",
  FAILED: "danger",
  CRITICAL: "danger",
  CRITICAL_HIGH: "danger",
  CRITICAL_LOW: "danger",
  ABNORMAL: "danger",
  HIGH: "danger",
  LOW: "danger",
  STAT: "danger",
  EMERGENCY: "danger",
  URGENT: "danger",
  MISSED: "danger",
  REFUSED: "danger",
  ABSENT: "danger",
  SUSPENDED: "danger",
  EXPIRED: "danger",
  BLOCKED: "danger",
  OUT_OF_STOCK: "danger",
  BREAKDOWN: "danger",
  ESCALATED: "danger",
  PAST_DUE: "danger",

  // ── Inert ───────────────────────────────────────────────────────────────
  DRAFT: "neutral",
  CANCELLED: "neutral",
  CANCELED: "neutral",
  CLOSED: "neutral",
  INACTIVE: "neutral",
  ARCHIVED: "neutral",
  DISCONTINUED: "neutral",
  RETURNED: "neutral",
  REFUNDED: "neutral",
  NO_SHOW: "neutral",
  SKIPPED: "neutral",
  WEEK_OFF: "neutral",
  HOLIDAY: "neutral",
  ROUTINE: "neutral",
  CONVERTED: "neutral",
  INVOICED: "neutral",
}

/** `Sample Collected`, `sample-collected`, `SAMPLE_COLLECTED` → same key. */
function normalise(status: string): string {
  return status.trim().toUpperCase().replace(/[\s-]+/g, "_")
}

export function statusTone(status: string): StatusTone {
  return STATUS_TONES[normalise(status)] ?? "neutral"
}

/** `SAMPLE_COLLECTED` → `Sample collected`. Leaves already-prose labels alone. */
export function humaniseStatus(status: string): string {
  const raw = status.trim()
  if (!raw) return raw
  if (/[a-z]/.test(raw) && !raw.includes("_")) return raw

  const words = raw.toLowerCase().replace(/[_-]+/g, " ")
  return words.charAt(0).toUpperCase() + words.slice(1)
}

export interface StatusBadgeProps extends Omit<BadgeProps, "children" | "variant"> {
  status: string
  /** Overrides the label while keeping the mapped tone. */
  label?: string
  /** Overrides the mapped tone. Use sparingly - divergence is the problem. */
  tone?: StatusTone
}

export function StatusBadge({ status, label, tone, dot = true, className, ...props }: StatusBadgeProps) {
  return (
    <Badge
      variant={tone ?? statusTone(status)}
      dot={dot}
      className={cn("capitalize", className)}
      {...props}
    >
      {label ?? humaniseStatus(status)}
    </Badge>
  )
}
