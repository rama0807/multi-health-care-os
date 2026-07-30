import { Controller } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { StaffService } from './staff.service'

@ApiTags('staff')
@Controller({ path: 'staff', version: '1' })
export class StaffController {
  constructor(private readonly staffService: StaffService) {}
}
