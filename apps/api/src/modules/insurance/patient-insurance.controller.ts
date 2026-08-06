import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'

import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { RequirePermissions } from '../../common/decorators/permissions.decorator'

import { CreatePatientInsuranceDto } from './dto/create-patient-insurance.dto'
import { UpdatePatientInsuranceDto } from './dto/update-patient-insurance.dto'
import { PatientInsuranceService } from './patient-insurance.service'

/** Backs the frontend's "Patient Insurance Tab" - see ADR-0016. */
@ApiTags('insurance-patient-coverage')
@ApiBearerAuth()
@Controller({ path: 'insurance/patients/:patientId/coverages', version: '1' })
export class PatientInsuranceController {
  constructor(private readonly patientInsuranceService: PatientInsuranceService) {}

  @Get()
  @RequirePermissions('insurance.claims.read')
  list(@CurrentUser('orgId') orgId: string, @Param('patientId') patientId: string) {
    return this.patientInsuranceService.list(orgId, patientId)
  }

  @Get(':id')
  @RequirePermissions('insurance.claims.read')
  getById(@CurrentUser('orgId') orgId: string, @Param('patientId') patientId: string, @Param('id') id: string) {
    return this.patientInsuranceService.getById(orgId, patientId, id)
  }

  @Post()
  @RequirePermissions('insurance.claims.create')
  create(
    @CurrentUser('orgId') orgId: string,
    @Param('patientId') patientId: string,
    @Body() dto: CreatePatientInsuranceDto,
  ) {
    return this.patientInsuranceService.create(orgId, patientId, dto)
  }

  @Patch(':id')
  @RequirePermissions('insurance.claims.update')
  update(
    @CurrentUser('orgId') orgId: string,
    @Param('patientId') patientId: string,
    @Param('id') id: string,
    @Body() dto: UpdatePatientInsuranceDto,
  ) {
    return this.patientInsuranceService.update(orgId, patientId, id, dto)
  }
}
