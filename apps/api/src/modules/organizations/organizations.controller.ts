import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common'
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger'
import { FastifyRequest } from 'fastify'

import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { RequirePermissions } from '../../common/decorators/permissions.decorator'
import { AuditService } from '../audit/audit.service'

import {
  UpdateOrganizationBrandingDto,
  UpdateOrganizationSettingsDto,
} from './dto/organization-settings.dto'
import { UpdateOrganizationDto } from './dto/update-organization.dto'
import { OrganizationUsageService } from './organization-usage.service'
import { OrganizationsService } from './organizations.service'
import { SubscriptionsService } from './subscriptions.service'

/**
 * The Organization Dashboard's API surface (Checkpoint 16.1 / 16.4).
 *
 * Every route is scoped to the caller's own organization via
 * `@CurrentUser('orgId')` — no route here accepts an organization id, so an
 * organization admin structurally cannot read or write another tenant's data.
 * Cross-tenant reads live in the separate `/platform` module.
 */
@ApiTags('organizations')
@ApiBearerAuth()
@Controller({ path: 'organizations', version: '1' })
export class OrganizationsController {
  constructor(
    private readonly organizationsService: OrganizationsService,
    private readonly usageService: OrganizationUsageService,
    private readonly subscriptionsService: SubscriptionsService,
    private readonly auditService: AuditService,
  ) {}

  @Get('me')
  @RequirePermissions('organizations.read')
  getCurrent(@CurrentUser('orgId') orgId: string) {
    return this.organizationsService.getCurrent(orgId)
  }

  @Patch('me')
  @RequirePermissions('organizations.update')
  updateCurrent(
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Body() dto: UpdateOrganizationDto,
  ) {
    return this.organizationsService.updateCurrent(orgId, dto, userId)
  }

  @Get('me/stats')
  @RequirePermissions('organizations.read')
  getStats(@CurrentUser('orgId') orgId: string) {
    return this.organizationsService.getStats(orgId)
  }

  @Get('me/usage')
  @RequirePermissions('organizations.read')
  getUsage(@CurrentUser('orgId') orgId: string) {
    return this.usageService.getUsage(orgId)
  }

  @Get('me/admins')
  @RequirePermissions('organizations.read')
  listAdmins(@CurrentUser('orgId') orgId: string) {
    return this.organizationsService.listAdmins(orgId)
  }

  // ── Settings (Checkpoint 16.4) ─────────────────────────────────────────

  @Get('me/settings')
  @RequirePermissions('organizations.read')
  getSettings(@CurrentUser('orgId') orgId: string) {
    return this.organizationsService.getSettings(orgId)
  }

  @Patch('me/settings')
  @RequirePermissions('organizations.update')
  updateSettings(
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Body() dto: UpdateOrganizationSettingsDto,
  ) {
    return this.organizationsService.updateSettings(orgId, dto, userId)
  }

  // ── Branding (Checkpoint 16.1 / 16.4) ──────────────────────────────────

  @Get('me/branding')
  @RequirePermissions('organizations.read')
  getBranding(@CurrentUser('orgId') orgId: string) {
    return this.organizationsService.getBranding(orgId)
  }

  @Patch('me/branding')
  @RequirePermissions('organizations.update')
  updateBranding(
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Body() dto: UpdateOrganizationBrandingDto,
  ) {
    return this.organizationsService.updateBranding(orgId, dto, userId)
  }

  @Post('me/branding/logo')
  @ApiConsumes('multipart/form-data')
  @RequirePermissions('organizations.update')
  async uploadLogo(
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Req() request: FastifyRequest,
  ) {
    const data = await request.file()
    if (!data) throw new BadRequestException('No file uploaded — send multipart/form-data')

    const buffer = await data.toBuffer()
    return this.organizationsService.uploadLogo(
      orgId,
      { buffer, fileName: data.filename, mimeType: data.mimetype, size: buffer.length },
      userId,
    )
  }

  @Delete('me/branding/logo')
  @RequirePermissions('organizations.update')
  async removeLogo(@CurrentUser('orgId') orgId: string, @CurrentUser('sub') userId: string) {
    await this.organizationsService.removeLogo(orgId, userId)
    return { success: true }
  }

  // ── Subscription (read-only for a tenant — see SubscriptionsService) ────

  @Get('me/subscription')
  @RequirePermissions('organizations.read')
  getSubscription(@CurrentUser('orgId') orgId: string) {
    return this.subscriptionsService.getSummary(orgId)
  }

  // ── Organization-level audit log (Checkpoint 16.1) ─────────────────────

  @Get('me/audit-logs')
  @RequirePermissions('audit.read')
  listAuditLogs(
    @CurrentUser('orgId') orgId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('userId') userId?: string,
    @Query('action') action?: string,
    @Query('resource') resource?: string,
    @Query('search') search?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.auditService.list(orgId, {
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      userId,
      action,
      resource,
      search,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    })
  }

  @Get('me/audit-logs/filters')
  @RequirePermissions('audit.read')
  listAuditFilterOptions(@CurrentUser('orgId') orgId: string) {
    return this.auditService.listFilterOptions(orgId)
  }
}
