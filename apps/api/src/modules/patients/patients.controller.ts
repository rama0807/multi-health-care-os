import { Controller } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { PatientsService } from './patients.service'

@ApiTags('patients')
@Controller({ path: 'patients', version: '1' })
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}
}
