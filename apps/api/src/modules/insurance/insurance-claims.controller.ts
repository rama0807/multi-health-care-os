import { InsuranceClaimQuery, InsuranceClaimStatus } from '@medicore/types'
import { BadRequestException, Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common'
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger'
import { FastifyRequest } from 'fastify'

import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { RequirePermissions } from '../../common/decorators/permissions.decorator'

import { CloseClaimDto } from './dto/close-claim.dto'
import { CreateInsuranceClaimDto } from './dto/create-insurance-claim.dto'
import { DecideClaimDto } from './dto/decide-claim.dto'
import { SettleClaimDto } from './dto/settle-claim.dto'
import { UploadClaimDocumentMetaDto } from './dto/upload-claim-document-meta.dto'
import { InsuranceClaimsService } from './insurance-claims.service'

const ALLOWED_UPLOAD_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'application/pdf'])

@ApiTags('insurance-claims')
@ApiBearerAuth()
@Controller({ path: 'insurance/claims', version: '1' })
export class InsuranceClaimsController {
  constructor(private readonly claimsService: InsuranceClaimsService) {}

  @Get()
  @RequirePermissions('insurance.claims.read')
  list(
    @CurrentUser('orgId') orgId: string,
    @Query('patientId') patientId?: string,
    @Query('encounterId') encounterId?: string,
    @Query('status') status?: InsuranceClaimStatus,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('sortBy') sortBy?: InsuranceClaimQuery['sortBy'],
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
  ) {
    return this.claimsService.list(orgId, {
      patientId,
      encounterId,
      status,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      sortBy,
      sortOrder,
    })
  }

  @Get(':id')
  @RequirePermissions('insurance.claims.read')
  getById(@CurrentUser('orgId') orgId: string, @Param('id') id: string) {
    return this.claimsService.getById(orgId, id)
  }

  @Post()
  @RequirePermissions('insurance.claims.create')
  create(@CurrentUser('orgId') orgId: string, @CurrentUser('sub') userId: string, @Body() dto: CreateInsuranceClaimDto) {
    return this.claimsService.create(orgId, dto, userId)
  }

  @Post(':id/submit')
  @RequirePermissions('insurance.claims.create')
  submit(@CurrentUser('orgId') orgId: string, @CurrentUser('sub') userId: string, @Param('id') id: string) {
    return this.claimsService.submit(orgId, id, userId)
  }

  @Post(':id/review')
  @RequirePermissions('insurance.claims.update')
  markUnderReview(@CurrentUser('orgId') orgId: string, @CurrentUser('sub') userId: string, @Param('id') id: string) {
    return this.claimsService.markUnderReview(orgId, id, userId)
  }

  @Post(':id/decide')
  @RequirePermissions('insurance.claims.update')
  decide(
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: DecideClaimDto,
  ) {
    return this.claimsService.decide(orgId, id, dto, userId)
  }

  @Post(':id/settle')
  @RequirePermissions('insurance.settlement.manage')
  settle(
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: SettleClaimDto,
  ) {
    return this.claimsService.settle(orgId, id, dto, userId)
  }

  @Post(':id/close')
  @RequirePermissions('insurance.claims.update')
  close(@CurrentUser('orgId') orgId: string, @CurrentUser('sub') userId: string, @Param('id') id: string, @Body() _dto: CloseClaimDto) {
    return this.claimsService.close(orgId, id, userId)
  }

  @Post(':id/documents')
  @ApiConsumes('multipart/form-data')
  @RequirePermissions('insurance.claims.update')
  async uploadDocument(
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Req() request: FastifyRequest,
  ) {
    const data = await request.file()
    if (!data) throw new BadRequestException('No file uploaded — send multipart/form-data')
    if (!ALLOWED_UPLOAD_MIME_TYPES.has(data.mimetype)) {
      throw new BadRequestException('Unsupported file type — allowed: PNG, JPEG, WEBP, PDF')
    }

    const typeField = data.fields.type as { value?: unknown } | undefined
    const meta: UploadClaimDocumentMetaDto = {
      type: typeof typeField?.value === 'string' ? (typeField.value as UploadClaimDocumentMetaDto['type']) : undefined,
    } as UploadClaimDocumentMetaDto

    const buffer = await data.toBuffer()
    return this.claimsService.uploadDocument(
      orgId,
      id,
      meta,
      { buffer, fileName: data.filename, mimeType: data.mimetype, size: buffer.length },
      userId,
    )
  }
}
