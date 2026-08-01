import { Module } from '@nestjs/common'

import { StaffOnboardingModule } from '../../common/onboarding/staff-onboarding.module'
import { AuditModule } from '../audit/audit.module'
import { DepartmentsModule } from '../departments/departments.module'
import { HospitalsModule } from '../hospitals/hospitals.module'
import { SchedulingModule } from '../scheduling/scheduling.module'

import { DoctorsController } from './doctors.controller'
import { DoctorsService } from './doctors.service'

@Module({
  imports: [StaffOnboardingModule, HospitalsModule, DepartmentsModule, SchedulingModule, AuditModule],
  controllers: [DoctorsController],
  providers: [DoctorsService],
  exports: [DoctorsService],
})
export class DoctorsModule {}
