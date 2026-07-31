import { Controller } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

import { MedicalRecordsService } from './medical-records.service'

@ApiTags('medical-records')
@Controller({ path: 'medical-records', version: '1' })
export class MedicalRecordsController {
  constructor(_medicalRecordsService: MedicalRecordsService) {}
}
