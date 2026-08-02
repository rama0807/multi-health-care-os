import { ChargeStatus } from '@medicore/types'
import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'

import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { RequirePermissions } from '../../common/decorators/permissions.decorator'

import { ChargesService } from './charges.service'
import { CreateChargeDto } from './dto/create-charge.dto'

/**
 * The reusable Charge Engine — see ADR-0015. `billing.*` stays all-scope
 * (staff-facing), so no own-scope check is needed on these routes.
 */
@ApiTags('billing-charges')
@ApiBearerAuth()
@Controller({ path: 'billing/charges', version: '1' })
export class ChargesController {
  constructor(private readonly chargesService: ChargesService) {}

  @Get()
  @RequirePermissions('billing.read')
  list(
    @CurrentUser('orgId') orgId: string,
    @Query('patientId') patientId?: string,
    @Query('encounterId') encounterId?: string,
    @Query('appointmentId') appointmentId?: string,
    @Query('status') status?: ChargeStatus,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.chargesService.list(orgId, {
      patientId,
      encounterId,
      appointmentId,
      status,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    })
  }

  @Get(':id')
  @RequirePermissions('billing.read')
  getById(@CurrentUser('orgId') orgId: string, @Param('id') id: string) {
    return this.chargesService.getById(orgId, id)
  }

  @Post()
  @RequirePermissions('billing.create')
  create(@CurrentUser('orgId') orgId: string, @CurrentUser('sub') userId: string, @Body() dto: CreateChargeDto) {
    return this.chargesService.create(orgId, dto, userId)
  }

  @Post(':id/void')
  @RequirePermissions('billing.update')
  void(@CurrentUser('orgId') orgId: string, @CurrentUser('sub') userId: string, @Param('id') id: string) {
    return this.chargesService.void(orgId, id, userId)
  }
}
