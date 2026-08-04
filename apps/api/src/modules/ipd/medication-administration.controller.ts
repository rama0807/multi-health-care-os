import { MedicationAdministrationStatus, MedicationAdministrationType } from '@medicore/types'
import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'

import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { RequirePermissions } from '../../common/decorators/permissions.decorator'

import { AdministerDoseDto } from './dto/administer-dose.dto'
import { CreateAdHocDoseDto } from './dto/create-ad-hoc-dose.dto'
import { GenerateScheduledDosesDto } from './dto/generate-scheduled-doses.dto'
import { RecordDoseExceptionDto } from './dto/record-dose-exception.dto'
import { MedicationAdministrationService } from './medication-administration.service'

@ApiTags('ipd-mar')
@ApiBearerAuth()
@Controller({ path: 'ipd/admissions/:admissionId/mar', version: '1' })
export class MedicationAdministrationController {
  constructor(private readonly marService: MedicationAdministrationService) {}

  @Get()
  @RequirePermissions('ipd.mar.read')
  list(
    @CurrentUser('orgId') orgId: string,
    @Param('admissionId') admissionId: string,
    @Query('prescriptionItemId') prescriptionItemId?: string,
    @Query('type') type?: MedicationAdministrationType,
    @Query('status') status?: MedicationAdministrationStatus,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.marService.list(orgId, admissionId, {
      prescriptionItemId,
      type,
      status,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    })
  }

  @Post('generate-scheduled')
  @RequirePermissions('ipd.mar.create')
  generateScheduled(
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Param('admissionId') admissionId: string,
    @Body() dto: GenerateScheduledDosesDto,
  ) {
    return this.marService.generateScheduled(orgId, admissionId, dto, userId)
  }

  @Post('ad-hoc')
  @RequirePermissions('ipd.mar.create')
  createAdHoc(
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Param('admissionId') admissionId: string,
    @Body() dto: CreateAdHocDoseDto,
  ) {
    return this.marService.createAdHoc(orgId, admissionId, dto, userId)
  }

  @Patch(':doseId/administer')
  @RequirePermissions('ipd.mar.update')
  administer(
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Param('admissionId') admissionId: string,
    @Param('doseId') doseId: string,
    @Body() dto: AdministerDoseDto,
  ) {
    return this.marService.administer(orgId, admissionId, doseId, dto, userId)
  }

  @Patch(':doseId/missed')
  @RequirePermissions('ipd.mar.update')
  missed(
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Param('admissionId') admissionId: string,
    @Param('doseId') doseId: string,
    @Body() dto: RecordDoseExceptionDto,
  ) {
    return this.marService.recordException(orgId, admissionId, doseId, MedicationAdministrationStatus.MISSED, dto, userId)
  }

  @Patch(':doseId/refused')
  @RequirePermissions('ipd.mar.update')
  refused(
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Param('admissionId') admissionId: string,
    @Param('doseId') doseId: string,
    @Body() dto: RecordDoseExceptionDto,
  ) {
    return this.marService.recordException(orgId, admissionId, doseId, MedicationAdministrationStatus.REFUSED, dto, userId)
  }

  @Patch(':doseId/held')
  @RequirePermissions('ipd.mar.update')
  held(
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Param('admissionId') admissionId: string,
    @Param('doseId') doseId: string,
    @Body() dto: RecordDoseExceptionDto,
  ) {
    return this.marService.recordException(orgId, admissionId, doseId, MedicationAdministrationStatus.HELD, dto, userId)
  }

  @Patch(':doseId/delayed')
  @RequirePermissions('ipd.mar.update')
  delayed(
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Param('admissionId') admissionId: string,
    @Param('doseId') doseId: string,
    @Body() dto: RecordDoseExceptionDto,
  ) {
    return this.marService.recordException(orgId, admissionId, doseId, MedicationAdministrationStatus.DELAYED, dto, userId)
  }
}
