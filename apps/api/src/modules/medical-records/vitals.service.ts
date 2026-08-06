import { RecordVitalDto, Vital } from '@medicore/types'
import { Injectable } from '@nestjs/common'
import { Vital as PrismaVital } from '@prisma/client'

import { PrismaService } from '../../prisma/prisma.service'

import { EncountersService } from './encounters.service'

@Injectable()
export class VitalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encountersService: EncountersService,
  ) {}

  async listForEncounter(organizationId: string, encounterId: string): Promise<Vital[]> {
    await this.encountersService.requireEncounter(organizationId, encounterId)
    const vitals = await this.prisma.vital.findMany({ where: { encounterId }, orderBy: { recordedAt: 'asc' } })
    return vitals.map((v) => this.toResponse(v))
  }

  /**
   * Powers the patient-level vitals trend chart (across every encounter,
   * not just one) - the frontend's "Vitals: Charts, History, Comparison"
   * deliverable needs the full longitudinal series, not a single visit's.
   */
  async listForPatient(organizationId: string, patientId: string): Promise<Vital[]> {
    const vitals = await this.prisma.vital.findMany({
      where: { encounter: { patientId, organizationId } },
      orderBy: { recordedAt: 'asc' },
    })
    return vitals.map((v) => this.toResponse(v))
  }

  async record(
    organizationId: string,
    encounterId: string,
    dto: RecordVitalDto,
    actorUserId: string,
  ): Promise<Vital> {
    await this.encountersService.requireEncounter(organizationId, encounterId)

    const bmi =
      dto.heightCm && dto.weightKg
        ? Math.round((dto.weightKg / (dto.heightCm / 100) ** 2) * 10) / 10
        : undefined

    const vital = await this.prisma.vital.create({
      data: {
        encounterId,
        heightCm: dto.heightCm,
        weightKg: dto.weightKg,
        bmi,
        bloodPressureSystolic: dto.bloodPressureSystolic,
        bloodPressureDiastolic: dto.bloodPressureDiastolic,
        pulse: dto.pulse,
        temperatureCelsius: dto.temperatureCelsius,
        respiratoryRate: dto.respiratoryRate,
        spo2: dto.spo2,
        recordedByUserId: actorUserId,
      },
    })

    return this.toResponse(vital)
  }

  private toResponse(vital: PrismaVital): Vital {
    return {
      id: vital.id,
      encounterId: vital.encounterId,
      heightCm: vital.heightCm,
      weightKg: vital.weightKg,
      bmi: vital.bmi,
      bloodPressureSystolic: vital.bloodPressureSystolic,
      bloodPressureDiastolic: vital.bloodPressureDiastolic,
      pulse: vital.pulse,
      temperatureCelsius: vital.temperatureCelsius,
      respiratoryRate: vital.respiratoryRate,
      spo2: vital.spo2,
      recordedByUserId: vital.recordedByUserId,
      recordedAt: vital.recordedAt,
    }
  }
}
