import { JwtPayload } from '@medicore/types'
import { Body, Controller, Get, Param, Post } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'

import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { RequirePermissions } from '../../common/decorators/permissions.decorator'

import { ClinicalNotesService } from './clinical-notes.service'
import { CreateClinicalNoteDto } from './dto/create-clinical-note.dto'
import { EncountersService } from './encounters.service'

@ApiTags('clinical-notes')
@ApiBearerAuth()
@Controller({ path: 'encounters/:encounterId/clinical-notes', version: '1' })
export class ClinicalNotesController {
  constructor(
    private readonly clinicalNotesService: ClinicalNotesService,
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
    const notes = await this.clinicalNotesService.list(orgId, encounterId)
    return { notes }
  }

  @Get('current')
  @RequirePermissions('medical_records.read')
  async getCurrent(
    @CurrentUser() user: JwtPayload,
    @CurrentUser('orgId') orgId: string,
    @Param('encounterId') encounterId: string,
  ) {
    await this.encountersService.assertOwnScopeOk(orgId, encounterId, user, 'read')
    return this.clinicalNotesService.getCurrent(orgId, encounterId)
  }

  @Post()
  @RequirePermissions('medical_records.update')
  async createVersion(
    @CurrentUser() user: JwtPayload,
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Param('encounterId') encounterId: string,
    @Body() dto: CreateClinicalNoteDto,
  ) {
    await this.encountersService.assertOwnScopeOk(orgId, encounterId, user, 'update')
    return this.clinicalNotesService.createVersion(orgId, encounterId, dto, userId)
  }
}
