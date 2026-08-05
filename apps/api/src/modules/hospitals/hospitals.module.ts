import { Module } from '@nestjs/common'

import { StaffOnboardingModule } from '../../common/onboarding/staff-onboarding.module'
import { AuditModule } from '../audit/audit.module'

import { HospitalsController } from './hospitals.controller'
import { HospitalsService } from './hospitals.service'

@Module({
  imports: [AuditModule, StaffOnboardingModule],
  controllers: [HospitalsController],
  providers: [HospitalsService],
  exports: [HospitalsService],
})
export class HospitalsModule {}
