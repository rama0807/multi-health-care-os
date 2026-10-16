/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common'
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger'
import { DentalLabCaseStatus } from '@prisma/client'
import { FastifyRequest } from 'fastify'

import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { RequirePermissions } from '../../common/decorators/permissions.decorator'
import { DentalGuard } from '../../common/guards/dental.guard'
import { StaffService } from '../staff/staff.service'

import { DentalDashboardService } from './dental-dashboard.service'
import { DentalService } from './dental.service'
import {
  CreateDentalChairDto,
  CreateDentalClinicalNoteDto,
  CreateDentalEncounterDto,
  CreateDentalImagingRecordDto,
  CreateDentalMedicalHistoryDto,
  CreateDentalPatientProfileDto,
  CreateDentalProcedureDto,
  CreateDentalRecallDto,
  CreateDentalSafetyAlertDto,
  CreateDentalStaffDto,
  CreateDentalVendorDto,
  CreateLabCaseDto,
  CreateOdontogramDto,
  CreateTreatmentPlanDto,
  RecordAcceptanceDto,
  UpdateDentalChairDto,
  UpdateDentalClinicalNoteDto,
  UpdateDentalEncounterDto,
  UpdateDentalPatientProfileDto,
  UpdateDentalVendorDto,
  UpdateLabCaseStatusDto,
} from './dto'



/**
 * REST API controller for Grovyn Dental OS.
 *
 * All routes are guarded by `DentalGuard` which rejects requests from
 * non-DENTAL organizations. The `@RequirePermissions` decorator enforces
 * fine-grained dental permission checks.
 *
 * Routes are version-prefixed as `v1/dental/*` to avoid any collision with
 * existing Hospital endpoints.
 */
@ApiTags('dental')
@ApiBearerAuth()
@UseGuards(DentalGuard)
@Controller({ path: 'dental', version: '1' })
export class DentalController {
  constructor(
    private readonly dentalService: DentalService,
    private readonly staffService: StaffService,
    private readonly dashboardService: DentalDashboardService,
  ) { }

  // ─── Dashboard ──────────────────────────────────────────────────────────

  @Get('dashboard/summary')
  @ApiOperation({ summary: 'Get dental dashboard summary metrics' })
  @RequirePermissions('dental_patients.read')
  getDashboardSummary(@CurrentUser('orgId') orgId: string) {
    return this.dashboardService.getDashboardSummary(orgId)
  }

  // ─── Patient Profile ────────────────────────────────────────────────────

  @Get('patients/:patientId/profile')
  @ApiOperation({ summary: 'Get dental profile for a patient' })
  @RequirePermissions('dental_patients.read')
  getPatientProfile(
    @CurrentUser('orgId') orgId: string,
    @Param('patientId') patientId: string,
  ) {
    return this.dentalService.getPatientProfile(orgId, patientId)
  }

  @Post('patients/:patientId/profile')
  @ApiOperation({ summary: 'Create dental profile for a patient' })
  @RequirePermissions('dental_patients.create')
  createPatientProfile(
    @CurrentUser('orgId') orgId: string,
    @Body() dto: CreateDentalPatientProfileDto,
  ) {
    return this.dentalService.createPatientProfile(orgId, dto)
  }

  @Patch('patients/:patientId/profile')
  @ApiOperation({ summary: 'Update dental profile for a patient' })
  @RequirePermissions('dental_patients.update')
  updatePatientProfile(
    @CurrentUser('orgId') orgId: string,
    @Param('patientId') patientId: string,
    @Body() dto: UpdateDentalPatientProfileDto,
  ) {
    return this.dentalService.updatePatientProfile(orgId, patientId, dto)
  }

  // ─── Medical History & Safety Alerts ──────────────────────────────────────

  @Post('patients/:patientId/medical-history')
  @ApiOperation({ summary: 'Create a new medical history record' })
  @RequirePermissions('dental_patients.update')
  createMedicalHistory(
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Param('patientId') patientId: string,
    @Body() dto: CreateDentalMedicalHistoryDto,
  ) {
    return this.dentalService.createMedicalHistory(orgId, userId, { ...dto, patientId })
  }

  @Post('patients/:patientId/safety-alerts')
  @ApiOperation({ summary: 'Create a safety alert for a patient' })
  @RequirePermissions('dental_patients.update')
  createSafetyAlert(
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Param('patientId') patientId: string,
    @Body() dto: CreateDentalSafetyAlertDto,
  ) {
    return this.dentalService.createSafetyAlert(orgId, userId, { ...dto, patientId })
  }

