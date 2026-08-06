import { Module } from '@nestjs/common'

import { AuditModule } from '../audit/audit.module'
import { SchedulingModule } from '../scheduling/scheduling.module'

import { AiConversationsController } from './ai-conversations.controller'
import { AiConversationsService } from './ai-conversations.service'
import { AiGenerationService } from './ai-generation.service'
import { AiPromptTemplatesController } from './ai-prompt-templates.controller'
import { AiPromptTemplatesService } from './ai-prompt-templates.service'
import { AiUsageService } from './ai-usage.service'
import { AiController } from './ai.controller'
import { ClinicalContextService } from './context/clinical-context.service'

/**
 * Domain layer only - the provider abstraction lives in `common/ai`
 * (`AiCommonModule`, global) so no domain module ever imports a vendor
 * adapter. `SchedulingModule` supplies `DoctorRefService` for own-scope
 * resolution, exactly as Prescriptions/Medical Records already use it.
 */
@Module({
  imports: [AuditModule, SchedulingModule],
  controllers: [AiController, AiConversationsController, AiPromptTemplatesController],
  providers: [
    AiGenerationService,
    AiConversationsService,
    AiUsageService,
    AiPromptTemplatesService,
    ClinicalContextService,
  ],
  exports: [AiGenerationService],
})
export class AiModule {}
