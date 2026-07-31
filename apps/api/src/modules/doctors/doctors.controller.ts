import { DoctorSearchQuery } from '@medicore/types'
import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'

import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { RequirePermissions } from '../../common/decorators/permissions.decorator'

import { DoctorsService } from './doctors.service'
import { CreateDoctorDto } from './dto/create-doctor.dto'
import { UpdateDoctorDto } from './dto/update-doctor.dto'

@ApiTags('doctors')
@ApiBearerAuth()
@Controller({ path: 'doctors', version: '1' })
export class DoctorsController {
  constructor(private readonly doctorsService: DoctorsService) {}

  @Get()
  @RequirePermissions('doctors.read')
  list(
    @CurrentUser('orgId') orgId: string,
    @Query('q') q?: string,
    @Query('specialization') specialization?: string,
    @Query('departmentId') departmentId?: string,
    @Query('hospitalId') hospitalId?: string,
    @Query('language') language?: string,
    @Query('availabilityStatus') availabilityStatus?: DoctorSearchQuery['availabilityStatus'],
    @Query('isActive') isActive?: string,
    @Query('sortBy') sortBy?: DoctorSearchQuery['sortBy'],
    @Query('sortOrder') sortOrder?: DoctorSearchQuery['sortOrder'],
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.doctorsService.list(orgId, {
      q,
      specialization,
      departmentId,
      hospitalId,
      language,
      availabilityStatus,
      isActive: isActive === undefined ? undefined : isActive !== 'false',
      sortBy,
      sortOrder,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    })
  }

  @Get('stats/dashboard')
  @RequirePermissions('doctors.read')
  getDashboardStats(@CurrentUser('orgId') orgId: string) {
    return this.doctorsService.getDashboardStats(orgId)
  }

  @Get('me')
  getMyProfile(@CurrentUser('orgId') orgId: string, @CurrentUser('sub') userId: string) {
    return this.doctorsService.getMyProfile(orgId, userId)
  }

  @Get(':id')
  @RequirePermissions('doctors.read')
  getById(@CurrentUser('orgId') orgId: string, @Param('id') id: string) {
    return this.doctorsService.getById(orgId, id)
  }

  @Post()
  @RequirePermissions('doctors.create')
  create(
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateDoctorDto,
  ) {
    return this.doctorsService.create(orgId, dto, userId)
  }

  @Patch(':id')
  @RequirePermissions('doctors.update')
  update(
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateDoctorDto,
  ) {
    return this.doctorsService.update(orgId, id, dto, userId)
  }

  @Post(':id/restore')
  @RequirePermissions('doctors.update')
  restore(
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
  ) {
    return this.doctorsService.restore(orgId, id, userId)
  }

  @Delete(':id')
  @RequirePermissions('doctors.delete')
  deactivate(
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
  ) {
    return this.doctorsService.deactivate(orgId, id, userId)
  }
}
