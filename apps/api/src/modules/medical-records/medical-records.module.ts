import { Module } from '@nestjs/common'

import { SchedulingModule } from '../scheduling/scheduling.module'

import { ClinicalNotesController } from './clinical-notes.controller'
import { ClinicalNotesService } from './clinical-notes.service'
import { DiagnosesController } from './diagnoses.controller'
import { DiagnosesService } from './diagnoses.service'
import { EncounterAttachmentsController } from './encounter-attachments.controller'
import { EncounterAttachmentsService } from './encounter-attachments.service'
import { EncountersController } from './encounters.controller'
import { EncountersService } from './encounters.service'
import { ProceduresController } from './procedures.controller'
import { ProceduresService } from './procedures.service'
import { EncounterVitalsController, PatientVitalsController } from './vitals.controller'
import { VitalsService } from './vitals.service'

@Module({
  imports: [SchedulingModule],
  controllers: [
    EncountersController,
    ClinicalNotesController,
    EncounterVitalsController,
    PatientVitalsController,
    DiagnosesController,
    ProceduresController,
    EncounterAttachmentsController,
  ],
  providers: [
    EncountersService,
    ClinicalNotesService,
    VitalsService,
    DiagnosesService,
    ProceduresService,
    EncounterAttachmentsService,
  ],
  exports: [EncountersService],
})
export class MedicalRecordsModule {}
