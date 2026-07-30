import { Controller } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { PrescriptionsService } from './prescriptions.service'

@ApiTags('prescriptions')
@Controller({ path: 'prescriptions', version: '1' })
export class PrescriptionsController {
  constructor(private readonly prescriptionsService: PrescriptionsService) {}
}
