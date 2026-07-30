import { Controller } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { RadiologyService } from './radiology.service'

@ApiTags('radiology')
@Controller({ path: 'radiology', version: '1' })
export class RadiologyController {
  constructor(private readonly radiologyService: RadiologyService) {}
}
