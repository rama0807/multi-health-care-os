import { EmploymentStatus, EmploymentType, StaffSearchQuery } from '@medicore/types'
import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'

import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { RequirePermissions } from '../../common/decorators/permissions.decorator'

import { CreateStaffDto, UpdateStaffDto } from './dto/create-staff.dto'
import { StaffService } from './staff.service'

@ApiTags('staff')
@ApiBearerAuth()
@Controller({ path: 'staff', version: '1' })
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @Get()
  @RequirePermissions('staff.read')
  list(
    @CurrentUser('orgId') orgId: string,
    @Query('q') q?: string,
    @Query('departmentId') departmentId?: string,
    @Query('hospitalId') hospitalId?: string,
    @Query('designation') designation?: string,
    @Query('employmentType') employmentType?: EmploymentType,
    @Query('employmentStatus') employmentStatus?: EmploymentStatus,
    @Query('reportsToId') reportsToId?: string,
    @Query('sortBy') sortBy?: StaffSearchQuery['sortBy'],
    @Query('sortOrder') sortOrder?: StaffSearchQuery['sortOrder'],
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.staffService.list(orgId, {
      q,
      departmentId,
      hospitalId,
      designation,
      employmentType,
      employmentStatus,
      reportsToId,
      sortBy,
      sortOrder,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    })
  }

  @Get('me')
  getMyProfile(@CurrentUser('orgId') orgId: string, @CurrentUser('sub') userId: string) {
    return this.staffService.getMyProfile(orgId, userId)
  }

  @Get(':id')
  @RequirePermissions('staff.read')
  getById(@CurrentUser('orgId') orgId: string, @Param('id') id: string) {
    return this.staffService.getById(orgId, id)
  }

  @Post()
  @RequirePermissions('staff.create')
  create(@CurrentUser('orgId') orgId: string, @CurrentUser('sub') userId: string, @Body() dto: CreateStaffDto) {
    return this.staffService.create(orgId, dto, userId)
  }

  @Patch(':id')
  @RequirePermissions('staff.update')
  update(
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateStaffDto,
  ) {
    return this.staffService.update(orgId, id, dto, userId)
  }

  @Post(':id/employment-status')
  @RequirePermissions('staff.update')
  setEmploymentStatus(
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body('status') status: EmploymentStatus,
  ) {
    return this.staffService.setEmploymentStatus(orgId, id, status, userId)
  }

  @Delete(':id')
  @RequirePermissions('staff.delete')
  deactivate(@CurrentUser('orgId') orgId: string, @CurrentUser('sub') userId: string, @Param('id') id: string) {
    return this.staffService.setEmploymentStatus(orgId, id, EmploymentStatus.TERMINATED, userId)
  }
}
