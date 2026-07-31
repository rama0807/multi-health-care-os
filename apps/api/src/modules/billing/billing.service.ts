import { Injectable } from '@nestjs/common'

import { PrismaService } from '../../prisma/prisma.service'

@Injectable()
export class BillingService {
  constructor(_prisma: PrismaService) {}
}
