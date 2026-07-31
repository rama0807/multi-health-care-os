import { Module } from '@nestjs/common'

import { StaffOnboardingService } from './staff-onboarding.service'

@Module({
  providers: [StaffOnboardingService],
  exports: [StaffOnboardingService],
})
export class StaffOnboardingModule {}
