import { Injectable } from '@nestjs/common'

import { PrismaService } from '../../prisma/prisma.service'

@Injectable()
export class PharmacyService {
  constructor(_prisma: PrismaService) {}
}
