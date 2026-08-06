import { JwtPayload } from '@medicore/types'
import { Body, Controller, ForbiddenException, Get, Param, Patch, Post } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'

import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { RequirePermissions } from '../../common/decorators/permissions.decorator'
import { PermissionsService } from '../../common/permissions/permissions.service'

import { DoctorRefService } from './doctor-ref.service'
import { DoctorScheduleService } from './doctor-schedule.service'
import { CreateDoctorScheduleDto, UpdateDoctorScheduleVersionDto } from './dto/create-schedule.dto'

@ApiTags('doctor-schedule')
@ApiBearerAuth()
@Controller({ path: 'doctors/:doctorId/schedule', version: '1' })
export class DoctorScheduleController {
  constructor(
    private readonly scheduleService: DoctorScheduleService,
    private readonly doctorRef: DoctorRefService,
    private readonly permissionsService: PermissionsService,
  ) {}

  @Get()
  @RequirePermissions('doctors.schedule.read')
  async getEffective(
    @CurrentUser() user: JwtPayload,
    @CurrentUser('orgId') orgId: string,
    @Param('doctorId') doctorId: string,
  ) {
    await this.assertOwnScopeOk(orgId, doctorId, user, 'doctors.schedule', 'read')
    return this.scheduleService.getEffective(orgId, doctorId)
  }

  @Get('versions')
  @RequirePermissions('doctors.schedule.read')
  async listVersions(
    @CurrentUser() user: JwtPayload,
    @CurrentUser('orgId') orgId: string,
    @Param('doctorId') doctorId: string,
  ) {
    await this.assertOwnScopeOk(orgId, doctorId, user, 'doctors.schedule', 'read')
    const versions = await this.scheduleService.listVersions(orgId, doctorId)
    return { versions }
  }

  @Post()
  @RequirePermissions('doctors.schedule.update')
  create(
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Param('doctorId') doctorId: string,
    @Body() dto: CreateDoctorScheduleDto,
  ) {
    return this.scheduleService.createVersion(orgId, doctorId, dto, userId)
  }

  @Patch(':scheduleId')
  @RequirePermissions('doctors.schedule.update')
  setActive(
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Param('doctorId') doctorId: string,
    @Param('scheduleId') scheduleId: string,
    @Body() dto: UpdateDoctorScheduleVersionDto,
  ) {
    return this.scheduleService.setVersionActive(orgId, doctorId, scheduleId, dto, userId)
  }

  /**
   * `RequirePermissions` only proves the caller holds the permission at
   * *some* scope - it can't tell `.own` from `.all` (that distinction isn't
   * knowable from the decorator's static string). Routes that accept an
   * arbitrary `:doctorId` must re-check here that an `.own`-scoped caller's
   * doctorId actually matches their own linked profile.
   */
  private async assertOwnScopeOk(
    orgId: string,
    doctorId: string,
    user: JwtPayload,
    resource: string,
    action: string,
  ): Promise<void> {
    const scope = this.permissionsService.getScope(user, resource, action)
    if (scope !== 'own') return

    const ownProfile = await this.doctorRef.findDoctorProfileForUser(orgId, user.sub)
    if (!ownProfile || ownProfile.id !== doctorId) {
      throw new ForbiddenException('You can only access your own doctor profile')
    }
  }
}
