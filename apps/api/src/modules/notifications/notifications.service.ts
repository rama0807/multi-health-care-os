import { Injectable } from '@nestjs/common'

import { PrismaService } from '../../prisma/prisma.service'

@Injectable()
export class NotificationsService {
  constructor(_prisma: PrismaService) {}
}
