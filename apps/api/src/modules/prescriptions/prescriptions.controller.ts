import { JwtPayload, PrescriptionQuery } from '@medicore/types'
import { Body, Controller, ForbiddenException, Get, Param, Patch, Post, Query, Res } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { FastifyReply } from 'fastify'

import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { RequirePermissions } from '../../common/decorators/permissions.decorator'
import { PermissionsService } from '../../common/permissions/permissions.service'
import { DoctorRefService } from '../scheduling/doctor-ref.service'

import { CreatePrescriptionDto } from './dto/create-prescription.dto'
import { UpdatePrescriptionStatusDto } from './dto/update-prescription-status.dto'
import { PrescriptionsService } from './prescriptions.service'

@ApiTags('prescriptions')
@ApiBearerAuth()
@Controller({ path: 'prescriptions', version: '1' })
export class PrescriptionsController {
  constructor(
    private readonly prescriptionsService: PrescriptionsService,
    private readonly doctorRef: DoctorRefService,
    private readonly permissionsService: PermissionsService,
  ) {}

  @Get()
  @RequirePermissions('prescriptions.read')
  async list(
    @CurrentUser() user: JwtPayload,
    @CurrentUser('orgId') orgId: string,
    @Query('patientId') patientId?: string,
    @Query('doctorId') doctorId?: string,
    @Query('encounterId') encounterId?: string,
    @Query('status') status?: PrescriptionQuery['status'],
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const effectiveDoctorId = await this.resolveOwnScopedDoctorId(orgId, user, doctorId)
    return this.prescriptionsService.list(orgId, {
      patientId,
      doctorId: effectiveDoctorId,
      encounterId,
      status,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    })
  }

  @Get(':id')
  @RequirePermissions('prescriptions.read')
  async getById(@CurrentUser() user: JwtPayload, @CurrentUser('orgId') orgId: string, @Param('id') id: string) {
    await this.prescriptionsService.assertOwnScopeOk(orgId, id, user, 'read')
    return this.prescriptionsService.getById(orgId, id)
  }

  @Get(':id/pdf')
  @RequirePermissions('prescriptions.read')
  async downloadPdf(
    @CurrentUser() user: JwtPayload,
    @CurrentUser('orgId') orgId: string,
    @Param('id') id: string,
    @Res() reply: FastifyReply,
  ) {
    await this.prescriptionsService.assertOwnScopeOk(orgId, id, user, 'read')
    const { buffer, fileName } = await this.prescriptionsService.generatePdf(orgId, id)
    void reply
      .header('Content-Type', 'application/pdf')
      .header('Content-Disposition', `attachment; filename="${fileName}"`)
      .send(buffer)
  }

  @Post()
  @RequirePermissions('prescriptions.create')
  create(
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Body() dto: CreatePrescriptionDto,
  ) {
    return this.prescriptionsService.create(orgId, dto, userId)
  }

  @Patch(':id/status')
  @RequirePermissions('prescriptions.update')
  async updateStatus(
    @CurrentUser() user: JwtPayload,
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdatePrescriptionStatusDto,
  ) {
    await this.prescriptionsService.assertOwnScopeOk(orgId, id, user, 'update')
    return this.prescriptionsService.updateStatus(orgId, id, dto, userId)
  }

  /**
   * For an `.own`-scoped reader, force the list to their own doctor profile
   * — an explicit `doctorId` for someone else is rejected rather than
   * silently ignored (same pattern as `EncountersController`).
   */
  private async resolveOwnScopedDoctorId(
    orgId: string,
    user: JwtPayload,
    requestedDoctorId?: string,
  ): Promise<string | undefined> {
    const scope = this.permissionsService.getScope(user, 'prescriptions', 'read')
    if (scope !== 'own') return requestedDoctorId

    const ownProfile = await this.doctorRef.findDoctorProfileForUser(orgId, user.sub)
    if (!ownProfile) return 'no-linked-doctor-profile'
    if (requestedDoctorId && requestedDoctorId !== ownProfile.id) {
      throw new ForbiddenException('You can only view your own prescriptions')
    }
    return ownProfile.id
  }
}
