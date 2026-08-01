import { JwtPayload } from '@medicore/types'
import { BadRequestException, Controller, ForbiddenException, Get, Param, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'

import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { RequirePermissions } from '../../common/decorators/permissions.decorator'
import { PermissionsService } from '../../common/permissions/permissions.service'

import { AvailabilityService } from './availability.service'
import { DoctorRefService } from './doctor-ref.service'

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

@ApiTags('doctor-availability')
@ApiBearerAuth()
@Controller({ path: 'doctors/:doctorId/availability', version: '1' })
export class AvailabilityController {
  constructor(
    private readonly availabilityService: AvailabilityService,
    private readonly doctorRef: DoctorRefService,
    private readonly permissionsService: PermissionsService,
  ) {}

  @Get()
  @RequirePermissions('doctors.schedule.read')
  async getAvailableSlots(
    @CurrentUser() user: JwtPayload,
    @CurrentUser('orgId') orgId: string,
    @Param('doctorId') doctorId: string,
    @Query('date') date?: string,
    @Query('duration') duration?: string,
  ) {
    await this.assertOwnScopeOk(orgId, doctorId, user)
    if (!date || !DATE_ONLY.test(date)) {
      throw new BadRequestException('Query param "date" is required in YYYY-MM-DD format')
    }
    return this.availabilityService.getAvailableSlots(orgId, doctorId, date, duration ? Number(duration) : undefined)
  }

  @Get('today')
  @RequirePermissions('doctors.schedule.read')
  async getTodayStatus(
    @CurrentUser() user: JwtPayload,
    @CurrentUser('orgId') orgId: string,
    @Param('doctorId') doctorId: string,
  ) {
    await this.assertOwnScopeOk(orgId, doctorId, user)
    return this.availabilityService.getTodayStatus(orgId, doctorId)
  }

  private async assertOwnScopeOk(orgId: string, doctorId: string, user: JwtPayload): Promise<void> {
    const scope = this.permissionsService.getScope(user, 'doctors.schedule', 'read')
    if (scope !== 'own') return

    const ownProfile = await this.doctorRef.findDoctorProfileForUser(orgId, user.sub)
    if (!ownProfile || ownProfile.id !== doctorId) {
      throw new ForbiddenException('You can only view your own availability')
    }
  }
}
