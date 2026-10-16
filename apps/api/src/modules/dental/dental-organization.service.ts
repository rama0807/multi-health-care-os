/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { Injectable } from '@nestjs/common'

import { PrismaService } from '../../prisma/prisma.service'

@Injectable()
export class DentalOrganizationService {
  constructor(private readonly prisma: PrismaService) { }

  async getConfig(orgId: string) {
    let config = await this.prisma.dentalOrganizationConfig.findUnique({
      where: { organizationId: orgId },
    })

    if (!config) {
      config = await this.prisma.dentalOrganizationConfig.create({
        data: { organizationId: orgId },
      })
    }

    return config
  }

  async updateConfig(orgId: string, data: any) {
    return this.prisma.dentalOrganizationConfig.upsert({
      where: { organizationId: orgId },
      update: {
        currency: data.currency,
        taxPercentage: data.taxPercentage,
        defaultInvoiceNotes: data.defaultInvoiceNotes,
        requireApprovalForDiscount: data.requireApprovalForDiscount,
      },
      create: {
        organizationId: orgId,
        currency: data.currency,
        taxPercentage: data.taxPercentage,
        defaultInvoiceNotes: data.defaultInvoiceNotes,
        requireApprovalForDiscount: data.requireApprovalForDiscount,
      },
    })
  }
}
