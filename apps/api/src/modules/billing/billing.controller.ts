import { Controller } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

import { BillingService } from './billing.service'

@ApiTags('billing')
@Controller({ path: 'billing', version: '1' })
export class BillingController {
  constructor(_billingService: BillingService) {}
}
