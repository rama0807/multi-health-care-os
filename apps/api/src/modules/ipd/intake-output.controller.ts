import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'

import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { RequirePermissions } from '../../common/decorators/permissions.decorator'

import { CreateIntakeOutputDto } from './dto/create-intake-output.dto'
import { IntakeOutputService } from './intake-output.service'

@ApiTags('ipd-nursing')
@ApiBearerAuth()
@Controller({ path: 'ipd/admissions/:admissionId/intake-output', version: '1' })
export class IntakeOutputController {
  constructor(private readonly intakeOutputService: IntakeOutputService) {}

  @Get()
  @RequirePermissions('ipd.nursing.read')
  list(
    @CurrentUser('orgId') orgId: string,
    @Param('admissionId') admissionId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.intakeOutputService.list(orgId, admissionId, {
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
    @Body() dto: CreateIntakeOutputDto,
  ) {
    return this.intakeOutputService.create(orgId, admissionId, dto, userId)
  }
}
