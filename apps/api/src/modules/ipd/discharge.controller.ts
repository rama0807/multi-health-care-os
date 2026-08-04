import { DischargeChecklistItemKey } from '@medicore/types'
import { Body, Controller, Get, Param, Patch, Post, Put, Res } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { FastifyReply } from 'fastify'

import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { RequirePermissions } from '../../common/decorators/permissions.decorator'

import { DischargeService } from './discharge.service'
import { ApproveDischargeDto } from './dto/approve-discharge.dto'
import { CompleteDischargeDto } from './dto/complete-discharge.dto'
import { UpdateDischargeChecklistItemDto } from './dto/update-discharge-checklist-item.dto'
import { UpsertDischargeSummaryDto } from './dto/upsert-discharge-summary.dto'

@ApiTags('ipd-discharge')
@ApiBearerAuth()
@Controller({ path: 'ipd/admissions/:admissionId/discharge', version: '1' })
export class DischargeController {
  constructor(private readonly dischargeService: DischargeService) {}

  @Post('approve')
  @RequirePermissions('ipd.discharge.create')
  approve(
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Param('admissionId') admissionId: string,
    @Body() dto: ApproveDischargeDto,
  ) {
    return this.dischargeService.approve(orgId, admissionId, dto, userId)
  }

  @Get('checklist')
  @RequirePermissions('ipd.discharge.read')
  listChecklist(@CurrentUser('orgId') orgId: string, @Param('admissionId') admissionId: string) {
    return this.dischargeService.listChecklist(orgId, admissionId)
  }

  @Patch('checklist/:itemKey')
  @RequirePermissions('ipd.discharge.update')
  updateChecklistItem(
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Param('admissionId') admissionId: string,
    @Param('itemKey') itemKey: DischargeChecklistItemKey,
    @Body() dto: UpdateDischargeChecklistItemDto,
  ) {
    return this.dischargeService.updateChecklistItem(orgId, admissionId, itemKey, dto, userId)
  }

  @Get('summary')
  @RequirePermissions('ipd.discharge.read')
  getSummary(@CurrentUser('orgId') orgId: string, @Param('admissionId') admissionId: string) {
    return this.dischargeService.getSummary(orgId, admissionId)
  }

  @Put('summary')
  @RequirePermissions('ipd.discharge.update')
  upsertSummary(
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Param('admissionId') admissionId: string,
    @Body() dto: UpsertDischargeSummaryDto,
  ) {
    return this.dischargeService.upsertSummary(orgId, admissionId, dto, userId)
  }

  @Get('summary/pdf')
  @RequirePermissions('ipd.discharge.read')
  async downloadSummaryPdf(
    @CurrentUser('orgId') orgId: string,
    @Param('admissionId') admissionId: string,
    @Res() reply: FastifyReply,
  ) {
    const { buffer, fileName } = await this.dischargeService.generateSummaryPdf(orgId, admissionId)
    void reply
      .header('Content-Type', 'application/pdf')
      .header('Content-Disposition', `attachment; filename="${fileName}"`)
      .send(buffer)
  }

  @Post('complete')
  @RequirePermissions('ipd.discharge.manage')
  complete(
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Param('admissionId') admissionId: string,
    @Body() dto: CompleteDischargeDto,
  ) {
    return this.dischargeService.complete(orgId, admissionId, dto, userId)
  }
}
