import { Injectable } from '@nestjs/common'

import { PrismaService } from '../../prisma/prisma.service'

@Injectable()
export class AiService {
  constructor(_prisma: PrismaService) {}
}
