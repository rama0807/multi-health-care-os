import { JwtPayload, RadiologyAttachmentType, RadiologyOrderQuery } from '@medicore/types'
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common'
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger'
import { FastifyReply, FastifyRequest } from 'fastify'

import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { RequirePermissions } from '../../common/decorators/permissions.decorator'
import { PermissionsService } from '../../common/permissions/permissions.service'
import { DoctorRefService } from '../scheduling/doctor-ref.service'

import { CreateExternalRadiologyAttachmentDto } from './dto/create-external-radiology-attachment.dto'
import { CreateRadiologyOrderDto } from './dto/create-radiology-order.dto'
import { CreateRadiologyReportDto } from './dto/create-radiology-report.dto'
import { ScheduleRadiologyOrderDto } from './dto/schedule-radiology-order.dto'
import { UpdateRadiologyOrderDto } from './dto/update-radiology-order.dto'
import { UpdateRadiologyStatusDto } from './dto/update-radiology-status.dto'
import { RadiologyOrdersService } from './radiology-orders.service'

@ApiTags('radiology')
@ApiBearerAuth()
@Controller({ path: 'radiology', version: '1' })
export class RadiologyOrdersController {
  constructor(
    private readonly ordersService: RadiologyOrdersService,
    private readonly doctorRef: DoctorRefService,
    private readonly permissionsService: PermissionsService,
  ) {}

  @Get()
  @RequirePermissions('radiology.read')
  async list(
    @CurrentUser() user: JwtPayload,
    @CurrentUser('orgId') orgId: string,
    @Query('patientId') patientId?: string,
    @Query('doctorId') doctorId?: string,
    @Query('encounterId') encounterId?: string,
    @Query('status') status?: RadiologyOrderQuery['status'],
    @Query('priority') priority?: RadiologyOrderQuery['priority'],
    @Query('modality') modality?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('sortBy') sortBy?: RadiologyOrderQuery['sortBy'],
    @Query('sortOrder') sortOrder?: RadiologyOrderQuery['sortOrder'],
  ) {
    const effectiveDoctorId = await this.resolveOwnScopedDoctorId(orgId, user, doctorId)
    return this.ordersService.list(orgId, {
      patientId,
      doctorId: effectiveDoctorId,
      encounterId,
      status,
      priority,
      modality,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      sortBy,
      sortOrder,
    })
  }

  @Get('dashboard-stats')
  @RequirePermissions('radiology.read')
  getDashboardStats(@CurrentUser('orgId') orgId: string) {
    return this.ordersService.getDashboardStats(orgId)
  }

  @Get(':id')
  @RequirePermissions('radiology.read')
  async getById(@CurrentUser() user: JwtPayload, @CurrentUser('orgId') orgId: string, @Param('id') id: string) {
    await this.ordersService.assertOwnScopeOk(orgId, id, user, 'read')
    return this.ordersService.getById(orgId, id)
  }

  @Get(':id/report/pdf')
  @RequirePermissions('radiology.read')
  async downloadReportPdf(
    @CurrentUser() user: JwtPayload,
    @CurrentUser('orgId') orgId: string,
    @Param('id') id: string,
    @Res() reply: FastifyReply,
  ) {
    await this.ordersService.assertOwnScopeOk(orgId, id, user, 'read')
    const { buffer, fileName } = await this.ordersService.generateReportPdf(orgId, id)
    void reply
      .header('Content-Type', 'application/pdf')
      .header('Content-Disposition', `attachment; filename="${fileName}"`)
      .send(buffer)
  }

  @Get(':id/attachments')
  @RequirePermissions('radiology.read')
  async listAttachments(@CurrentUser() user: JwtPayload, @CurrentUser('orgId') orgId: string, @Param('id') id: string) {
    await this.ordersService.assertOwnScopeOk(orgId, id, user, 'read')
    return this.ordersService.listAttachments(orgId, id)
  }

  @Post()
  @RequirePermissions('radiology.create')
  create(@CurrentUser('orgId') orgId: string, @CurrentUser('sub') userId: string, @Body() dto: CreateRadiologyOrderDto) {
    return this.ordersService.create(orgId, dto, userId)
  }

  @Patch(':id')
  @RequirePermissions('radiology.update')
  async update(
    @CurrentUser() user: JwtPayload,
    @CurrentUser('orgId') orgId: string,
    @Param('id') id: string,
    @Body() dto: UpdateRadiologyOrderDto,
  ) {
    await this.ordersService.assertOwnScopeOk(orgId, id, user, 'update')
    return this.ordersService.update(orgId, id, dto)
  }

  @Post(':id/schedule')
  @RequirePermissions('radiology.update')
  async schedule(
    @CurrentUser() user: JwtPayload,
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: ScheduleRadiologyOrderDto,
  ) {
    await this.ordersService.assertOwnScopeOk(orgId, id, user, 'update')
    return this.ordersService.schedule(orgId, id, dto, userId)
  }

  @Post(':id/start')
  @RequirePermissions('radiology.update')
  async startStudy(
    @CurrentUser() user: JwtPayload,
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
  ) {
    await this.ordersService.assertOwnScopeOk(orgId, id, user, 'update')
    return this.ordersService.startStudy(orgId, id, userId)
  }

