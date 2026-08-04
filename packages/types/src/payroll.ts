/**
 * Payroll *preparation* only (attendance summary, overtime, leave
 * deduction, export) — no pay-run/payslip/disbursement processing. That is
 * explicitly future scope; see TECH_DEBT.
 */
export interface PayrollSummaryEntry {
  staffId: string
  employeeId: string
  fullName: string
  departmentName: string | null
  designation: string
  totalDays: number
  daysPresent: number
  daysLate: number
  daysHalfDay: number
  daysAbsent: number
  paidLeaveDays: number
  unpaidLeaveDays: number
  holidayDays: number
  weekOffDays: number
  overtimeMinutes: number
  overtimeAmount: number | null
  leaveDeductionAmount: number | null
  netPayableDays: number
}

export interface PayrollSummaryQuery {
  month: string // Format: YYYY-MM
  departmentId?: string
  staffId?: string
}

export interface PayrollSummaryResponse {
  month: string
  generatedAt: Date
  entries: PayrollSummaryEntry[]
}
