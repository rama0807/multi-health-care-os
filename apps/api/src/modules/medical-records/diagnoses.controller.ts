import { JwtPayload } from '@medicore/types'
import { Body, Controller, Get, Param, Post } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'

import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { RequirePermissions } from '../../common/decorators/permissions.decorator'

import { DiagnosesService } from './diagnoses.service'
import { CreateDiagnosisDto } from './dto/create-diagnosis.dto'
import { EncountersService } from './encounters.service'

@ApiTags('diagnoses')
@ApiBearerAuth()
@Controller({ path: 'encounters/:encounterId/diagnoses', version: '1' })
export class DiagnosesController {
  constructor(
    private readonly diagnosesService: DiagnosesService,
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
    const diagnoses = await this.diagnosesService.list(orgId, encounterId)
    return { diagnoses }
  }

  @Post()
  @RequirePermissions('medical_records.update')
  async create(
    @CurrentUser() user: JwtPayload,
    @CurrentUser('orgId') orgId: string,
    @Param('encounterId') encounterId: string,
    @Body() dto: CreateDiagnosisDto,
  ) {
    await this.encountersService.assertOwnScopeOk(orgId, encounterId, user, 'update')
    return this.diagnosesService.create(orgId, encounterId, dto)
  }
}