  // ─── Imaging & CBCT/RVG ─────────────────────────────────────────────────

  @Get('patients/:patientId/imaging')
  @ApiOperation({ summary: 'Get imaging records for a patient' })
  @RequirePermissions('dental_patients.read')
  listImagingRecords(
    @CurrentUser('orgId') orgId: string,
    @Param('patientId') patientId: string,
  ) {
    return this.dentalService.listImagingRecords(orgId, patientId)
  }

  @Post('patients/:patientId/imaging')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload a new imaging record' })
  @RequirePermissions('dental_patients.update')
  async createImagingRecord(
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Param('patientId') patientId: string,
    @Req() request: FastifyRequest,
  ) {
    const data = await request.file()
    if (!data) throw new BadRequestException('No file uploaded - send multipart/form-data')

    const imagingTypeField = data.fields.imagingType as { value?: unknown } | undefined
    const titleField = data.fields.title as { value?: unknown } | undefined
    const encounterIdField = data.fields.encounterId as { value?: unknown } | undefined
    const notesField = data.fields.notes as { value?: unknown } | undefined

    const imagingType = typeof imagingTypeField?.value === 'string' ? imagingTypeField.value : 'OTHER'
    const title = typeof titleField?.value === 'string' ? titleField.value : undefined
    const encounterId = typeof encounterIdField?.value === 'string' ? encounterIdField.value : undefined
    const notes = typeof notesField?.value === 'string' ? notesField.value : undefined

    const buffer = await data.toBuffer()

    return this.dentalService.uploadImagingRecord(orgId, userId, patientId, {
      imagingType,
      title,
      encounterId,
      notes,
    } as CreateDentalImagingRecordDto, {
      buffer,
      fileName: data.filename,
      mimeType: data.mimetype,
      size: buffer.length
    })
  }

  // ─── Ledger / Billing ───────────────────────────────────────────────────

  @Get('patients/:patientId/ledger')
  @ApiOperation({ summary: 'Get patient ledger/invoices' })
  @RequirePermissions('dental_patients.read')
  listLedger(
    @CurrentUser('orgId') orgId: string,
    @Param('patientId') patientId: string,
  ) {
    return this.dentalService.listLedger(orgId, patientId)
  }

  // ─── Chairs ─────────────────────────────────────────────────────────────

  @Get('chairs')
  @ApiOperation({ summary: 'List all dental chairs' })
  @RequirePermissions('appointments.read')
  listChairs(@CurrentUser('orgId') orgId: string) {
    return this.dentalService.listChairs(orgId)
  }

  @Post('chairs')
  @ApiOperation({ summary: 'Create a dental chair' })
  @RequirePermissions('appointments.create')
  createChair(
    @CurrentUser('orgId') orgId: string,
    @Body() dto: CreateDentalChairDto,
  ) {
    return this.dentalService.createChair(orgId, dto)
  }

  @Patch('chairs/:id')
  @ApiOperation({ summary: 'Update a dental chair' })
  @RequirePermissions('appointments.update')
  updateChair(
    @CurrentUser('orgId') orgId: string,
    @Param('id') id: string,
    @Body() dto: UpdateDentalChairDto,
  ) {
    return this.dentalService.updateChair(orgId, id, dto)
  }

  // ─── Encounters ─────────────────────────────────────────────────────────

  @Get('encounters')
  @ApiOperation({ summary: 'List dental encounters' })
  @RequirePermissions('dental_encounters.read')
  listEncounters(
    @CurrentUser('orgId') orgId: string,
    @Query('patientId') patientId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.dentalService.listEncounters(
      orgId,
      patientId,
      page ? Number(page) : undefined,
      limit ? Number(limit) : undefined,
    )
  }

  @Get('encounters/:id')
  @ApiOperation({ summary: 'Get dental encounter details' })
  @RequirePermissions('dental_encounters.read')
  getEncounter(
    @CurrentUser('orgId') orgId: string,
    @Param('id') id: string,
  ) {
    return this.dentalService.getEncounter(orgId, id)
  }

  @Post('encounters')
  @ApiOperation({ summary: 'Create a dental encounter' })
  @RequirePermissions('dental_encounters.create')
  createEncounter(
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateDentalEncounterDto,
  ) {
    return this.dentalService.createEncounter(orgId, userId, dto)
  }

