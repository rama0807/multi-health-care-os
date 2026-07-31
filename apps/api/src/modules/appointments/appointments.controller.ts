import { Controller } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

import { AppointmentsService } from './appointments.service'

@ApiTags('appointments')
@Controller({ path: 'appointments', version: '1' })
export class AppointmentsController {
  constructor(_appointmentsService: AppointmentsService) {}
}
