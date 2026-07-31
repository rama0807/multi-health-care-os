import { Module } from '@nestjs/common'

import { AuditController } from './audit.controller'
import { AuditListener } from './audit.listener'
import { AuditService } from './audit.service'

@Module({
  controllers: [AuditController],
  providers: [AuditService, AuditListener],
  exports: [AuditService],
})
export class AuditModule {}
