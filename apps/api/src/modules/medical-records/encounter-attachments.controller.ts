import { EncounterAttachmentType, JwtPayload } from '@medicore/types'
import { BadRequestException, Controller, Delete, Get, Param, Post, Req } from '@nestjs/common'
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger'
import { FastifyRequest } from 'fastify'

import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { RequirePermissions } from '../../common/decorators/permissions.decorator'

import { EncounterAttachmentsService } from './encounter-attachments.service'
import { EncountersService } from './encounters.service'

@ApiTags('encounter-attachments')
@ApiBearerAuth()
@Controller({ path: 'encounters/:encounterId/attachments', version: '1' })
export class EncounterAttachmentsController {
  constructor(
    private readonly attachmentsService: EncounterAttachmentsService,
    private readonly encountersService: EncountersService,
  ) {}

  @Get()
  @RequirePermissions('medical_records.read')
  async list(
    @CurrentUser() user: JwtPayload,
    @CurrentUser('orgId') orgId: string,
    @Param('encounterId') encounterId: string,
  ) {
    await this.encountersService.assertOwnScopeOk(orgId, encounterId, user, 'read')
    const attachments = await this.attachmentsService.list(orgId, encounterId)
    return { attachments }
  }

  @Post()
  @ApiConsumes('multipart/form-data')
  @RequirePermissions('medical_records.update')
  async upload(
    @CurrentUser() user: JwtPayload,
    @CurrentUser('orgId') orgId: string,
    @Param('encounterId') encounterId: string,
    @Req() request: FastifyRequest,
  ) {
    await this.encountersService.assertOwnScopeOk(orgId, encounterId, user, 'update')

    const data = await request.file()
    if (!data) throw new BadRequestException('No file uploaded — send multipart/form-data')

    const documentTypeField = data.fields.documentType as { value?: unknown } | undefined
    const documentType =
      typeof documentTypeField?.value === 'string' ? documentTypeField.value : undefined

    if (!documentType || !Object.values(EncounterAttachmentType).includes(documentType as EncounterAttachmentType)) {
      throw new BadRequestException('Missing or invalid "documentType" field')
    }

    const buffer = await data.toBuffer()

    return this.attachmentsService.upload(orgId, encounterId, documentType as EncounterAttachmentType, {
      buffer,
      fileName: data.filename,
      mimeType: data.mimetype,
      size: buffer.length,
    })
  }

  @Delete(':attachmentId')
  @RequirePermissions('medical_records.update')
  async delete(
    @CurrentUser() user: JwtPayload,
    @CurrentUser('orgId') orgId: string,
    @Param('encounterId') encounterId: string,
    @Param('attachmentId') attachmentId: string,
  ) {
    await this.encountersService.assertOwnScopeOk(orgId, encounterId, user, 'update')
    await this.attachmentsService.delete(orgId, encounterId, attachmentId)
    return { success: true }
  }
}