  @Post(':id/complete')
  @RequirePermissions('radiology.update')
  async completeStudy(
    @CurrentUser() user: JwtPayload,
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
  ) {
    await this.ordersService.assertOwnScopeOk(orgId, id, user, 'update')
    return this.ordersService.completeStudy(orgId, id, userId)
  }

  @Post(':id/reports')
  @RequirePermissions('radiology.update')
  async addReportVersion(
    @CurrentUser() user: JwtPayload,
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: CreateRadiologyReportDto,
  ) {
    await this.ordersService.assertOwnScopeOk(orgId, id, user, 'update')
    return this.ordersService.addReportVersion(orgId, id, dto, userId)
  }

  @Post(':id/reports/verify')
  @RequirePermissions('radiology.update')
  async verifyReport(
    @CurrentUser() user: JwtPayload,
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
  ) {
    await this.ordersService.assertOwnScopeOk(orgId, id, user, 'update')
    return this.ordersService.verifyReport(orgId, id, userId)
  }

  @Post(':id/reports/release')
  @RequirePermissions('radiology.update')
  async releaseReport(
    @CurrentUser() user: JwtPayload,
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
  ) {
    await this.ordersService.assertOwnScopeOk(orgId, id, user, 'update')
    return this.ordersService.releaseReport(orgId, id, userId)
  }

  @Post(':id/report-file')
  @ApiConsumes('multipart/form-data')
  @RequirePermissions('radiology.update')
  async uploadReportFile(
    @CurrentUser() user: JwtPayload,
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Req() request: FastifyRequest,
  ) {
    await this.ordersService.assertOwnScopeOk(orgId, id, user, 'update')

    const data = await request.file()
    if (!data) throw new BadRequestException('No file uploaded - send multipart/form-data')
    const buffer = await data.toBuffer()

    return this.ordersService.uploadReportFile(
      orgId,
      id,
      { buffer, fileName: data.filename, mimeType: data.mimetype, size: buffer.length },
      userId,
    )
  }

  @Post(':id/attachments/file')
  @ApiConsumes('multipart/form-data')
  @RequirePermissions('radiology.update')
  async uploadFileAttachment(
    @CurrentUser() user: JwtPayload,
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Query('type') type: string,
    @Req() request: FastifyRequest,
  ) {
    await this.ordersService.assertOwnScopeOk(orgId, id, user, 'update')

    const FILE_ATTACHMENT_TYPES: string[] = [RadiologyAttachmentType.IMAGE, RadiologyAttachmentType.PDF]
    if (!FILE_ATTACHMENT_TYPES.includes(type)) {
      throw new BadRequestException('type must be IMAGE or PDF for a file upload')
    }

    const data = await request.file()
    if (!data) throw new BadRequestException('No file uploaded - send multipart/form-data')
    const buffer = await data.toBuffer()

    return this.ordersService.addFileAttachment(
      orgId,
      id,
      type as RadiologyAttachmentType.IMAGE | RadiologyAttachmentType.PDF,
      { buffer, fileName: data.filename, mimeType: data.mimetype, size: buffer.length },
      userId,
    )
  }

  @Post(':id/attachments/external')
  @RequirePermissions('radiology.update')
  async addExternalAttachment(
    @CurrentUser() user: JwtPayload,
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: CreateExternalRadiologyAttachmentDto,
  ) {
    await this.ordersService.assertOwnScopeOk(orgId, id, user, 'update')
    return this.ordersService.addExternalAttachment(orgId, id, dto.type, dto.metadata, userId)
  }

  @Delete(':id/attachments/:attachmentId')
  @RequirePermissions('radiology.update')
  async deleteAttachment(
    @CurrentUser() user: JwtPayload,
    @CurrentUser('orgId') orgId: string,
    @Param('id') id: string,
    @Param('attachmentId') attachmentId: string,
  ) {
    await this.ordersService.assertOwnScopeOk(orgId, id, user, 'update')
    await this.ordersService.deleteAttachment(orgId, id, attachmentId)
    return { success: true }
  }

  @Patch(':id/status')
  @RequirePermissions('radiology.update')
  async updateStatus(
    @CurrentUser() user: JwtPayload,
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateRadiologyStatusDto,
  ) {
    await this.ordersService.assertOwnScopeOk(orgId, id, user, 'update')
    return this.ordersService.updateStatus(orgId, id, dto, userId)
  }

  /**
   * For an `.own`-scoped reader, force the list to their own doctor profile
   * - an explicit `doctorId` for someone else is rejected rather than
   * silently ignored (same pattern as `LabTestsController`).
   */
  private async resolveOwnScopedDoctorId(
    orgId: string,
    user: JwtPayload,
    requestedDoctorId?: string,
  ): Promise<string | undefined> {
    const scope = this.permissionsService.getScope(user, 'radiology', 'read')
    if (scope !== 'own') return requestedDoctorId

    const ownProfile = await this.doctorRef.findDoctorProfileForUser(orgId, user.sub)
    if (!ownProfile) return 'no-linked-doctor-profile'
    if (requestedDoctorId && requestedDoctorId !== ownProfile.id) {
      throw new ForbiddenException('You can only view your own radiology orders')
    }
    return ownProfile.id
  }
}
