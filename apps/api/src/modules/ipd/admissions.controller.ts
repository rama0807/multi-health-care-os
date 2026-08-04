import { AdmissionStatus, AdmissionType, JwtPayload } from '@medicore/types'
import { Body, Controller, ForbiddenException, Get, Param, Patch, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'

import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { RequirePermissions } from '../../common/decorators/permissions.decorator'
import { PermissionsService } from '../../common/permissions/permissions.service'
import { DoctorRefService } from '../scheduling/doctor-ref.service'

import { AdmissionsService } from './admissions.service'
import { CancelAdmissionDto } from './dto/cancel-admission.dto'
import { CreateAdmissionDto } from './dto/create-admission.dto'
import { UpdateAdmissionDto } from './dto/update-admission.dto'

@ApiTags('ipd-admissions')
@ApiBearerAuth()
@Controller({ path: 'ipd/admissions', version: '1' })
export class AdmissionsController {
  constructor(
    private readonly admissionsService: AdmissionsService,
    private readonly doctorRef: DoctorRefService,
    private readonly permissionsService: PermissionsService,
  ) {}

  @Get()
  @RequirePermissions('ipd.admissions.read')
  async list(
    @CurrentUser() user: JwtPayload,
    @CurrentUser('orgId') orgId: string,
    @Query('search') search?: string,
    @Query('patientId') patientId?: string,
    @Query('attendingDoctorId') attendingDoctorId?: string,
    @Query('wardId') wardId?: string,
    @Query('status') status?: AdmissionStatus,
    @Query('type') type?: AdmissionType,
    @Query('pendingDischarge') pendingDischarge?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const effectiveDoctorId = await this.resolveOwnScopedDoctorId(orgId, user, attendingDoctorId)
    return this.admissionsService.list(orgId, {
      search,
      patientId,
      attendingDoctorId: effectiveDoctorId,
      wardId,
      status,
      type,
      pendingDischarge: pendingDischarge === 'true',
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    })
  }

  @Get(':id')
  @RequirePermissions('ipd.admissions.read')
  async getById(@CurrentUser() user: JwtPayload, @CurrentUser('orgId') orgId: string, @Param('id') id: string) {
    await this.admissionsService.assertOwnScopeOk(orgId, id, user, 'read')
    return this.admissionsService.getById(orgId, id)
  }

  @Post()
  @RequirePermissions('ipd.admissions.create')
  create(
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateAdmissionDto,
  ) {
    return this.admissionsService.create(orgId, dto, userId)
  }

  @Patch(':id')
  @RequirePermissions('ipd.admissions.update')
  async update(
    @CurrentUser() user: JwtPayload,
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateAdmissionDto,
  ) {
    await this.admissionsService.assertOwnScopeOk(orgId, id, user, 'update')
    return this.admissionsService.update(orgId, id, dto, userId)
  }

  @Patch(':id/cancel')
  @RequirePermissions('ipd.admissions.update')
  async cancel(
    @CurrentUser() user: JwtPayload,
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: CancelAdmissionDto,
  ) {
    await this.admissionsService.assertOwnScopeOk(orgId, id, user, 'update')
    return this.admissionsService.cancel(orgId, id, dto, userId)
  }

  /** For an `.own`-scoped reader, force the list to their own doctor profile (same pattern as `PrescriptionsController`). */
  private async resolveOwnScopedDoctorId(
    orgId: string,
    user: JwtPayload,
    requestedDoctorId?: string,
  ): Promise<string | undefined> {
    const scope = this.permissionsService.getScope(user, 'ipd.admissions', 'read')
    if (scope !== 'own') return requestedDoctorId

    const ownProfile = await this.doctorRef.findDoctorProfileForUser(orgId, user.sub)
    if (!ownProfile) return 'no-linked-doctor-profile'
    if (requestedDoctorId && requestedDoctorId !== ownProfile.id) {
      throw new ForbiddenException('You can only view admissions where you are the attending doctor')
    }
    return ownProfile.id
  }
}
