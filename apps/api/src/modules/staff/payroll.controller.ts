import { BadRequestException, Controller, Get, Query, Res } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { FastifyReply } from 'fastify'

import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { RequirePermissions } from '../../common/decorators/permissions.decorator'

import { PayrollService } from './payroll.service'

@ApiTags('payroll')
@ApiBearerAuth()
@Controller({ path: 'staff/payroll', version: '1' })
export class PayrollController {
  constructor(private readonly payrollService: PayrollService) {}

  @Get('summary')
  @RequirePermissions('attendance.manage')
  getSummary(
    @CurrentUser('orgId') orgId: string,
    @Query('month') month: string,
    @Query('departmentId') departmentId?: string,
    @Query('staffId') staffId?: string,
  ) {
    if (!month) throw new BadRequestException('"month" query param is required, format YYYY-MM')
    return this.payrollService.getSummary(orgId, { month, departmentId, staffId })
  }

  @Get('export')
  @RequirePermissions('attendance.manage')
  async export(
    @CurrentUser('orgId') orgId: string,
    @Query('month') month: string,
    @Res() reply: FastifyReply,
    @Query('departmentId') departmentId?: string,
    @Query('staffId') staffId?: string,
  ) {
    if (!month) throw new BadRequestException('"month" query param is required, format YYYY-MM')
    const summary = await this.payrollService.getSummary(orgId, { month, departmentId, staffId })
    const csv = this.payrollService.toCsv(summary)

    void reply
      .header('Content-Type', 'text/csv')
      .header('Content-Disposition', `attachment; filename="payroll-${month}.csv"`)
      .send(csv)
  }
}