  @Patch('encounters/:id')
  @ApiOperation({ summary: 'Update a dental encounter' })
  @RequirePermissions('dental_encounters.update')
  updateEncounter(
    @CurrentUser('orgId') orgId: string,
    @Param('id') id: string,
    @Body() dto: UpdateDentalEncounterDto,
  ) {
    return this.dentalService.updateEncounter(orgId, id, dto)
  }

  // ─── Clinical Notes ─────────────────────────────────────────────────────

  @Post('clinical-notes')
  @ApiOperation({ summary: 'Create a clinical note (SOAP)' })
  @RequirePermissions('dental_encounters.create')
  createClinicalNote(
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateDentalClinicalNoteDto,
  ) {
    return this.dentalService.createClinicalNote(orgId, userId, dto)
  }

  @Patch('clinical-notes/:id')
  @ApiOperation({ summary: 'Update a clinical note' })
  @RequirePermissions('dental_encounters.update')
  updateClinicalNote(
    @CurrentUser('orgId') orgId: string,
    @Param('id') id: string,
    @Body() dto: UpdateDentalClinicalNoteDto,
  ) {
    return this.dentalService.updateClinicalNote(orgId, id, dto)
  }

  @Post('clinical-notes/:id/sign')
  @ApiOperation({ summary: 'Sign (lock) a clinical note' })
  @RequirePermissions('dental_encounters.update')
  signClinicalNote(
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
  ) {
    return this.dentalService.signClinicalNote(orgId, id, userId)
  }

  // ─── Odontogram ─────────────────────────────────────────────────────────

  @Get('odontogram/:patientId')
  @ApiOperation({ summary: 'Get latest odontogram for patient' })
  @RequirePermissions('dental_odontogram.read')
  getLatestOdontogram(
    @CurrentUser('orgId') orgId: string,
    @Param('patientId') patientId: string,
  ) {
    return this.dentalService.getLatestOdontogram(orgId, patientId)
  }

  @Post('odontogram')
  @ApiOperation({ summary: 'Create/snapshot odontogram' })
  @RequirePermissions('dental_odontogram.update')
  createOdontogram(
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateOdontogramDto,
  ) {
    return this.dentalService.createOdontogram(orgId, userId, dto)
  }

  @Get('tooth-history/:patientId/:toothNumber')
  @ApiOperation({ summary: 'Get longitudinal history for a specific tooth' })
  @RequirePermissions('dental_odontogram.read')
  getToothHistory(
    @CurrentUser('orgId') orgId: string,
    @Param('patientId') patientId: string,
    @Param('toothNumber') toothNumber: string,
  ) {
    return this.dentalService.getToothHistory(orgId, patientId, Number(toothNumber))
  }

  // ─── Treatment Plans ────────────────────────────────────────────────────

  @Get('treatment-plans')
  @ApiOperation({ summary: 'List treatment plans' })
  @RequirePermissions('dental_treatment_plans.read')
  listTreatmentPlans(
    @CurrentUser('orgId') orgId: string,
    @Query('patientId') patientId?: string,
  ) {
    return this.dentalService.listTreatmentPlans(orgId, patientId)
  }

  @Get('treatment-plans/:id')
  @ApiOperation({ summary: 'Get treatment plan with options and items' })
  @RequirePermissions('dental_treatment_plans.read')
  getTreatmentPlan(
    @CurrentUser('orgId') orgId: string,
    @Param('id') id: string,
  ) {
    return this.dentalService.getTreatmentPlan(orgId, id)
  }

  @Post('treatment-plans')
  @ApiOperation({ summary: 'Create a treatment plan with options and line items' })
  @RequirePermissions('dental_treatment_plans.create')
  createTreatmentPlan(
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateTreatmentPlanDto,
  ) {
    return this.dentalService.createTreatmentPlan(orgId, userId, dto)
  }

  @Post('treatment-plans/acceptance')
  @ApiOperation({ summary: 'Record patient acceptance/decline of a treatment plan option' })
  @RequirePermissions('dental_treatment_plans.update')
  recordAcceptance(
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Body() dto: RecordAcceptanceDto,
    @Query('patientId') patientId: string,
  ) {
    return this.dentalService.recordAcceptance(orgId, userId, patientId, dto)
  }

  // ─── Procedures ─────────────────────────────────────────────────────────

