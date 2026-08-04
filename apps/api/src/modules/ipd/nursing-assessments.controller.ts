import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'

import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { RequirePermissions } from '../../common/decorators/permissions.decorator'

import { CreateNursingAssessmentDto } from './dto/create-nursing-assessment.dto'
import { NursingAssessmentsService } from './nursing-assessments.service'

@ApiTags('ipd-nursing')
@ApiBearerAuth()
@Controller({ path: 'ipd/admissions/:admissionId/nursing-assessments', version: '1' })
export class NursingAssessmentsController {
  constructor(private readonly nursingAssessmentsService: NursingAssessmentsService) {}

  @Get()
  @RequirePermissions('ipd.nursing.read')
  list(
    @CurrentUser('orgId') orgId: string,
    @Param('admissionId') admissionId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.nursingAssessmentsService.list(orgId, admissionId, {
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
    @Body() dto: CreateNursingAssessmentDto,
  ) {
    return this.nursingAssessmentsService.create(orgId, admissionId, dto, userId)
  }
}
