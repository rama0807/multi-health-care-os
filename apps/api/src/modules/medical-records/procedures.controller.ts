import { JwtPayload } from '@medicore/types'
import { Body, Controller, Get, Param, Post } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'

import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { RequirePermissions } from '../../common/decorators/permissions.decorator'

import { CreateProcedureDto } from './dto/create-procedure.dto'
import { EncountersService } from './encounters.service'
import { ProceduresService } from './procedures.service'

@ApiTags('procedures')
@ApiBearerAuth()
@Controller({ path: 'encounters/:encounterId/procedures', version: '1' })
export class ProceduresController {
  constructor(
    private readonly proceduresService: ProceduresService,
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
    const procedures = await this.proceduresService.list(orgId, encounterId)
    return { procedures }
  }

  @Post()
  @RequirePermissions('medical_records.update')
  async create(
    @CurrentUser() user: JwtPayload,
    @CurrentUser('orgId') orgId: string,
    @Param('encounterId') encounterId: string,
    @Body() dto: CreateProcedureDto,
  ) {
    await this.encountersService.assertOwnScopeOk(orgId, encounterId, user, 'update')
    return this.proceduresService.create(orgId, encounterId, dto)
  }
}
