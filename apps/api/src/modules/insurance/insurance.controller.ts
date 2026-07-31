import { Controller } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

import { InsuranceService } from './insurance.service'

@ApiTags('insurance')
@Controller({ path: 'insurance', version: '1' })
export class InsuranceController {
  constructor(_insuranceService: InsuranceService) {}
}
