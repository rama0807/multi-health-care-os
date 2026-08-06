import { EncounterQuery, JwtPayload } from '@medicore/types'
import { Body, Controller, ForbiddenException, Get, Param, Patch, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'

import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { RequirePermissions } from '../../common/decorators/permissions.decorator'
import { PermissionsService } from '../../common/permissions/permissions.service'
import { DoctorRefService } from '../scheduling/doctor-ref.service'

import { CreateEncounterDto } from './dto/create-encounter.dto'
import { UpdateEncounterStatusDto } from './dto/update-encounter-status.dto'
import { EncountersService } from './encounters.service'

@ApiTags('encounters')
@ApiBearerAuth()
@Controller({ path: 'encounters', version: '1' })
export class EncountersController {
  constructor(
    private readonly encountersService: EncountersService,
    private readonly doctorRef: DoctorRefService,
    private readonly permissionsService: PermissionsService,
  ) {}

  @Get()
  @RequirePermissions('medical_records.read')
  async list(
    @CurrentUser() user: JwtPayload,
    @CurrentUser('orgId') orgId: string,
    @Query('patientId') patientId?: string,
    @Query('doctorId') doctorId?: string,
    @Query('status') status?: EncounterQuery['status'],
    @Query('type') type?: EncounterQuery['type'],
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const effectiveDoctorId = await this.resolveOwnScopedDoctorId(orgId, user, doctorId)
    return this.encountersService.list(orgId, {
      patientId,
      doctorId: effectiveDoctorId,
      status,
      type,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    })
  }

  @Get(':id')
  @RequirePermissions('medical_records.read')
  async getById(
    @CurrentUser() user: JwtPayload,
    @CurrentUser('orgId') orgId: string,
    @Param('id') id: string,
  ) {
    await this.encountersService.assertOwnScopeOk(orgId, id, user, 'read')
    return this.encountersService.getById(orgId, id)
  }

  @Post()
  @RequirePermissions('medical_records.create')
  create(
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateEncounterDto,
  ) {
    return this.encountersService.create(orgId, dto, userId)
  }

  @Patch(':id/status')
  @RequirePermissions('medical_records.update')
  async updateStatus(
    @CurrentUser() user: JwtPayload,
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateEncounterStatusDto,
  ) {
    await this.encountersService.assertOwnScopeOk(orgId, id, user, 'update')
    return this.encountersService.updateStatus(orgId, id, dto, userId)
  }

  /**
   * For an `.own`-scoped reader, force the list to their own doctor profile
   * - an explicit `doctorId` for someone else is rejected rather than
   * silently ignored (same pattern as `DoctorLeaveController`).
   */
  private async resolveOwnScopedDoctorId(
    orgId: string,
    user: JwtPayload,
    requestedDoctorId?: string,
  ): Promise<string | undefined> {
    const scope = this.permissionsService.getScope(user, 'medical_records', 'read')
    if (scope !== 'own') return requestedDoctorId

    const ownProfile = await this.doctorRef.findDoctorProfileForUser(orgId, user.sub)
    if (!ownProfile) return 'no-linked-doctor-profile'
    if (requestedDoctorId && requestedDoctorId !== ownProfile.id) {
      throw new ForbiddenException('You can only view your own encounters')
    }
    return ownProfile.id
  }
}
