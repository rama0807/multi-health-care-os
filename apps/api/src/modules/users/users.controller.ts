import { UserStatus } from '@medicore/types'
import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'


import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { RequirePermissions } from '../../common/decorators/permissions.decorator'

import { CreateUserDto } from './dto/create-user.dto'
import { UpdateUserDto } from './dto/update-user.dto'
import { UsersService } from './users.service'

@ApiTags('users')
@ApiBearerAuth()
@Controller({ path: 'users', version: '1' })
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @RequirePermissions('users.read')
  list(
    @CurrentUser('orgId') orgId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: UserStatus,
  ) {
    return this.usersService.list(orgId, {
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      status,
    })
  }

  @Get(':id')
  @RequirePermissions('users.read')
  getById(@CurrentUser('orgId') orgId: string, @Param('id') id: string) {
    return this.usersService.getById(orgId, id)
  }

  @Post()
  @RequirePermissions('users.manage')
  create(@CurrentUser('orgId') orgId: string, @Body() dto: CreateUserDto) {
    return this.usersService.create(orgId, dto)
  }

  @Patch(':id')
  @RequirePermissions('users.manage')
  update(@CurrentUser('orgId') orgId: string, @Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(orgId, id, dto)
  }
}
