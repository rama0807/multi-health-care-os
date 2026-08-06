import { DoctorDocumentType, JwtPayload } from '@medicore/types'
import {
  BadRequestException,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Post,
  Req,
} from '@nestjs/common'
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger'
import { FastifyRequest } from 'fastify'

import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { RequirePermissions } from '../../common/decorators/permissions.decorator'
import { PermissionsService } from '../../common/permissions/permissions.service'

import { DoctorDocumentService } from './doctor-document.service'
import { DoctorRefService } from './doctor-ref.service'

@ApiTags('doctor-documents')
@ApiBearerAuth()
@Controller({ path: 'doctors/:doctorId/documents', version: '1' })
export class DoctorDocumentController {
  constructor(
    private readonly documentService: DoctorDocumentService,
    private readonly doctorRef: DoctorRefService,
    private readonly permissionsService: PermissionsService,
  ) {}

  @Get()
  @RequirePermissions('doctors.documents.read')
  async list(
    @CurrentUser() user: JwtPayload,
    @CurrentUser('orgId') orgId: string,
    @Param('doctorId') doctorId: string,
  ) {
    await this.assertOwnScopeOk(orgId, doctorId, user, 'read')
    return this.documentService.list(orgId, doctorId)
  }

  @Post()
  @ApiConsumes('multipart/form-data')
  @RequirePermissions('doctors.documents.manage')
  async upload(
    @CurrentUser() user: JwtPayload,
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Param('doctorId') doctorId: string,
    @Req() request: FastifyRequest,
  ) {
    await this.assertOwnScopeOk(orgId, doctorId, user, 'manage')

    const data = await request.file()
    if (!data) throw new BadRequestException('No file uploaded - send multipart/form-data')

    const documentTypeField = data.fields.documentType as { value?: unknown } | undefined
    const documentType =
      typeof documentTypeField?.value === 'string' ? documentTypeField.value : undefined

    if (!documentType || !Object.values(DoctorDocumentType).includes(documentType as DoctorDocumentType)) {
      throw new BadRequestException('Missing or invalid "documentType" field')
    }

    const buffer = await data.toBuffer()

    return this.documentService.upload(
      orgId,
      doctorId,
      documentType as DoctorDocumentType,
      { buffer, fileName: data.filename, mimeType: data.mimetype, size: buffer.length },
      userId,
    )
  }

  @Delete(':documentId')
  @RequirePermissions('doctors.documents.manage')
  async delete(
    @CurrentUser() user: JwtPayload,
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Param('doctorId') doctorId: string,
    @Param('documentId') documentId: string,
  ) {
    await this.assertOwnScopeOk(orgId, doctorId, user, 'manage')
    await this.documentService.delete(orgId, doctorId, documentId, userId)
    return { success: true }
  }

  private async assertOwnScopeOk(
    orgId: string,
    doctorId: string,
    user: JwtPayload,
    action: string,
  ): Promise<void> {
    const scope = this.permissionsService.getScope(user, 'doctors.documents', action)
    if (scope !== 'own') return

    const ownProfile = await this.doctorRef.findDoctorProfileForUser(orgId, user.sub)
    if (!ownProfile || ownProfile.id !== doctorId) {
      throw new ForbiddenException('You can only access your own documents')
    }
  }
}
