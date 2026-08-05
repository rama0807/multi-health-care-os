import { OrganizationStatus, SubscriptionTier } from '@medicore/types'
import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'

import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { RequirePermissions } from '../../common/decorators/permissions.decorator'
import { PlatformGuard } from '../../common/tenant/platform.guard'
import { AuditService } from '../audit/audit.service'
import { UpsertSubscriptionDto } from '../organizations/dto/organization-settings.dto'
import { OrganizationUsageService } from '../organizations/organization-usage.service'
import { SubscriptionsService } from '../organizations/subscriptions.service'

import { SuspendOrganizationDto } from './dto/suspend-organization.dto'
import { PlatformOrganizationsService } from './platform-organizations.service'
import { PlatformStatsService } from './platform-stats.service'

/**
 * Platform Owner console (Checkpoint 16.2) — the internal Super Admin surface.
 *
 * Isolation is enforced twice, and at the controller level so no route can
 * forget it: `PlatformGuard` requires the caller's organization to be the
 * platform tenant, and every handler additionally requires a `platform.*`
 * permission that no customer role is seeded with. Organization-scoped
 * controllers live under different paths and share no route prefix with this
 * one.
 */
@ApiTags('platform')
@ApiBearerAuth()
@UseGuards(PlatformGuard)
@Controller({ path: 'platform', version: '1' })
export class PlatformController {
  constructor(
    private readonly organizationsService: PlatformOrganizationsService,
    private readonly statsService: PlatformStatsService,
    private readonly subscriptionsService: SubscriptionsService,
    private readonly usageService: OrganizationUsageService,
    private readonly auditService: AuditService,
  ) {}

  // ── Overview & analytics ───────────────────────────────────────────────

  @Get('stats')
  @RequirePermissions('platform.read')
  getStats() {
    return this.statsService.getStats()
  }

  @Get('analytics')
  @RequirePermissions('platform.analytics.read')
  getAnalytics() {
    return this.statsService.getAnalytics()
  }

  @Get('search')
  @RequirePermissions('platform.read')
  search(@Query('q') q?: string, @Query('limit') limit?: string) {
    return this.statsService.search(q ?? '', limit ? Number(limit) : undefined)
  }

  // ── Tenants ────────────────────────────────────────────────────────────

  @Get('organizations')
  @RequirePermissions('platform.read')
  listOrganizations(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: OrganizationStatus,
    @Query('plan') plan?: SubscriptionTier,
    @Query('includePlatform') includePlatform?: string,
  ) {
    return this.organizationsService.list({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      search,
      status,
      plan,
      includePlatform: includePlatform === 'true',
    })
  }

  @Get('organizations/:organizationId')
  @RequirePermissions('platform.read')
  getOrganization(@Param('organizationId') organizationId: string) {
    return this.organizationsService.getById(organizationId)
  }

  @Get('organizations/:organizationId/usage')
  @RequirePermissions('platform.read')
  getOrganizationUsage(@Param('organizationId') organizationId: string) {
    return this.usageService.getUsage(organizationId)
  }

  @Post('organizations/:organizationId/suspend')
  @RequirePermissions('platform.tenants.manage')
  suspend(
    @CurrentUser('sub') userId: string,
    @Param('organizationId') organizationId: string,
    @Body() dto: SuspendOrganizationDto,
  ) {
    return this.organizationsService.suspend(organizationId, dto.reason, userId)
  }

  @Post('organizations/:organizationId/reinstate')
  @RequirePermissions('platform.tenants.manage')
  reinstate(@CurrentUser('sub') userId: string, @Param('organizationId') organizationId: string) {
    return this.organizationsService.reinstate(organizationId, userId)
  }

  @Post('organizations/:organizationId/enable')
  @RequirePermissions('platform.tenants.manage')
  enable(@CurrentUser('sub') userId: string, @Param('organizationId') organizationId: string) {
    return this.organizationsService.setEnabled(organizationId, true, userId)
  }

  @Post('organizations/:organizationId/disable')
  @RequirePermissions('platform.tenants.manage')
  disable(@CurrentUser('sub') userId: string, @Param('organizationId') organizationId: string) {
    return this.organizationsService.setEnabled(organizationId, false, userId)
  }

  // ── Subscriptions (write side — tenants get read-only access) ──────────

  @Get('organizations/:organizationId/subscription')
  @RequirePermissions('platform.subscriptions.read')
  getSubscription(@Param('organizationId') organizationId: string) {
    return this.subscriptionsService.getSummary(organizationId)
  }

  @Put('organizations/:organizationId/subscription')
  @RequirePermissions('platform.subscriptions.manage')
  upsertSubscription(
    @CurrentUser('sub') userId: string,
    @Param('organizationId') organizationId: string,
    @Body() dto: UpsertSubscriptionDto,
  ) {
    return this.subscriptionsService.upsert(organizationId, dto, userId)
  }

  // ── Hospitals across every tenant ──────────────────────────────────────

  @Get('hospitals')
  @RequirePermissions('platform.read')
  listHospitals(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.organizationsService.listHospitals({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      search,
      organizationId,
    })
  }

  // ── Global audit log ───────────────────────────────────────────────────

  @Get('audit-logs')
  @RequirePermissions('platform.audit.read')
  listAuditLogs(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('organizationId') organizationId?: string,
    @Query('userId') userId?: string,
    @Query('action') action?: string,
    @Query('resource') resource?: string,
    @Query('search') search?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.auditService.listGlobal({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      organizationId,
      userId,
      action,
      resource,
      search,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    })
  }
}
