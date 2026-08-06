import { JwtPayload, LabTestQuery } from '@medicore/types'
import { BadRequestException, Body, Controller, ForbiddenException, Get, Param, Patch, Post, Query, Req, Res } from '@nestjs/common'
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger'
import { FastifyReply, FastifyRequest } from 'fastify'

import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { RequirePermissions } from '../../common/decorators/permissions.decorator'
import { PermissionsService } from '../../common/permissions/permissions.service'
import { DoctorRefService } from '../scheduling/doctor-ref.service'

import { CreateLabOrderDto } from './dto/create-lab-order.dto'
import { EnterLabResultsDto } from './dto/enter-lab-results.dto'
import { RecordSampleCollectionDto } from './dto/record-sample-collection.dto'
import { UpdateLabTestStatusDto } from './dto/update-lab-test-status.dto'
import { LabTestsService } from './lab-tests.service'

@ApiTags('laboratory')
@ApiBearerAuth()
@Controller({ path: 'laboratory', version: '1' })
export class LabTestsController {
  constructor(
    private readonly labTestsService: LabTestsService,
    private readonly doctorRef: DoctorRefService,
    private readonly permissionsService: PermissionsService,
  ) {}

  @Get()
  @RequirePermissions('laboratory.read')
  async list(
    @CurrentUser() user: JwtPayload,
    @CurrentUser('orgId') orgId: string,
    @Query('patientId') patientId?: string,
    @Query('doctorId') doctorId?: string,
    @Query('encounterId') encounterId?: string,
    @Query('status') status?: LabTestQuery['status'],
    @Query('priority') priority?: LabTestQuery['priority'],
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const effectiveDoctorId = await this.resolveOwnScopedDoctorId(orgId, user, doctorId)
    return this.labTestsService.list(orgId, {
      patientId,
      doctorId: effectiveDoctorId,
      encounterId,
      status,
      priority,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    })
  }

  @Get(':id')
  @RequirePermissions('laboratory.read')
  async getById(@CurrentUser() user: JwtPayload, @CurrentUser('orgId') orgId: string, @Param('id') id: string) {
    await this.labTestsService.assertOwnScopeOk(orgId, id, user, 'read')
    return this.labTestsService.getById(orgId, id)
  }

  @Get(':id/report/pdf')
  @RequirePermissions('laboratory.read')
  async downloadReportPdf(
    @CurrentUser() user: JwtPayload,
    @CurrentUser('orgId') orgId: string,
    @Param('id') id: string,
    @Res() reply: FastifyReply,
  ) {
    await this.labTestsService.assertOwnScopeOk(orgId, id, user, 'read')
    const { buffer, fileName } = await this.labTestsService.generateReportPdf(orgId, id)
    void reply
      .header('Content-Type', 'application/pdf')
      .header('Content-Disposition', `attachment; filename="${fileName}"`)
      .send(buffer)
  }

  @Post()
  @RequirePermissions('laboratory.create')
  create(@CurrentUser('orgId') orgId: string, @CurrentUser('sub') userId: string, @Body() dto: CreateLabOrderDto) {
    return this.labTestsService.create(orgId, dto, userId)
  }

  @Post(':id/collect-sample')
  @RequirePermissions('laboratory.update')
  async collectSample(
    @CurrentUser() user: JwtPayload,
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: RecordSampleCollectionDto,
  ) {
    await this.labTestsService.assertOwnScopeOk(orgId, id, user, 'update')
    return this.labTestsService.collectSample(orgId, id, dto, userId)
  }

  @Post(':id/results')
  @RequirePermissions('laboratory.update')
  async enterResults(
    @CurrentUser() user: JwtPayload,
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: EnterLabResultsDto,
  ) {
    await this.labTestsService.assertOwnScopeOk(orgId, id, user, 'update')
    return this.labTestsService.enterResults(orgId, id, dto, userId)
  }

  @Post(':id/report')
  @ApiConsumes('multipart/form-data')
  @RequirePermissions('laboratory.update')
  async uploadReport(
    @CurrentUser() user: JwtPayload,
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Req() request: FastifyRequest,
  ) {
    await this.labTestsService.assertOwnScopeOk(orgId, id, user, 'update')

    const data = await request.file()
    if (!data) throw new BadRequestException('No file uploaded - send multipart/form-data')
    const buffer = await data.toBuffer()

    return this.labTestsService.uploadReportFile(
      orgId,
      id,
      { buffer, fileName: data.filename, mimeType: data.mimetype, size: buffer.length },
      userId,
    )
  }

  @Patch(':id/status')
  @RequirePermissions('laboratory.update')
  async updateStatus(
    @CurrentUser() user: JwtPayload,
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateLabTestStatusDto,
  ) {
    await this.labTestsService.assertOwnScopeOk(orgId, id, user, 'update')
    return this.labTestsService.updateStatus(orgId, id, dto, userId)
  }

  /**
   * For an `.own`-scoped reader, force the list to their own doctor profile
   * - an explicit `doctorId` for someone else is rejected rather than
   * silently ignored (same pattern as `PrescriptionsController`).
   */
  private async resolveOwnScopedDoctorId(
    orgId: string,
    user: JwtPayload,
    requestedDoctorId?: string,
  ): Promise<string | undefined> {
    const scope = this.permissionsService.getScope(user, 'laboratory', 'read')
    if (scope !== 'own') return requestedDoctorId

    const ownProfile = await this.doctorRef.findDoctorProfileForUser(orgId, user.sub)
    if (!ownProfile) return 'no-linked-doctor-profile'
    if (requestedDoctorId && requestedDoctorId !== ownProfile.id) {
      throw new ForbiddenException('You can only view your own lab orders')
    }
    return ownProfile.id
  }
}
