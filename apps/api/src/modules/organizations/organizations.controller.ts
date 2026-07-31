import { Body, Controller, Get, Patch } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'

import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { RequirePermissions } from '../../common/decorators/permissions.decorator'

import { UpdateOrganizationDto } from './dto/update-organization.dto'
import { OrganizationsService } from './organizations.service'

@ApiTags('organizations')
@ApiBearerAuth()
@Controller({ path: 'organizations', version: '1' })
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Get('me')
  @RequirePermissions('organizations.read')
  getCurrent(@CurrentUser('orgId') orgId: string) {
    return this.organizationsService.getCurrent(orgId)
  }

  @Patch('me')
  @RequirePermissions('organizations.update')
  updateCurrent(@CurrentUser('orgId') orgId: string, @Body() dto: UpdateOrganizationDto) {
    return this.organizationsService.updateCurrent(orgId, dto)
  }
}
