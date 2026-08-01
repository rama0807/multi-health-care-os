import { JwtPayload } from '@medicore/types'
import { BadRequestException, Body, Controller, Get, Param, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'

import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { RequirePermissions } from '../../common/decorators/permissions.decorator'

import { RecordVitalDto } from './dto/record-vital.dto'
import { EncountersService } from './encounters.service'
import { VitalsService } from './vitals.service'

@ApiTags('vitals')
@ApiBearerAuth()
@Controller({ path: 'encounters/:encounterId/vitals', version: '1' })
export class EncounterVitalsController {
  constructor(
    private readonly vitalsService: VitalsService,
    private readonly encountersService: EncountersService,
  ) {}

  @Get()
  @RequirePermissions('medical_records.read')
  async list(
    @CurrentUser() user: JwtPayload,
    @CurrentUser('orgId') orgId: string,
    @Param('encounterId') encounterId: string,
  ) {
    await this.encountersService.assertOwnScopeOk(orgId, encounterId, user, 'read')
    const vitals = await this.vitalsService.listForEncounter(orgId, encounterId)
    return { vitals }
  }

  @Post()
  @RequirePermissions('medical_records.update')
  async record(
    @CurrentUser() user: JwtPayload,
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Param('encounterId') encounterId: string,
    @Body() dto: RecordVitalDto,
  ) {
    await this.encountersService.assertOwnScopeOk(orgId, encounterId, user, 'update')
    return this.vitalsService.record(orgId, encounterId, dto, userId)
  }
}

/**
 * Separate from `EncounterVitalsController` because this one isn't scoped
 * to a single encounter — it's the full cross-encounter trend for a
 * patient, which the frontend's vitals charts/comparison view needs.
 */
@ApiTags('vitals')
@ApiBearerAuth()
@Controller({ path: 'vitals', version: '1' })
export class PatientVitalsController {
  constructor(private readonly vitalsService: VitalsService) {}

  @Get()
  @RequirePermissions('medical_records.read')
  async listForPatient(@CurrentUser('orgId') orgId: string, @Query('patientId') patientId?: string) {
    if (!patientId) throw new BadRequestException('Query param "patientId" is required')
    const vitals = await this.vitalsService.listForPatient(orgId, patientId)
    return { vitals }
  }
}
