import { Body, Controller, Get, Param, Post } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'

import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { RequirePermissions } from '../../common/decorators/permissions.decorator'

import { BedAllocationService } from './bed-allocation.service'
import { AllocateBedDto } from './dto/allocate-bed.dto'
import { ReserveBedDto } from './dto/reserve-bed.dto'
import { TransferBedDto } from './dto/transfer-bed.dto'
import { VacateBedDto } from './dto/vacate-bed.dto'

@ApiTags('ipd-bed-allocation')
@ApiBearerAuth()
@Controller({ path: 'ipd/admissions/:admissionId', version: '1' })
export class BedAllocationController {
  constructor(private readonly bedAllocationService: BedAllocationService) {}

  @Post('allocate')
  @RequirePermissions('ipd.transfer.create')
  allocate(
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Param('admissionId') admissionId: string,
    @Body() dto: AllocateBedDto,
  ) {
    return this.bedAllocationService.allocate(orgId, admissionId, dto, userId)
  }

  @Post('reserve')
  @RequirePermissions('ipd.transfer.create')
  reserve(
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Param('admissionId') admissionId: string,
    @Body() dto: ReserveBedDto,
  ) {
    return this.bedAllocationService.reserve(orgId, admissionId, dto, userId)
  }

  @Post('cancel-reservation')
  @RequirePermissions('ipd.transfer.create')
  cancelReservation(
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Param('admissionId') admissionId: string,
  ) {
    return this.bedAllocationService.cancelReservation(orgId, admissionId, userId)
  }

  @Post('vacate')
  @RequirePermissions('ipd.transfer.create')
  vacate(
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Param('admissionId') admissionId: string,
    @Body() dto: VacateBedDto,
  ) {
    return this.bedAllocationService.vacate(orgId, admissionId, dto, userId)
  }

  @Post('transfer')
  @RequirePermissions('ipd.transfer.create')
  transfer(
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Param('admissionId') admissionId: string,
    @Body() dto: TransferBedDto,
  ) {
    return this.bedAllocationService.transfer(orgId, admissionId, dto, userId)
  }

  @Get('allocations')
  @RequirePermissions('ipd.transfer.read')
  listAllocationHistory(@CurrentUser('orgId') orgId: string, @Param('admissionId') admissionId: string) {
    return this.bedAllocationService.listAllocationHistory(orgId, admissionId)
  }

  @Get('transfers')
  @RequirePermissions('ipd.transfer.read')
  listTransferHistory(@CurrentUser('orgId') orgId: string, @Param('admissionId') admissionId: string) {
    return this.bedAllocationService.listTransferHistory(orgId, admissionId)
  }
}
