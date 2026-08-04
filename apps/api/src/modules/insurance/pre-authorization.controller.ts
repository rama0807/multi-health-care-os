import { PreAuthorizationStatus } from '@medicore/types'
import { BadRequestException, Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common'
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger'
import { FastifyRequest } from 'fastify'

import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { RequirePermissions } from '../../common/decorators/permissions.decorator'

import { CancelPreAuthorizationDto } from './dto/cancel-pre-authorization.dto'
import { CreatePreAuthorizationDto } from './dto/create-pre-authorization.dto'
import { DecidePreAuthorizationDto } from './dto/decide-pre-authorization.dto'
import { PreAuthorizationService } from './pre-authorization.service'

const ALLOWED_ATTACHMENT_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'application/pdf'])

@ApiTags('insurance-preauth')
@ApiBearerAuth()
@Controller({ path: 'insurance/preauth', version: '1' })
export class PreAuthorizationController {
  constructor(private readonly preAuthService: PreAuthorizationService) {}

  @Get()
  @RequirePermissions('insurance.preauth.read')
  list(
    @CurrentUser('orgId') orgId: string,
    @Query('patientId') patientId?: string,
    @Query('encounterId') encounterId?: string,
    @Query('status') status?: PreAuthorizationStatus,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.preAuthService.list(orgId, {
      patientId,
      encounterId,
      status,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    })
  }

  @Get(':id')
  @RequirePermissions('insurance.preauth.read')
  getById(@CurrentUser('orgId') orgId: string, @Param('id') id: string) {
    return this.preAuthService.getById(orgId, id)
  }

  @Post()
  @RequirePermissions('insurance.preauth.create')
  create(@CurrentUser('orgId') orgId: string, @CurrentUser('sub') userId: string, @Body() dto: CreatePreAuthorizationDto) {
    return this.preAuthService.create(orgId, dto, userId)
  }

  @Post(':id/submit')
  @RequirePermissions('insurance.preauth.create')
  submit(@CurrentUser('orgId') orgId: string, @CurrentUser('sub') userId: string, @Param('id') id: string) {
    return this.preAuthService.submit(orgId, id, userId)
  }

  @Post(':id/review')
  @RequirePermissions('insurance.preauth.update')
  markUnderReview(@CurrentUser('orgId') orgId: string, @CurrentUser('sub') userId: string, @Param('id') id: string) {
    return this.preAuthService.markUnderReview(orgId, id, userId)
  }

  @Post(':id/decide')
  @RequirePermissions('insurance.preauth.update')
  decide(
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: DecidePreAuthorizationDto,
  ) {
    return this.preAuthService.decide(orgId, id, dto, userId)
  }

  @Post(':id/cancel')
  @RequirePermissions('insurance.preauth.update')
  cancel(
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: CancelPreAuthorizationDto,
  ) {
    return this.preAuthService.cancel(orgId, id, dto, userId)
  }

  @Post(':id/attachments')
  @ApiConsumes('multipart/form-data')
  @RequirePermissions('insurance.preauth.update')
  async uploadAttachment(
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Req() request: FastifyRequest,
  ) {
    const data = await request.file()
    if (!data) throw new BadRequestException('No file uploaded — send multipart/form-data')
    if (!ALLOWED_ATTACHMENT_MIME_TYPES.has(data.mimetype)) {
      throw new BadRequestException('Unsupported file type — allowed: PNG, JPEG, WEBP, PDF')
    }

    const buffer = await data.toBuffer()
    return this.preAuthService.uploadAttachment(
      orgId,
      id,
      { buffer, fileName: data.filename, mimeType: data.mimetype, size: buffer.length },
      userId,
    )
  }
}
