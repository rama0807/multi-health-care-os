import { JwtPayload, RefundStatus } from '@medicore/types'
import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'

import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { RequirePermissions } from '../../common/decorators/permissions.decorator'
import { PermissionsService } from '../../common/permissions/permissions.service'

import { CreateRefundDto } from './dto/create-refund.dto'
import { RejectRefundDto } from './dto/reject-refund.dto'
import { RefundsService } from './refunds.service'

/** Refunds - see ADR-0015. `billing.*` stays all-scope (staff-facing). */
@ApiTags('billing-refunds')
@ApiBearerAuth()
@Controller({ path: 'billing', version: '1' })
export class RefundsController {
  constructor(
    private readonly refundsService: RefundsService,
    private readonly permissionsService: PermissionsService,
  ) {}

  @Get('refunds')
  @RequirePermissions('billing.read')
  list(
    @CurrentUser('orgId') orgId: string,
    @Query('invoiceId') invoiceId?: string,
    @Query('status') status?: RefundStatus,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.refundsService.list(orgId, {
      invoiceId,
      status,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    })
  }

  @Get('refunds/:id')
  @RequirePermissions('billing.read')
  getById(@CurrentUser('orgId') orgId: string, @Param('id') id: string) {
    return this.refundsService.getById(orgId, id)
  }

  @Post('invoices/:invoiceId/refunds')
  @RequirePermissions('billing.create')
  request(
    @CurrentUser() user: JwtPayload,
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Param('invoiceId') invoiceId: string,
    @Body() dto: CreateRefundDto,
  ) {
    const canManage = this.permissionsService.has(user, 'billing', 'manage')
    return this.refundsService.request(orgId, invoiceId, dto, userId, canManage)
  }

  @Post('refunds/:id/approve')
  @RequirePermissions('billing.manage')
  approve(@CurrentUser('orgId') orgId: string, @CurrentUser('sub') userId: string, @Param('id') id: string) {
    return this.refundsService.approve(orgId, id, userId)
  }

  @Post('refunds/:id/reject')
  @RequirePermissions('billing.manage')
  reject(
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: RejectRefundDto,
  ) {
    return this.refundsService.reject(orgId, id, dto, userId)
  }
}
