import { Module } from '@nestjs/common'

import { BillingModule } from '../billing/billing.module'
import { MedicalRecordsModule } from '../medical-records/medical-records.module'
import { SchedulingModule } from '../scheduling/scheduling.module'

import { AdmissionsController } from './admissions.controller'
import { AdmissionsService } from './admissions.service'
import { BedAllocationController } from './bed-allocation.controller'
import { BedAllocationService } from './bed-allocation.service'
import { BedsController } from './beds.controller'
import { BedsService } from './beds.service'
import { DischargeController } from './discharge.controller'
import { DischargeService } from './discharge.service'
import { IntakeOutputController } from './intake-output.controller'
import { IntakeOutputService } from './intake-output.service'
import { IpdDashboardController } from './ipd-dashboard.controller'
import { IpdDashboardService } from './ipd-dashboard.service'
import { IpdOrdersController } from './ipd-orders.controller'
import { IpdOrdersService } from './ipd-orders.service'
import { MedicationAdministrationController } from './medication-administration.controller'
import { MedicationAdministrationService } from './medication-administration.service'
import { NursingAssessmentsController } from './nursing-assessments.controller'
import { NursingAssessmentsService } from './nursing-assessments.service'
import { NursingNotesController } from './nursing-notes.controller'
import { NursingNotesService } from './nursing-notes.service'
import { NursingTasksController } from './nursing-tasks.controller'
import { NursingTasksService } from './nursing-tasks.service'
import { RoomsController } from './rooms.controller'
import { RoomsService } from './rooms.service'
import { WardsController } from './wards.controller'
import { WardsService } from './wards.service'

@Module({
  imports: [SchedulingModule, MedicalRecordsModule, BillingModule],
  controllers: [
    WardsController,
    RoomsController,
    BedsController,
    AdmissionsController,
    BedAllocationController,
    IpdDashboardController,
    NursingNotesController,
    NursingAssessmentsController,
    IntakeOutputController,
    IpdOrdersController,
    NursingTasksController,
    MedicationAdministrationController,
    DischargeController,
  ],
  providers: [
    WardsService,
    RoomsService,
    BedsService,
    AdmissionsService,
    BedAllocationService,
    IpdDashboardService,
    NursingNotesService,
    NursingAssessmentsService,
    IntakeOutputService,
    IpdOrdersService,
    NursingTasksService,
    MedicationAdministrationService,
    DischargeService,
  ],
  exports: [WardsService, RoomsService, BedsService, AdmissionsService],
})
export class IpdModule {}
