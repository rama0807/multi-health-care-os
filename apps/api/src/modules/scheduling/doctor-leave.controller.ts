import { JwtPayload, LeaveSearchQuery } from '@medicore/types'
import { Body, Controller, ForbiddenException, Get, Param, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'

import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { RequirePermissions } from '../../common/decorators/permissions.decorator'
import { PermissionsService } from '../../common/permissions/permissions.service'

import { DoctorLeaveService } from './doctor-leave.service'
import { DoctorRefService } from './doctor-ref.service'
import { ApplyLeaveDto, DecideLeaveDto } from './dto/apply-leave.dto'

@ApiTags('doctor-leave')
@ApiBearerAuth()
@Controller({ path: 'doctor-leaves', version: '1' })
export class DoctorLeaveController {
  constructor(
    private readonly leaveService: DoctorLeaveService,
    private readonly doctorRef: DoctorRefService,
    private readonly permissionsService: PermissionsService,
  ) {}

  @Get()
  @RequirePermissions('doctors.leave.read')
  async list(
    @CurrentUser() user: JwtPayload,
    @CurrentUser('orgId') orgId: string,
    @Query('doctorId') doctorId?: string,
    @Query('status') status?: LeaveSearchQuery['status'],
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const effectiveDoctorId = await this.resolveOwnScopedDoctorId(orgId, user, 'read', doctorId)

    return this.leaveService.list(orgId, {
      doctorId: effectiveDoctorId,
      status,
      from,
      to,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    })
  }

  @Get('upcoming')
  @RequirePermissions('doctors.leave.read')
  async upcoming(@CurrentUser('orgId') orgId: string, @Query('limit') limit?: string) {
    const leaves = await this.leaveService.listUpcoming(orgId, limit ? Number(limit) : undefined)
    return { leaves }
  }

  @Get(':id')
  @RequirePermissions('doctors.leave.read')
  async getById(
    @CurrentUser() user: JwtPayload,
    @CurrentUser('orgId') orgId: string,
    @Param('id') id: string,
  ) {
    const leave = await this.leaveService.getById(orgId, id)
    const scope = this.permissionsService.getScope(user, 'doctors.leave', 'read')
    if (scope === 'own') {
      const ownProfile = await this.doctorRef.findDoctorProfileForUser(orgId, user.sub)
      if (!ownProfile || ownProfile.id !== leave.doctorId) {
        throw new ForbiddenException('You can only view your own leave requests')
      }
    }
    return leave
  }

  @Post()
  @RequirePermissions('doctors.leave.manage')
  async apply(
    @CurrentUser() user: JwtPayload,
    @CurrentUser('orgId') orgId: string,
    @Body() dto: ApplyLeaveDto,
  ) {
    const scope = this.permissionsService.getScope(user, 'doctors.leave', 'manage')
    if (scope === 'own') {
      const ownProfile = await this.doctorRef.findDoctorProfileForUser(orgId, user.sub)
      if (!ownProfile || ownProfile.id !== dto.doctorId) {
        throw new ForbiddenException('You can only apply for leave on your own doctor profile')
      }
    }
    return this.leaveService.apply(orgId, dto, user.sub)
  }

  @Post(':id/approve')
  @RequirePermissions('doctors.leave.approve')
  approve(
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: DecideLeaveDto,
  ) {
    return this.leaveService.approve(orgId, id, dto, userId)
  }

  @Post(':id/reject')
  @RequirePermissions('doctors.leave.approve')
  reject(
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: DecideLeaveDto,
  ) {
    return this.leaveService.reject(orgId, id, dto, userId)
  }

  @Post(':id/cancel')
  @RequirePermissions('doctors.leave.manage')
  async cancel(
    @CurrentUser() user: JwtPayload,
    @CurrentUser('orgId') orgId: string,
    @Param('id') id: string,
  ) {
    const scope = this.permissionsService.getScope(user, 'doctors.leave', 'manage')
    if (scope === 'own') {
      const leave = await this.leaveService.getById(orgId, id)
      const ownProfile = await this.doctorRef.findDoctorProfileForUser(orgId, user.sub)
      if (!ownProfile || ownProfile.id !== leave.doctorId) {
        throw new ForbiddenException('You can only cancel your own leave requests')
      }
    }
    return this.leaveService.cancel(orgId, id, user.sub)
  }

  /**
   * For an `.own`-scoped reader, force the query to their own doctor
   * profile - an explicit `doctorId` for someone else is rejected rather
   * than silently ignored, since silently ignoring it could read as "that
   * filter just didn't match anything" instead of a permission boundary.
   */
  private async resolveOwnScopedDoctorId(
    orgId: string,
    user: JwtPayload,
    action: string,
    requestedDoctorId?: string,
  ): Promise<string | undefined> {
    const scope = this.permissionsService.getScope(user, 'doctors.leave', action)
    if (scope !== 'own') return requestedDoctorId

    const ownProfile = await this.doctorRef.findDoctorProfileForUser(orgId, user.sub)
    // No linked doctor profile - force a doctorId that can never match a
    // real row rather than falling through to an unscoped (all-doctors) list.
    if (!ownProfile) return 'no-linked-doctor-profile'
    if (requestedDoctorId && requestedDoctorId !== ownProfile.id) {
      throw new ForbiddenException('You can only view your own leave requests')
    }
    return ownProfile.id
  }
}
