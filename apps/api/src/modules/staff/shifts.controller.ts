import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'

import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { RequirePermissions } from '../../common/decorators/permissions.decorator'

import { CreateShiftDto, UpdateShiftDto } from './dto/shift.dto'
import { ShiftsService } from './shifts.service'

@ApiTags('shifts')
@ApiBearerAuth()
@Controller({ path: 'shifts', version: '1' })
export class ShiftsController {
  constructor(private readonly shiftsService: ShiftsService) {}

  @Get()
  @RequirePermissions('shifts.read')
  list(@CurrentUser('orgId') orgId: string, @Query('isActive') isActive?: string) {
    return this.shiftsService.list(orgId, { isActive: isActive === undefined ? undefined : isActive !== 'false' })
  }

  @Get(':id')
  @RequirePermissions('shifts.read')
  getById(@CurrentUser('orgId') orgId: string, @Param('id') id: string) {
    return this.shiftsService.getById(orgId, id)
  }

  @Post()
  @RequirePermissions('shifts.create')
  create(@CurrentUser('orgId') orgId: string, @Body() dto: CreateShiftDto) {
    return this.shiftsService.create(orgId, dto)
  }

  @Patch(':id')
  @RequirePermissions('shifts.update')
  update(@CurrentUser('orgId') orgId: string, @Param('id') id: string, @Body() dto: UpdateShiftDto) {
    return this.shiftsService.update(orgId, id, dto)
  }

  @Delete(':id')
  @RequirePermissions('shifts.delete')
  deactivate(@CurrentUser('orgId') orgId: string, @Param('id') id: string) {
    return this.shiftsService.deactivate(orgId, id)
  }
}
