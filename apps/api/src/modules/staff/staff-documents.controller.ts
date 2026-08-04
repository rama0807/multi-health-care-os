import { JwtPayload, StaffDocumentType } from '@medicore/types'
import { BadRequestException, Controller, Delete, ForbiddenException, Get, Param, Post, Req } from '@nestjs/common'
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger'
import { FastifyRequest } from 'fastify'

import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { RequirePermissions } from '../../common/decorators/permissions.decorator'
import { PermissionsService } from '../../common/permissions/permissions.service'

import { StaffDocumentsService } from './staff-documents.service'
import { StaffRefService } from './staff-ref.service'

@ApiTags('staff-documents')
@ApiBearerAuth()
@Controller({ path: 'staff/:staffId/documents', version: '1' })
export class StaffDocumentsController {
  constructor(
    private readonly documentService: StaffDocumentsService,
    private readonly staffRef: StaffRefService,
    private readonly permissionsService: PermissionsService,
  ) {}

  @Get()
  @RequirePermissions('staff.documents.read')
  async list(
    @CurrentUser() user: JwtPayload,
    @CurrentUser('orgId') orgId: string,
    @Param('staffId') staffId: string,
  ) {
    await this.assertOwnScopeOk(orgId, staffId, user, 'read')
    return this.documentService.list(orgId, staffId)
  }

  @Post()
  @ApiConsumes('multipart/form-data')
  @RequirePermissions('staff.documents.manage')
  async upload(
    @CurrentUser() user: JwtPayload,
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Param('staffId') staffId: string,
    @Req() request: FastifyRequest,
  ) {
    await this.assertOwnScopeOk(orgId, staffId, user, 'manage')

    const data = await request.file()
    if (!data) throw new BadRequestException('No file uploaded — send multipart/form-data')

    const documentTypeField = data.fields.documentType as { value?: unknown } | undefined
    const documentType =
      typeof documentTypeField?.value === 'string' ? documentTypeField.value : undefined

    if (!documentType || !Object.values(StaffDocumentType).includes(documentType as StaffDocumentType)) {
      throw new BadRequestException('Missing or invalid "documentType" field')
    }

    const buffer = await data.toBuffer()

    return this.documentService.upload(
      orgId,
      staffId,
      documentType as StaffDocumentType,
      { buffer, fileName: data.filename, mimeType: data.mimetype, size: buffer.length },
      userId,
    )
  }

  @Delete(':documentId')
  @RequirePermissions('staff.documents.manage')
  async delete(
    @CurrentUser() user: JwtPayload,
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Param('staffId') staffId: string,
    @Param('documentId') documentId: string,
  ) {
    await this.assertOwnScopeOk(orgId, staffId, user, 'manage')
    await this.documentService.delete(orgId, staffId, documentId, userId)
    return { success: true }
  }

  private async assertOwnScopeOk(
    orgId: string,
    staffId: string,
    user: JwtPayload,
    action: string,
  ): Promise<void> {
    const scope = this.permissionsService.getScope(user, 'staff.documents', action)
    if (scope !== 'own') return

    const ownProfile = await this.staffRef.findStaffProfileForUser(orgId, user.sub)
    if (!ownProfile || ownProfile.id !== staffId) {
      throw new ForbiddenException('You can only access your own documents')
    }
  }
}
