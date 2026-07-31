import { Injectable } from '@nestjs/common'

import { PrismaService } from '../../prisma/prisma.service'

@Injectable()
export class MedicalRecordsService {
  constructor(_prisma: PrismaService) {}
}
