import { JwtPayload } from '@medicore/types'
import { BadRequestException, Body, Controller, Delete, ForbiddenException, Get, Param, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'

import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { RequirePermissions } from '../../common/decorators/permissions.decorator'
import { PermissionsService } from '../../common/permissions/permissions.service'

import { AssignShiftRosterDto, BulkAssignShiftRosterDto } from './dto/shift.dto'
import { ShiftRosterService } from './shift-roster.service'
import { StaffRefService } from './staff-ref.service'

@ApiTags('shift-roster')
@ApiBearerAuth()
@Controller({ path: 'shifts/roster', version: '1' })
export class ShiftRosterController {
  constructor(
    private readonly rosterService: ShiftRosterService,
    private readonly staffRef: StaffRefService,
    private readonly permissionsService: PermissionsService,
  ) {}

  @Get()
  @RequirePermissions('shifts.roster.read')
  async list(
    @CurrentUser() user: JwtPayload,
    @CurrentUser('orgId') orgId: string,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('staffId') staffId?: string,
    @Query('shiftId') shiftId?: string,
    @Query('departmentId') departmentId?: string,
  ) {
    if (!from || !to) throw new BadRequestException('"from" and "to" query params are required')

    const effectiveStaffId = await this.resolveOwnScopedStaffId(orgId, user, staffId)

    return this.rosterService.list(orgId, { from, to, staffId: effectiveStaffId, shiftId, departmentId })
  }

  @Post()
  @RequirePermissions('shifts.roster.create')
  assign(
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Body() dto: AssignShiftRosterDto,
  ) {
    return this.rosterService.assign(orgId, dto, userId)
  }

  @Post('bulk')
  @RequirePermissions('shifts.roster.create')
  bulkAssign(
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Body() dto: BulkAssignShiftRosterDto,
  ) {
    return this.rosterService.bulkAssign(orgId, dto, userId)
  }

  @Delete(':id')
  @RequirePermissions('shifts.roster.update')
  async delete(@CurrentUser('orgId') orgId: string, @Param('id') id: string) {
    await this.rosterService.delete(orgId, id)
    return { success: true }
  }

  /** `shifts.roster.read` can be held at `.own` scope - force the list to the caller's own staff profile. */
  private async resolveOwnScopedStaffId(
    orgId: string,
    user: JwtPayload,
    requestedStaffId?: string,
  ): Promise<string | undefined> {
    const scope = this.permissionsService.getScope(user, 'shifts.roster', 'read')
    if (scope !== 'own') return requestedStaffId

    const ownProfile = await this.staffRef.findStaffProfileForUser(orgId, user.sub)
    if (!ownProfile) return 'no-linked-staff-profile'
    if (requestedStaffId && requestedStaffId !== ownProfile.id) {
      throw new ForbiddenException('You can only view your own roster')
    }
    return ownProfile.id
  }
}
