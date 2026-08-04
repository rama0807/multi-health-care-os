import { Module } from '@nestjs/common'

import { BillingModule } from '../billing/billing.module'
import { LaboratoryModule } from '../laboratory/laboratory.module'
import { MedicalRecordsModule } from '../medical-records/medical-records.module'
import { PrescriptionsModule } from '../prescriptions/prescriptions.module'
import { RadiologyModule } from '../radiology/radiology.module'

import { ClaimDocumentsService } from './claim-documents.service'
import { InsuranceClaimsController } from './insurance-claims.controller'
import { InsuranceClaimsService } from './insurance-claims.service'
import { InsuranceDashboardService } from './insurance-dashboard.service'
import { InsurancePlansController } from './insurance-plans.controller'
import { InsurancePlansService } from './insurance-plans.service'
import { InsuranceProvidersController } from './insurance-providers.controller'
import { InsuranceProvidersService } from './insurance-providers.service'
import { InsuranceController } from './insurance.controller'
import { PatientInsuranceController } from './patient-insurance.controller'
import { PatientInsuranceService } from './patient-insurance.service'
import { PreAuthorizationController } from './pre-authorization.controller'
import { PreAuthorizationService } from './pre-authorization.service'

@Module({
  imports: [MedicalRecordsModule, BillingModule, LaboratoryModule, RadiologyModule, PrescriptionsModule],
  controllers: [
    InsuranceController,
    InsuranceProvidersController,
    InsurancePlansController,
    PatientInsuranceController,
    PreAuthorizationController,
    InsuranceClaimsController,
  ],
  providers: [
    InsuranceDashboardService,
    InsuranceProvidersService,
    InsurancePlansService,
    PatientInsuranceService,
    PreAuthorizationService,
    ClaimDocumentsService,
    InsuranceClaimsService,
  ],
  exports: [InsuranceProvidersService, InsurancePlansService, PatientInsuranceService, InsuranceClaimsService],
})
export class InsuranceModule {}
