import { AttendanceSearchQuery, JwtPayload } from '@medicore/types'
import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'

import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { RequirePermissions } from '../../common/decorators/permissions.decorator'
import { PermissionsService } from '../../common/permissions/permissions.service'

import { AttendanceService } from './attendance.service'
import { ClockInDto, ClockOutDto, CorrectAttendanceDto, MarkAttendanceDto } from './dto/attendance.dto'
import { StaffRefService } from './staff-ref.service'

@ApiTags('attendance')
@ApiBearerAuth()
@Controller({ path: 'attendance', version: '1' })
export class AttendanceController {
  constructor(
    private readonly attendanceService: AttendanceService,
    private readonly staffRef: StaffRefService,
    private readonly permissionsService: PermissionsService,
  ) {}

  @Get()
  @RequirePermissions('attendance.read')
  async list(
    @CurrentUser() user: JwtPayload,
    @CurrentUser('orgId') orgId: string,
    @Query('staffId') staffId?: string,
    @Query('departmentId') departmentId?: string,
    @Query('status') status?: AttendanceSearchQuery['status'],
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const effectiveStaffId = await this.resolveOwnScopedStaffId(orgId, user, 'read', staffId)

    return this.attendanceService.list(orgId, {
      staffId: effectiveStaffId,
      departmentId,
      status,
      from,
      to,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    })
  }

  @Get('calendar')
  @RequirePermissions('attendance.read')
  async calendar(
    @CurrentUser() user: JwtPayload,
    @CurrentUser('orgId') orgId: string,
    @Query('month') month: string,
    @Query('staffId') staffId?: string,
  ) {
    if (!month) throw new BadRequestException('"month" query param is required, format YYYY-MM')
    const effectiveStaffId = await this.resolveOwnScopedStaffId(orgId, user, 'read', staffId)
    if (!effectiveStaffId) throw new BadRequestException('"staffId" query param is required')

    const days = await this.attendanceService.calendar(orgId, effectiveStaffId, month)
    return { days }
  }

  @Get('dashboard/stats')
  @RequirePermissions('attendance.read')
  getDashboardStats(@CurrentUser('orgId') orgId: string) {
    return this.attendanceService.getDashboardStats(orgId)
  }

  @Post('clock-in')
  @RequirePermissions('attendance.create')
  async clockIn(
    @CurrentUser() user: JwtPayload,
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Body() dto: ClockInDto,
  ) {
    const staffId = await this.resolveActionableStaffId(orgId, user, 'create', dto.staffId)
    return this.attendanceService.clockIn(orgId, staffId, userId, dto)
  }

  @Post('clock-out')
  @RequirePermissions('attendance.create')
  async clockOut(
    @CurrentUser() user: JwtPayload,
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Body() dto: ClockOutDto,
  ) {
    const staffId = await this.resolveActionableStaffId(orgId, user, 'create', dto.staffId)
    return this.attendanceService.clockOut(orgId, staffId, userId, dto)
  }

  @Post('mark')
  @RequirePermissions('attendance.manage')
  mark(@CurrentUser('orgId') orgId: string, @CurrentUser('sub') userId: string, @Body() dto: MarkAttendanceDto) {
    return this.attendanceService.mark(orgId, dto, userId)
  }

  @Patch(':id/correct')
  @RequirePermissions('attendance.update')
  correct(
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: CorrectAttendanceDto,
  ) {
    return this.attendanceService.correct(orgId, id, dto, userId)
  }

  /** `attendance.read` can be held at `.own` scope — force the list/calendar to the caller's own staff profile. */
  private async resolveOwnScopedStaffId(
    orgId: string,
    user: JwtPayload,
    action: string,
    requestedStaffId?: string,
  ): Promise<string | undefined> {
    const scope = this.permissionsService.getScope(user, 'attendance', action)
    if (scope !== 'own') return requestedStaffId

    const ownProfile = await this.staffRef.findStaffProfileForUser(orgId, user.sub)
    if (!ownProfile) return 'no-linked-staff-profile'
    if (requestedStaffId && requestedStaffId !== ownProfile.id) {
      throw new ForbiddenException('You can only view your own attendance')
    }
    return ownProfile.id
  }

  /** Clock in/out: `.own` scope must resolve to the caller's own profile — no silent fallback like list/calendar. */
  private async resolveActionableStaffId(
    orgId: string,
    user: JwtPayload,
    action: string,
    requestedStaffId?: string,
  ): Promise<string> {
    const scope = this.permissionsService.getScope(user, 'attendance', action)
    if (scope !== 'own') {
      if (!requestedStaffId) throw new BadRequestException('"staffId" is required')
      return requestedStaffId
    }

    const ownProfile = await this.staffRef.findStaffProfileForUser(orgId, user.sub)
    if (!ownProfile) throw new ForbiddenException('No staff profile is linked to this account')
    if (requestedStaffId && requestedStaffId !== ownProfile.id) {
      throw new ForbiddenException('You can only clock in/out on your own staff profile')
    }
    return ownProfile.id
  }
}
