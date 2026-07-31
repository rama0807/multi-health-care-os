import { JwtPayload } from '@medicore/types'
import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'


import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { RequirePermissions } from '../../common/decorators/permissions.decorator'

import { AssignRoleDto } from './dto/assign-role.dto'
import { CreateRoleDto } from './dto/create-role.dto'
import { UpdateRolePermissionsDto } from './dto/update-role-permissions.dto'
import { RolesService } from './roles.service'

@ApiTags('roles')
@ApiBearerAuth()
@Controller({ path: 'roles', version: '1' })
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @RequirePermissions('roles.read')
  list(@CurrentUser('orgId') orgId: string) {
    return this.rolesService.listRoles(orgId)
  }

  @Get('permissions')
  @RequirePermissions('roles.read')
  listPermissions() {
    return this.rolesService.listPermissions()
  }

  @Post()
  @RequirePermissions('roles.create')
  create(@CurrentUser('orgId') orgId: string, @Body() dto: CreateRoleDto) {
    return this.rolesService.createRole(orgId, dto)
  }

  @Patch(':id/permissions')
  @RequirePermissions('roles.update')
  updatePermissions(
    @CurrentUser('orgId') orgId: string,
    @Param('id') roleId: string,
    @Body() dto: UpdateRolePermissionsDto,
  ) {
    return this.rolesService.updateRolePermissions(orgId, roleId, dto.permissionIds)
  }

  @Post('assign')
  @RequirePermissions('users.manage')
  assign(@CurrentUser() user: JwtPayload, @Body() dto: AssignRoleDto) {
    return this.rolesService.assignRole(user.orgId, dto.userId, dto.roleId, dto.hospitalId)
  }

  @Delete('assign/:userId/:roleId')
  @RequirePermissions('users.manage')
  revoke(
    @CurrentUser('orgId') orgId: string,
    @Param('userId') userId: string,
    @Param('roleId') roleId: string,
  ) {
    return this.rolesService.revokeRole(orgId, userId, roleId)
  }
}
