import { DoctorReport, DoctorWorkloadRow, ReportFilterQuery } from '@medicore/types'
import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'

import { PrismaService } from '../../prisma/prisma.service'

import { countSeries, percentOf, resolveRange, toPeriod } from './report-range.util'

/**
 * Doctor workload reporting (Checkpoint 17.1).
 *
 * OPD vs IPD load is split on `EncounterType.IPD` for the outpatient side and
 * on `Admission.attendingDoctorId` for the inpatient side — an admission is
 * the real unit of IPD work, and counting its auto-created IPD encounter
 * instead would just re-count the same stay through a different table.
 */
@Injectable()
export class DoctorReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getReport(organizationId: string, query: ReportFilterQuery = {}): Promise<DoctorReport> {
    const range = resolveRange(query)
    const window = { gte: range.from, lt: range.to }

    const doctorScope: Prisma.DoctorWhereInput = {
      organizationId,
      ...(query.doctorId ? { id: query.doctorId } : {}),
      ...(query.departmentId ? { departmentId: query.departmentId } : {}),
      ...(query.hospitalId ? { hospitalId: query.hospitalId } : {}),
    }

    const doctors = await this.prisma.doctor.findMany({
      where: doctorScope,
      select: {
        id: true,
        specialization: true,
        department: { select: { name: true } },
        user: { select: { firstName: true, lastName: true } },
      },
    })
    if (doctors.length === 0) {
      return {
        period: toPeriod(range),
        totalOpdLoad: 0,
        totalIpdLoad: 0,
        totalConsultations: 0,
        followUpRatioPercent: 0,
        doctors: [],
        consultationTrend: [],
      }
    }

    const doctorIds = doctors.map((d) => d.id)
    const [encounters, admissionGroups, labGroups, radiologyGroups, prescriptionGroups] = await Promise.all([
      this.prisma.encounter.findMany({
        where: { organizationId, doctorId: { in: doctorIds }, encounterDate: window },
        select: { doctorId: true, type: true, encounterDate: true },
      }),
      this.prisma.admission.groupBy({
        by: ['attendingDoctorId'],
        where: { organizationId, attendingDoctorId: { in: doctorIds }, admittedAt: window },
        _count: true,
      }),
      this.prisma.labTest.groupBy({
        by: ['doctorId'],
        where: { organizationId, doctorId: { in: doctorIds }, createdAt: window },
        _count: true,
      }),
      this.prisma.radiologyOrder.groupBy({
        by: ['doctorId'],
        where: { organizationId, doctorId: { in: doctorIds }, createdAt: window },
        _count: true,
      }),
      this.prisma.prescription.groupBy({
        by: ['doctorId'],
        where: { organizationId, doctorId: { in: doctorIds }, createdAt: window },
        _count: true,
      }),
    ])

    const admissionCount = (id: string) =>
      admissionGroups.find((g) => g.attendingDoctorId === id)?._count ?? 0
    const labCount = (id: string) => labGroups.find((g) => g.doctorId === id)?._count ?? 0
    const radiologyCount = (id: string) => radiologyGroups.find((g) => g.doctorId === id)?._count ?? 0
    const prescriptionCount = (id: string) => prescriptionGroups.find((g) => g.doctorId === id)?._count ?? 0

    const rows: DoctorWorkloadRow[] = doctors
      .map((doctor) => {
        const own = encounters.filter((e) => e.doctorId === doctor.id)
        const followUps = own.filter((e) => e.type === 'FOLLOW_UP').length
        const consultations = own.length

        return {
          doctorId: doctor.id,
          doctorName: `${doctor.user.firstName} ${doctor.user.lastName}`,
          specialization: doctor.specialization,
          departmentName: doctor.department?.name ?? null,
          opdLoad: own.filter((e) => e.type !== 'IPD').length,
          ipdLoad: admissionCount(doctor.id),
          consultations,
          followUps,
          followUpRatioPercent: percentOf(followUps, consultations),
          labOrders: labCount(doctor.id),
          radiologyOrders: radiologyCount(doctor.id),
          prescriptions: prescriptionCount(doctor.id),
        }
      })
      // Doctors with no activity in the window are dropped rather than shown
      // as a wall of zero rows — the report is about workload, not headcount
      // (department strength lives in the staff report).
      .filter((row) => row.consultations > 0 || row.ipdLoad > 0)
      .sort((a, b) => b.consultations + b.ipdLoad - (a.consultations + a.ipdLoad))

    const totalConsultations = rows.reduce((total, r) => total + r.consultations, 0)
    const totalFollowUps = rows.reduce((total, r) => total + r.followUps, 0)

    return {
      period: toPeriod(range),
      totalOpdLoad: rows.reduce((total, r) => total + r.opdLoad, 0),
      totalIpdLoad: rows.reduce((total, r) => total + r.ipdLoad, 0),
      totalConsultations,
      followUpRatioPercent: percentOf(totalFollowUps, totalConsultations),
      doctors: rows,
      consultationTrend: countSeries(encounters, range, (e) => e.encounterDate),
    }
  }
}
