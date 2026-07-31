import { Controller } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

import { PharmacyService } from './pharmacy.service'

@ApiTags('pharmacy')
@Controller({ path: 'pharmacy', version: '1' })
export class PharmacyController {
  constructor(_pharmacyService: PharmacyService) {}
}
