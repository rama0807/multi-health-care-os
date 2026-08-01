import { Module } from '@nestjs/common'

import { AvailabilityController } from './availability.controller'
import { AvailabilityService } from './availability.service'
import { DoctorDocumentController } from './doctor-document.controller'
import { DoctorDocumentService } from './doctor-document.service'
import { DoctorLeaveController } from './doctor-leave.controller'
import { DoctorLeaveService } from './doctor-leave.service'
import { DoctorRefService } from './doctor-ref.service'
import { DoctorScheduleController } from './doctor-schedule.controller'
import { DoctorScheduleService } from './doctor-schedule.service'

@Module({
  controllers: [DoctorScheduleController, DoctorLeaveController, AvailabilityController, DoctorDocumentController],
  providers: [
    DoctorRefService,
    DoctorScheduleService,
    DoctorLeaveService,
    AvailabilityService,
    DoctorDocumentService,
  ],
  exports: [DoctorScheduleService, DoctorLeaveService, AvailabilityService, DoctorRefService],
})
export class SchedulingModule {}
