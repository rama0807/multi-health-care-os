import { Module } from '@nestjs/common'

import { HospitalsModule } from '../hospitals/hospitals.module'

import { DepartmentsController } from './departments.controller'
import { DepartmentsService } from './departments.service'

@Module({
  imports: [HospitalsModule],
  controllers: [DepartmentsController],
  providers: [DepartmentsService],
  exports: [DepartmentsService],
})
export class DepartmentsModule {}
