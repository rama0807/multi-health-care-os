import { JwtPayload, LeaveStatus, LeaveType } from '@medicore/types'
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'

import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { RequirePermissions } from '../../common/decorators/permissions.decorator'
import { PermissionsService } from '../../common/permissions/permissions.service'

import { ApplyStaffLeaveDto, DecideStaffLeaveDto, UpsertHolidayDto, UpsertLeaveTypeConfigDto } from './dto/leave.dto'
import { HolidaysService } from './holidays.service'
import { LeaveTypesService } from './leave-types.service'
import { StaffLeaveService } from './staff-leave.service'
import { StaffRefService } from './staff-ref.service'

@ApiTags('leave')
@ApiBearerAuth()
@Controller({ path: 'leave', version: '1' })
export class LeaveController {
  constructor(
    private readonly staffLeaveService: StaffLeaveService,
    private readonly leaveTypesService: LeaveTypesService,
    private readonly holidaysService: HolidaysService,
    private readonly staffRef: StaffRefService,
    private readonly permissionsService: PermissionsService,
  ) {}

  @Get()
  @RequirePermissions('leave.read')
  async list(
    @CurrentUser() user: JwtPayload,
    @CurrentUser('orgId') orgId: string,
    @Query('staffId') staffId?: string,
    @Query('status') status?: LeaveStatus,
    @Query('leaveType') leaveType?: LeaveType,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const effectiveStaffId = await this.resolveOwnScopedStaffId(orgId, user, 'read', staffId)

    return this.staffLeaveService.list(orgId, {
      staffId: effectiveStaffId,
      status,
      leaveType,
      from,
      to,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    })
  }

  @Get('balance')
  @RequirePermissions('leave.read')
  async balance(
    @CurrentUser() user: JwtPayload,
    @CurrentUser('orgId') orgId: string,
    @Query('staffId') staffId?: string,
    @Query('year') year?: string,
  ) {
    const effectiveStaffId = await this.resolveOwnScopedStaffId(orgId, user, 'read', staffId)
    if (!effectiveStaffId) throw new BadRequestException('"staffId" query param is required')

    const entries = await this.staffLeaveService.getBalance(
      orgId,
      effectiveStaffId,
      year ? Number(year) : new Date().getFullYear(),
    )
    return { entries }
  }

  @Get('types')
  @RequirePermissions('leave.read')
  async types(@CurrentUser('orgId') orgId: string) {
    const types = await this.leaveTypesService.list(orgId)
    return { types }
  }

  @Put('types')
  @RequirePermissions('leave.manage')
  upsertType(@CurrentUser('orgId') orgId: string, @Body() dto: UpsertLeaveTypeConfigDto) {
    return this.leaveTypesService.upsert(orgId, dto)
  }

  @Get('holidays')
  @RequirePermissions('leave.read')
  async holidays(@CurrentUser('orgId') orgId: string, @Query('year') year?: string) {
    const holidays = await this.holidaysService.list(orgId, year ? Number(year) : undefined)
    return { holidays }
  }

  @Post('holidays')
  @RequirePermissions('leave.manage')
  createHoliday(@CurrentUser('orgId') orgId: string, @Body() dto: UpsertHolidayDto) {
    return this.holidaysService.create(orgId, dto)
  }

  @Delete('holidays/:id')
  @RequirePermissions('leave.manage')
  async deleteHoliday(@CurrentUser('orgId') orgId: string, @Param('id') id: string) {
    await this.holidaysService.delete(orgId, id)
    return { success: true }
  }

  @Get(':id')
  @RequirePermissions('leave.read')
  async getById(@CurrentUser() user: JwtPayload, @CurrentUser('orgId') orgId: string, @Param('id') id: string) {
    const leave = await this.staffLeaveService.getById(orgId, id)
    const scope = this.permissionsService.getScope(user, 'leave', 'read')
    if (scope === 'own') {
      const ownProfile = await this.staffRef.findStaffProfileForUser(orgId, user.sub)
      if (!ownProfile || ownProfile.id !== leave.staffId) {
        throw new ForbiddenException('You can only view your own leave requests')
      }
    }
    return leave
  }

  @Post()
  @RequirePermissions('leave.manage')
  async apply(@CurrentUser() user: JwtPayload, @CurrentUser('orgId') orgId: string, @Body() dto: ApplyStaffLeaveDto) {
    const staffId = await this.resolveActionableStaffId(orgId, user, dto.staffId)
    return this.staffLeaveService.apply(orgId, dto, staffId, user.sub)
  }

  @Post(':id/approve')
  @RequirePermissions('leave.approve')
  approve(
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: DecideStaffLeaveDto,
  ) {
    return this.staffLeaveService.approve(orgId, id, dto, userId)
  }

  @Post(':id/reject')
  @RequirePermissions('leave.approve')
  reject(
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: DecideStaffLeaveDto,
  ) {
    return this.staffLeaveService.reject(orgId, id, dto, userId)
  }

  @Post(':id/cancel')
  @RequirePermissions('leave.manage')
  async cancel(@CurrentUser() user: JwtPayload, @CurrentUser('orgId') orgId: string, @Param('id') id: string) {
    const scope = this.permissionsService.getScope(user, 'leave', 'manage')
    if (scope === 'own') {
      const leave = await this.staffLeaveService.getById(orgId, id)
      const ownProfile = await this.staffRef.findStaffProfileForUser(orgId, user.sub)
      if (!ownProfile || ownProfile.id !== leave.staffId) {
        throw new ForbiddenException('You can only cancel your own leave requests')
      }
    }
    return this.staffLeaveService.cancel(orgId, id, user.sub)
  }

  private async resolveOwnScopedStaffId(
    orgId: string,
    user: JwtPayload,
    action: string,
    requestedStaffId?: string,
  ): Promise<string | undefined> {
    const scope = this.permissionsService.getScope(user, 'leave', action)
    if (scope !== 'own') return requestedStaffId

    const ownProfile = await this.staffRef.findStaffProfileForUser(orgId, user.sub)
    if (!ownProfile) return 'no-linked-staff-profile'
    if (requestedStaffId && requestedStaffId !== ownProfile.id) {
      throw new ForbiddenException('You can only view your own leave records')
    }
    return ownProfile.id
  }

  private async resolveActionableStaffId(orgId: string, user: JwtPayload, requestedStaffId?: string): Promise<string> {
    const scope = this.permissionsService.getScope(user, 'leave', 'manage')
    if (scope !== 'own') {
      if (!requestedStaffId) throw new BadRequestException('"staffId" is required')
      return requestedStaffId
    }

    const ownProfile = await this.staffRef.findStaffProfileForUser(orgId, user.sub)
    if (!ownProfile) throw new ForbiddenException('No staff profile is linked to this account')
    if (requestedStaffId && requestedStaffId !== ownProfile.id) {
      throw new ForbiddenException('You can only apply for leave on your own staff profile')
    }
    return ownProfile.id
  }
}
