import { Injectable } from '@nestjs/common'

import { PrismaService } from '../../prisma/prisma.service'

@Injectable()
export class InsuranceService {
  constructor(_prisma: PrismaService) {}
}
