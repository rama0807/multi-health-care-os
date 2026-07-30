import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

@Injectable()
export class PharmacyService {
  constructor(private readonly prisma: PrismaService) {}
}
