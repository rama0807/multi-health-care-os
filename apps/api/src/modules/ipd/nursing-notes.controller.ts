import { NursingNoteType } from '@medicore/types'
import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'

import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { RequirePermissions } from '../../common/decorators/permissions.decorator'

import { CreateNursingNoteDto } from './dto/create-nursing-note.dto'
import { NursingNotesService } from './nursing-notes.service'

@ApiTags('ipd-nursing')
@ApiBearerAuth()
@Controller({ path: 'ipd/admissions/:admissionId/nursing-notes', version: '1' })
export class NursingNotesController {
  constructor(private readonly nursingNotesService: NursingNotesService) {}

  @Get()
  @RequirePermissions('ipd.nursing.read')
  list(
    @CurrentUser('orgId') orgId: string,
    @Param('admissionId') admissionId: string,
    @Query('type') type?: NursingNoteType,
    @Query('isEscalated') isEscalated?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.nursingNotesService.list(orgId, admissionId, {
      type,
      isEscalated: isEscalated === undefined ? undefined : isEscalated === 'true',
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    })
  }

  @Post()
  @RequirePermissions('ipd.nursing.create')
  create(
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Param('admissionId') admissionId: string,
    @Body() dto: CreateNursingNoteDto,
  ) {
    return this.nursingNotesService.create(orgId, admissionId, dto, userId)
  }
}
