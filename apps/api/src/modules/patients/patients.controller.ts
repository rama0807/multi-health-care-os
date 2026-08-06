import { DuplicateCheckSchema, PatientSearchQuery } from '@medicore/types'
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common'
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger'
import { DocumentType } from '@prisma/client'
import { FastifyRequest } from 'fastify'

import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { RequirePermissions } from '../../common/decorators/permissions.decorator'

import { CreatePatientDto } from './dto/create-patient.dto'
import { LinkFamilyMemberDto } from './dto/link-family-member.dto'
import { MergePatientsDto } from './dto/merge-patients.dto'
import { UpdatePatientDto } from './dto/update-patient.dto'
import { PatientsService } from './patients.service'

@ApiTags('patients')
@ApiBearerAuth()
@Controller({ path: 'patients', version: '1' })
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  @Get()
  @RequirePermissions('patients.read')
  list(
    @CurrentUser('orgId') orgId: string,
    @Query('q') q?: string,
    @Query('uhid') uhid?: string,
    @Query('phone') phone?: string,
    @Query('dob') dob?: string,
    @Query('gender') gender?: PatientSearchQuery['gender'],
    @Query('isActive') isActive?: string,
    @Query('sortBy') sortBy?: PatientSearchQuery['sortBy'],
    @Query('sortOrder') sortOrder?: PatientSearchQuery['sortOrder'],
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.patientsService.list(orgId, {
      q,
      uhid,
      phone,
      dob,
      gender,
      isActive: isActive === undefined ? undefined : isActive !== 'false',
      sortBy,
      sortOrder,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    })
  }

  /** Alias of GET /patients - kept as its own documented route since search-by
   *  name/phone/UHID/DOB is a distinct product capability even though the
   *  underlying query is identical to the general list endpoint. */
  @Get('search')
  @RequirePermissions('patients.read')
  search(
    @CurrentUser('orgId') orgId: string,
    @Query('q') q?: string,
    @Query('uhid') uhid?: string,
    @Query('phone') phone?: string,
    @Query('dob') dob?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.patientsService.list(orgId, {
      q,
      uhid,
      phone,
      dob,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    })
  }

  @Get('duplicates/check')
  @RequirePermissions('patients.read')
  async checkDuplicates(
    @CurrentUser('orgId') orgId: string,
    @Query('firstName') firstName?: string,
    @Query('lastName') lastName?: string,
    @Query('phone') phone?: string,
    @Query('dateOfBirth') dateOfBirth?: string,
  ) {
    const parsed = DuplicateCheckSchema.safeParse({ firstName, lastName, phone, dateOfBirth })
    if (!parsed.success) {
      throw new BadRequestException({
        message: 'Invalid duplicate-check query',
        errors: parsed.error.flatten(),
      })
    }

    const matches = await this.patientsService.checkDuplicates(orgId, parsed.data)
    return { matches }
  }

  @Get('duplicates/recent')
  @RequirePermissions('patients.read')
  async recentDuplicateAlerts(@CurrentUser('orgId') orgId: string, @Query('limit') limit?: string) {
    const alerts = await this.patientsService.listRecentDuplicateAlerts(orgId, limit ? Number(limit) : undefined)
    return { alerts }
  }

  @Get('stats/today-registrations')
  @RequirePermissions('patients.read')
  async todayRegistrations(@CurrentUser('orgId') orgId: string) {
    const count = await this.patientsService.countRegisteredToday(orgId)
    return { count }
  }

  @Get(':id')
  @RequirePermissions('patients.read')
  getById(@CurrentUser('orgId') orgId: string, @Param('id') id: string) {
    return this.patientsService.getById(orgId, id)
  }

  @Get(':id/timeline')
  @RequirePermissions('patients.read')
  async getTimeline(
    @CurrentUser('orgId') orgId: string,
    @Param('id') id: string,
    @Query('limit') limit?: string,
  ) {
    const entries = await this.patientsService.getTimeline(orgId, id, limit ? Number(limit) : undefined)
    return { entries }
  }

  @Get(':id/documents')
  @RequirePermissions('patients.read')
  listDocuments(@CurrentUser('orgId') orgId: string, @Param('id') id: string) {
    return this.patientsService.listDocuments(orgId, id)
  }

  @Get(':id/family')
  @RequirePermissions('patients.read')
  getFamily(@CurrentUser('orgId') orgId: string, @Param('id') id: string) {
    return this.patientsService.listFamilyMembers(orgId, id)
  }

  @Post()
  @RequirePermissions('patients.create')
  create(
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Body() dto: CreatePatientDto,
  ) {
    return this.patientsService.create(orgId, dto, userId)
  }

  @Post('merge')
  @RequirePermissions('patients.manage')
  merge(
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Body() dto: MergePatientsDto,
  ) {
    return this.patientsService.mergePatients(orgId, dto.sourcePatientId, dto.targetPatientId, userId)
  }

  @Post('import')
  @ApiConsumes('multipart/form-data')
  @RequirePermissions('patients.manage')
  async importCsv(
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Req() request: FastifyRequest,
  ) {
    const data = await request.file()
    if (!data) throw new BadRequestException('No file uploaded - send multipart/form-data with a "file" field')

    const buffer = await data.toBuffer()
    return this.patientsService.importFromCsv(orgId, buffer, userId)
  }

  @Post(':id/documents')
  @ApiConsumes('multipart/form-data')
  @RequirePermissions('patients.update')
  async uploadDocument(
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Req() request: FastifyRequest,
  ) {
    const data = await request.file()
    if (!data) throw new BadRequestException('No file uploaded - send multipart/form-data')

    const documentTypeField = data.fields.documentType as { value?: unknown } | undefined
    const documentType =
      typeof documentTypeField?.value === 'string' ? documentTypeField.value : undefined

    if (!documentType || !Object.values(DocumentType).includes(documentType as DocumentType)) {
      throw new BadRequestException('Missing or invalid "documentType" field')
    }

    const buffer = await data.toBuffer()

    return this.patientsService.uploadDocument(
      orgId,
      id,
      documentType as DocumentType,
      { buffer, fileName: data.filename, mimeType: data.mimetype, size: buffer.length },
      userId,
    )
  }

  @Patch(':id')
  @RequirePermissions('patients.update')
  update(
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdatePatientDto,
  ) {
    return this.patientsService.update(orgId, id, dto, userId)
  }

  @Patch(':id/family')
  @RequirePermissions('patients.update')
  linkFamily(
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: LinkFamilyMemberDto,
  ) {
    return this.patientsService.linkFamilyMember(orgId, id, dto.headOfFamilyId, userId)
  }

  @Delete(':id/family')
  @RequirePermissions('patients.update')
  unlinkFamily(
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
  ) {
    return this.patientsService.unlinkFamilyMember(orgId, id, userId)
  }

  @Post(':id/restore')
  @RequirePermissions('patients.update')
  restore(
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
  ) {
    return this.patientsService.restore(orgId, id, userId)
  }

  @Delete(':id')
  @RequirePermissions('patients.delete')
  softDelete(
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
  ) {
    return this.patientsService.softDelete(orgId, id, userId)
  }

  @Delete(':id/documents/:docId')
  @RequirePermissions('patients.update')
  async deleteDocument(
    @CurrentUser('orgId') orgId: string,
    @Param('id') id: string,
    @Param('docId') docId: string,
  ) {
    await this.patientsService.deleteDocument(orgId, id, docId)
    return { success: true }
  }
}
