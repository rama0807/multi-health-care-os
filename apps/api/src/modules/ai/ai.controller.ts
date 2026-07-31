import { Controller } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

import { AiService } from './ai.service'

@ApiTags('ai')
@Controller({ path: 'ai', version: '1' })
export class AiController {
  constructor(_aiService: AiService) {}
}