  @Get('procedures')
  @ApiOperation({ summary: 'List dental procedures' })
  @RequirePermissions('dental_encounters.read')
  listProcedures(
    @CurrentUser('orgId') orgId: string,
    @Query('patientId') patientId?: string,
    @Query('encounterId') encounterId?: string,
  ) {
    return this.dentalService.listProcedures(orgId, patientId, encounterId)
  }

  @Post('procedures')
  @ApiOperation({ summary: 'Record a dental procedure' })
  @RequirePermissions('dental_encounters.create')
  createProcedure(
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateDentalProcedureDto,
  ) {
    return this.dentalService.createProcedure(orgId, userId, dto)
  }

  // ─── Vendors ────────────────────────────────────────────────────────────

  @Get('vendors')
  @ApiOperation({ summary: 'List dental vendors' })
  @RequirePermissions('dental_vendors.read')
  listVendors(@CurrentUser('orgId') orgId: string) {
    return this.dentalService.listVendors(orgId)
  }

  @Get('vendors/:id')
  @ApiOperation({ summary: 'Get vendor details' })
  @RequirePermissions('dental_vendors.read')
  getVendor(
    @CurrentUser('orgId') orgId: string,
    @Param('id') id: string,
  ) {
    return this.dentalService.getVendor(orgId, id)
  }

  @Post('vendors')
  @ApiOperation({ summary: 'Create a dental vendor' })
  @RequirePermissions('dental_vendors.create')
  createVendor(
    @CurrentUser('orgId') orgId: string,
    @Body() dto: CreateDentalVendorDto,
  ) {
    return this.dentalService.createVendor(orgId, dto)
  }

  @Patch('vendors/:id')
  @ApiOperation({ summary: 'Update a dental vendor' })
  @RequirePermissions('dental_vendors.update')
  updateVendor(
    @CurrentUser('orgId') orgId: string,
    @Param('id') id: string,
    @Body() dto: UpdateDentalVendorDto,
  ) {
    return this.dentalService.updateVendor(orgId, id, dto)
  }

  // ─── Lab Cases ──────────────────────────────────────────────────────────

  @Get('lab-cases')
  @ApiOperation({ summary: 'List lab cases' })
  @RequirePermissions('dental_lab_cases.read')
  listLabCases(
    @CurrentUser('orgId') orgId: string,
    @Query('patientId') patientId?: string,
    @Query('status') status?: DentalLabCaseStatus,
  ) {
    return this.dentalService.listLabCases(orgId, patientId, status)
  }

  @Get('lab-cases/:id')
  @ApiOperation({ summary: 'Get lab case with full timeline' })
  @RequirePermissions('dental_lab_cases.read')
  getLabCase(
    @CurrentUser('orgId') orgId: string,
    @Param('id') id: string,
  ) {
    return this.dentalService.getLabCase(orgId, id)
  }

  @Post('lab-cases')
  @ApiOperation({ summary: 'Create a lab case' })
  @RequirePermissions('dental_lab_cases.create')
  createLabCase(
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateLabCaseDto,
  ) {
    return this.dentalService.createLabCase(orgId, userId, dto)
  }

  @Patch('lab-cases/:id/status')
  @ApiOperation({ summary: 'Update lab case status (creates timeline entry)' })
  @RequirePermissions('dental_lab_cases.update')
  updateLabCaseStatus(
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateLabCaseStatusDto,
  ) {
    return this.dentalService.updateLabCaseStatus(orgId, id, userId, dto)
  }

  // ─── Recalls ────────────────────────────────────────────────────────────

  @Get('recalls')
  @ApiOperation({ summary: 'List dental recalls' })
  @RequirePermissions('dental_recalls.read')
  listRecalls(
    @CurrentUser('orgId') orgId: string,
    @Query('patientId') patientId?: string,
  ) {
    return this.dentalService.listRecalls(orgId, patientId)
  }

  @Post('recalls')
  @ApiOperation({ summary: 'Create a dental recall' })
  @RequirePermissions('dental_recalls.create')
  createRecall(
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateDentalRecallDto,
  ) {
    return this.dentalService.createRecall(orgId, userId, dto)
  }


  // ─── Staff ─────────────────────────────────────────────────────────────

  /** Create staff member for dental organization (auto-resolves facility & roles) */
  @Post('staff')
  @ApiOperation({ summary: 'Create a dental staff member' })
  @RequirePermissions('staff.create')
  createStaff(
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateDentalStaffDto,
  ) {
    return this.staffService.create(orgId, dto as any, userId)
  }
}

