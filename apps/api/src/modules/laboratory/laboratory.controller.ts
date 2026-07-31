import { Controller } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

import { LaboratoryService } from './laboratory.service'

@ApiTags('laboratory')
@Controller({ path: 'laboratory', version: '1' })
export class LaboratoryController {
  constructor(_laboratoryService: LaboratoryService) {}
}
