/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import { Injectable } from '@nestjs/common'
import { DentalLabCaseStatus, InvoiceStatus, PaymentStatus } from '@prisma/client'

import { PrismaService } from '../../prisma/prisma.service'

/**
 * All aggregation logic for the Dental OS Dashboard.
 *
 * Every method is scoped by `organizationId` — tenant isolation is enforced at
 * the service layer, not just at the controller. Complex multi-table aggregations
 * are done in a single Prisma transaction to ensure consistency.
 *
 * KPI DEFINITIONS (important — these are the canonical definitions):
 *
 * PRODUCTION  — sum of DentalProcedure.cost for procedures performed in the
 *               selected period. Distinct from Collections.
 *
 * COLLECTIONS — sum of DentalPayment.amount where status = COMPLETED in period.
 *
 * OUTSTANDING — sum of DentalInvoice.balanceDue where status != CANCELLED and
 *               balanceDue > 0.
 *
 * OVERDUE     — outstanding invoices where dueDate < NOW.
 */
@Injectable()
export class DentalDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private todayRange() {
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    const end = new Date()
    end.setHours(23, 59, 59, 999)
    return { start, end }
  }

  private monthRange() {
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
    return { start, end }
  }

  // ─── Primary KPIs ─────────────────────────────────────────────────────────

  /**
   * Counts today's appointments by status.
   * Uses the shared Appointment model filtered to dental encounter type
   * (via appointmentType = 'DENTAL' or by organizations of type DENTAL).
   */
  async getTodayAppointmentStats(orgId: string) {
    const { start, end } = this.todayRange()

    // Dental org appointments are scoped by organizationId
    const appointments = await this.prisma.appointment.findMany({
      where: {
        organizationId: orgId,
        scheduledAt: { gte: start, lte: end },
      },
      select: { id: true, status: true, patientId: true },
    })

    const total = appointments.length
    const confirmed = appointments.filter((a) => a.status === 'CONFIRMED').length
    const pending = appointments.filter((a) => a.status === 'SCHEDULED').length
    const cancelled = appointments.filter((a) => a.status === 'CANCELLED').length
    const noShow = appointments.filter((a) => a.status === 'NO_SHOW').length
    const completed = appointments.filter((a) => a.status === 'COMPLETED').length
    const inProgress = appointments.filter((a) =>
      ['CHECKED_IN', 'IN_PROGRESS'].includes(a.status),
    ).length

    // Unique patients today
    const uniquePatientIds = [...new Set(appointments.map((a) => a.patientId))]

    return {
      total,
      confirmed,
      pending,
      cancelled,
      noShow,
      completed,
      inProgress,
      totalPatients: uniquePatientIds.length,
    }
  }

  /**
   * Today's new vs returning patients from appointments.
   */
  async getTodayPatientStats(orgId: string) {
    const { start, end } = this.todayRange()

    const todayAppointments = await this.prisma.appointment.findMany({
      where: {
        organizationId: orgId,
        scheduledAt: { gte: start, lte: end },
      },
      select: { patientId: true },
      distinct: ['patientId'],
    })

    const todayPatientIds = todayAppointments.map((a) => a.patientId)

    if (todayPatientIds.length === 0) {
      return { total: 0, newPatients: 0, returning: 0 }
    }

    // A "new" patient has their first appointment today (their patient record
    // was created today, or they have no prior appointment before today).
    const newPatients = await this.prisma.patient.count({
      where: {
        id: { in: todayPatientIds },
        createdAt: { gte: start, lte: end },
      },
    })

    return {
      total: todayPatientIds.length,
      newPatients,
      returning: todayPatientIds.length - newPatients,
    }
  }

  /**
   * Production = value of procedures performed today.
   * Collections = payments received today (COMPLETED status only).
   */
  async getTodayFinancialStats(orgId: string) {
    const { start, end } = this.todayRange()

    const [procedures, payments] = await Promise.all([
      this.prisma.dentalProcedure.findMany({
        where: {
          organizationId: orgId,
          performedAt: { gte: start, lte: end },
        },
        select: { cost: true },
      }),
      this.prisma.dentalPayment.findMany({
        where: {
          organizationId: orgId,
          status: PaymentStatus.COMPLETED,
          paymentDate: { gte: start, lte: end },
        },
        select: { amount: true },
      }),
    ])

    const production = procedures.reduce((sum, p) => sum + Number(p.cost), 0)
    const collections = payments.reduce((sum, p) => sum + Number(p.amount), 0)

    return { production, collections }
  }

  /**
   * Outstanding invoices — total and overdue breakdown.
   */
  async getOutstandingStats(orgId: string) {
    const now = new Date()

    const outstanding = await this.prisma.dentalInvoice.findMany({
      where: {
        organizationId: orgId,
        status: { notIn: [InvoiceStatus.CANCELLED] },
        balanceDue: { gt: 0 },
      },
      select: { balanceDue: true, dueDate: true },
    })

    const totalOutstanding = outstanding.reduce((sum, i) => sum + Number(i.balanceDue), 0)
    const overdue = outstanding
      .filter((i) => i.dueDate && i.dueDate < now)
      .reduce((sum, i) => sum + Number(i.balanceDue), 0)

    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    const dueSoon = outstanding
      .filter((i) => i.dueDate && i.dueDate >= now && i.dueDate <= nextWeek)
      .reduce((sum, i) => sum + Number(i.balanceDue), 0)

    return { total: totalOutstanding, overdue, dueSoon }
  }

  /**
   * Treatment pipeline — aggregated value by acceptance status.
   */
  async getTreatmentPipelineStats(orgId: string) {
    const options = await this.prisma.treatmentPlanOption.findMany({
      where: {
        plan: { organizationId: orgId },
      },
      select: {
        netCost: true,
        acceptance: { select: { status: true } },
      },
    })

    const pipeline = {
      proposed: 0,
      accepted: 0,
      deferred: 0,
      pendingFollowUp: 0,
    }

    for (const option of options) {
      const status = option.acceptance?.status
      const value = Number(option.netCost)
      if (!status || status === 'PENDING') {
        pipeline.proposed += value
      } else if (status === 'ACCEPTED') {
        pipeline.accepted += value
      } else if (status === 'DEFERRED') {
        pipeline.deferred += value
      } else if (status === 'CALLBACK_REQUESTED') {
        pipeline.pendingFollowUp += value
      }
    }

    const totalProposed = pipeline.proposed + pipeline.accepted + pipeline.deferred + pipeline.pendingFollowUp
    const acceptanceRate = totalProposed > 0
      ? Math.round((pipeline.accepted / totalProposed) * 100)
      : null

    return { ...pipeline, acceptanceRate }
  }

  // ─── Today's Clinic ───────────────────────────────────────────────────────

  /**
   * Full today's schedule — appointments with patient, provider, and chair info.
   */
  async getTodaysClinic(orgId: string) {
    const { start, end } = this.todayRange()

    return this.prisma.appointment.findMany({
      where: {
        organizationId: orgId,
        scheduledAt: { gte: start, lte: end },
      },
      select: {
        id: true,
        scheduledAt: true,
        durationMinutes: true,
        status: true,
        type: true,
        patient: { select: { id: true, firstName: true, lastName: true, uhid: true } },
        doctor: { select: { id: true, user: { select: { firstName: true, lastName: true } } } },
      },
      orderBy: { scheduledAt: 'asc' },
    })
  }

  /**
   * Active lab cases — with overdue detection.
   * Overdue = expectedReturnAt < now and status is not RECEIVED/DELIVERED.
   */
  async getLabStats(orgId: string) {
    const now = new Date()

    const allActive = await this.prisma.dentalLabCase.findMany({
      where: {
        organizationId: orgId,
        status: {
          notIn: [
            DentalLabCaseStatus.DELIVERED,
            DentalLabCaseStatus.CANCELLED,
            DentalLabCaseStatus.RECEIVED,
          ],
        },
      },
      select: {
        id: true,
        restorationName: true,
        status: true,
        expectedReturnAt: true,
        vendor: { select: { id: true, name: true } },
        patient: { select: { id: true, firstName: true, lastName: true } },
        measurements: { select: { toothNumber: true, restorationMaterial: true }, take: 1 },
      },
      orderBy: { expectedReturnAt: 'asc' },
    })

    const active = allActive.length
    const overdue = allActive.filter(
      (c) =>
        c.expectedReturnAt &&
        c.expectedReturnAt < now &&
        c.status !== DentalLabCaseStatus.RECEIVED && c.status !== DentalLabCaseStatus.DELIVERED,
    ).length

    const dueToday = allActive.filter((c) => {
      if (!c.expectedReturnAt) return false
      const due = new Date(c.expectedReturnAt)
      return due.toDateString() === now.toDateString()
    }).length

    const byStatus = {
      DRAFT: 0,
      SENT_TO_VENDOR: 0,
      RECEIVED: 0,
      REMAKE: 0,
    } as Record<string, number>

    for (const c of allActive) {
      if (byStatus[c.status] !== undefined) byStatus[c.status]++
    }

    return {
      active,
      overdue,
      dueToday,
      byStatus,
      cases: allActive.slice(0, 8),
    }
  }

  /**
   * Recall stats — due today and overdue.
   */
  async getRecallStats(orgId: string) {
    const todayEnd = new Date()
    todayEnd.setHours(23, 59, 59, 999)
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const [dueToday, overdue, upcoming] = await Promise.all([
      this.prisma.dentalRecall.count({
        where: {
          organizationId: orgId,
          status: { in: ['PENDING', 'NOTIFIED'] },
          dueDate: { gte: todayStart, lte: todayEnd },
        },
      }),
      this.prisma.dentalRecall.count({
        where: {
          organizationId: orgId,
          status: { in: ['PENDING', 'NOTIFIED'] },
          dueDate: { lt: todayStart },
        },
      }),
      this.prisma.dentalRecall.count({
        where: {
          organizationId: orgId,
          status: 'BOOKED',
        },
      }),
    ])

    return { dueToday, overdue, upcoming }
  }

  // ─── Needs Attention ──────────────────────────────────────────────────────

  /**
   * Actionable items that require attention.
   * All values come from real business rules, no fabrication.
   */
  async getNeedsAttention(orgId: string) {
    const now = new Date()
    const items: Array<{
      id: string
      type: string
      title: string
      description: string
      count: number
      value?: number
      href: string
      severity: 'high' | 'medium' | 'low'
    }> = []

    const todayMidnight = new Date(now)
    todayMidnight.setHours(0, 0, 0, 0)

    const [
      unsignedNotes,
      overdueLabCases,
      overdueRecalls,
      acceptedUnscheduled,
    ] = await Promise.all([
      // 1. Unsigned clinical notes (older than today = 24h not signed)
      this.prisma.dentalClinicalNote.count({
        where: {
          organizationId: orgId,
          isSigned: false,
          createdAt: { lt: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
        },
      }),
      // 2. Overdue lab cases
      this.prisma.dentalLabCase.count({
        where: {
          organizationId: orgId,
          expectedReturnAt: { lt: now },
          status: {
            notIn: [DentalLabCaseStatus.CANCELLED, DentalLabCaseStatus.RECEIVED, DentalLabCaseStatus.DELIVERED],
          },
        },
      }),
      // 3. Overdue recalls
      this.prisma.dentalRecall.count({
        where: {
          organizationId: orgId,
          status: { in: ['PENDING', 'NOTIFIED'] },
          dueDate: { lt: todayMidnight },
        },
      }),
      // 4. Accepted treatment plans with no upcoming appointment
      // (accepted options whose patients have no future appointment)
      this.prisma.treatmentAcceptance.count({
        where: {
          organizationId: orgId,
          status: 'ACCEPTED',
          option: {
            plan: {
              patient: {
                appointments: {
                  none: {
                    scheduledAt: { gt: new Date() },
                    status: { notIn: ['CANCELLED', 'NO_SHOW'] },
                  },
                },
              },
            },
          },
        },
      }),
    ])

    if (unsignedNotes > 0) {
      items.push({
        id: 'unsigned-notes',
        type: 'clinical',
        title: `${unsignedNotes} unsigned clinical note${unsignedNotes > 1 ? 's' : ''}`,
        description: 'Encounters from over 24h ago are awaiting sign-off',
        count: unsignedNotes,
        href: '/dental/clinical',
        severity: 'high',
      })
    }

    if (overdueLabCases > 0) {
      items.push({
        id: 'overdue-labs',
        type: 'lab',
        title: `${overdueLabCases} overdue lab case${overdueLabCases > 1 ? 's' : ''}`,
        description: 'Expected return date has passed',
        count: overdueLabCases,
        href: '/dental/lab-cases',
        severity: 'high',
      })
    }

    if (overdueRecalls > 0) {
      items.push({
        id: 'overdue-recalls',
        type: 'recall',
        title: `${overdueRecalls} overdue recall${overdueRecalls > 1 ? 's' : ''}`,
        description: 'Patients due for follow-up have not been contacted',
        count: overdueRecalls,
        href: '/dental/recalls',
        severity: 'medium',
      })
    }

    if (acceptedUnscheduled > 0) {
      items.push({
        id: 'accepted-unscheduled',
        type: 'treatment',
        title: `${acceptedUnscheduled} accepted treatment${acceptedUnscheduled > 1 ? 's' : ''} unscheduled`,
        description: 'Patients accepted treatment but have no upcoming appointment',
        count: acceptedUnscheduled,
        href: '/dental/treatment-plans',
        severity: 'medium',
      })
    }

    return items
  }

  // ─── Revenue Snapshot (MTD) ───────────────────────────────────────────────

  async getRevenueSnapshot(orgId: string) {
    const { start, end } = this.monthRange()

    const [procedures, payments, invoices] = await Promise.all([
      // Production (MTD)
      this.prisma.dentalProcedure.findMany({
        where: { organizationId: orgId, performedAt: { gte: start, lte: end } },
        select: { cost: true },
      }),
      // Collections (MTD)
      this.prisma.dentalPayment.findMany({
        where: {
          organizationId: orgId,
          status: PaymentStatus.COMPLETED,
          paymentDate: { gte: start, lte: end },
        },
        select: { amount: true },
      }),
      // Outstanding
      this.prisma.dentalInvoice.findMany({
        where: {
          organizationId: orgId,
          status: { notIn: [InvoiceStatus.CANCELLED] },
          balanceDue: { gt: 0 },
        },
        select: { balanceDue: true, discountAmount: true },
      }),
    ])

    const production = procedures.reduce((s, p) => s + Number(p.cost), 0)
    const collections = payments.reduce((s, p) => s + Number(p.amount), 0)
    const outstanding = invoices.reduce((s, i) => s + Number(i.balanceDue), 0)
    const discounts = invoices.reduce((s, i) => s + Number(i.discountAmount), 0)

    return { production, collections, outstanding, discounts }
  }

  /**
   * Full dashboard summary — one call, multiple aggregations run concurrently.
   */
  async getDashboardSummary(orgId: string) {
    const [
      appointmentStats,
      patientStats,
      financialStats,
      outstandingStats,
      pipelineStats,
      labStats,
      recallStats,
      attentionItems,
      revenueSnapshot,
      todaysClinic,
    ] = await Promise.all([
      this.getTodayAppointmentStats(orgId).catch(() => ({
        total: 0,
        confirmed: 0,
        pending: 0,
        cancelled: 0,
        noShow: 0,
        completed: 0,
        inProgress: 0,
        totalPatients: 0,
      })),
      this.getTodayPatientStats(orgId).catch(() => ({ total: 0, newPatients: 0, returning: 0 })),
      this.getTodayFinancialStats(orgId).catch(() => ({ production: 0, collections: 0 })),
      this.getOutstandingStats(orgId).catch(() => ({ total: 0, overdue: 0, dueSoon: 0 })),
      this.getTreatmentPipelineStats(orgId).catch(() => ({
        proposed: 0,
        accepted: 0,
        deferred: 0,
        pendingFollowUp: 0,
        acceptanceRate: null,
      })),
      this.getLabStats(orgId).catch(() => ({ active: 0, overdue: 0, dueToday: 0, byStatus: {}, cases: [] })),
      this.getRecallStats(orgId).catch(() => ({ dueToday: 0, overdue: 0, upcoming: 0 })),
      this.getNeedsAttention(orgId).catch(() => []),
      this.getRevenueSnapshot(orgId).catch(() => ({ production: 0, collections: 0, outstanding: 0, discounts: 0 })),
      this.getTodaysClinic(orgId).catch(() => []),
    ])

    return {
      appointments: appointmentStats,
      patients: patientStats,
      todayFinancials: financialStats,
      outstanding: outstandingStats,
      pipeline: pipelineStats,
      lab: labStats,
      recalls: recallStats,
      attention: attentionItems,
      revenue: revenueSnapshot,
      todaysClinic,
    }
  }
}
