import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'

import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { RequirePermissions } from '../../common/decorators/permissions.decorator'

import { DepartmentsService } from './departments.service'
import { CreateDepartmentDto } from './dto/create-department.dto'
import { UpdateDepartmentDto } from './dto/update-department.dto'

@ApiTags('departments')
@ApiBearerAuth()
@Controller({ path: 'departments', version: '1' })
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @Get()
  @RequirePermissions('departments.read')
  list(@CurrentUser('orgId') orgId: string, @Query('hospitalId') hospitalId?: string) {
    return this.departmentsService.list(orgId, hospitalId)
  }

  @Get(':id')
  @RequirePermissions('departments.read')
  getById(@CurrentUser('orgId') orgId: string, @Param('id') id: string) {
    return this.departmentsService.getById(orgId, id)
  }

  @Post()
  @RequirePermissions('departments.create')
  create(@CurrentUser('orgId') orgId: string, @Body() dto: CreateDepartmentDto) {
    return this.departmentsService.create(orgId, dto)
  }

  @Patch(':id')
  @RequirePermissions('departments.update')
  update(
    @CurrentUser('orgId') orgId: string,
    @Param('id') id: string,
    @Body() dto: UpdateDepartmentDto,
  ) {
    return this.departmentsService.update(orgId, id, dto)
  }

  @Delete(':id')
  @RequirePermissions('departments.delete')
  deactivate(@CurrentUser('orgId') orgId: string, @Param('id') id: string) {
    return this.departmentsService.deactivate(orgId, id)
  }
}
