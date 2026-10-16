import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'

import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { RequirePermissions } from '../../common/decorators/permissions.decorator'
import { DentalGuard } from '../../common/guards/dental.guard'

import { DentalOrganizationService } from './dental-organization.service'

@ApiTags('Dental Organization')
@ApiBearerAuth()
@UseGuards(DentalGuard)
@Controller('dental/organization')
export class DentalOrganizationController {
  constructor(private readonly orgService: DentalOrganizationService) {}

  @Get('config')
  @ApiOperation({ summary: 'Get dental organization config' })
  @RequirePermissions('organization.view')
  getConfig(@CurrentUser('orgId') orgId: string) {
    return this.orgService.getConfig(orgId)
  }

  @Put('config')
  @ApiOperation({ summary: 'Update dental organization config' })
  @RequirePermissions('organization.manage')
  updateConfig(
    @CurrentUser('orgId') orgId: string,
    @Body() dto: any, // TODO: Add UpdateDentalOrgConfigDto
  ) {
    return this.orgService.updateConfig(orgId, dto)
  }
}
