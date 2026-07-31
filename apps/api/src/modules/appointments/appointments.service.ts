import { Injectable } from '@nestjs/common'

import { PrismaService } from '../../prisma/prisma.service'

@Injectable()
export class AppointmentsService {
  constructor(_prisma: PrismaService) {}
}
