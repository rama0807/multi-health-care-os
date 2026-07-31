import { Module } from '@nestjs/common'

import { OrganizationsModule } from '../organizations/organizations.module'

import { PatientsController } from './patients.controller'
import { PatientsService } from './patients.service'

@Module({
  imports: [OrganizationsModule],
  controllers: [PatientsController],
  providers: [PatientsService],
  exports: [PatientsService],
})
export class PatientsModule {}
