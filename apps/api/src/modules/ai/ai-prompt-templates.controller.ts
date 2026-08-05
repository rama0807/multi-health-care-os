import { AiFeature, JwtPayload } from '@medicore/types'
import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'

import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { RequirePermissions } from '../../common/decorators/permissions.decorator'

import { AiPromptTemplatesService } from './ai-prompt-templates.service'
import { CreateAiPromptTemplateDto, UpdateAiPromptTemplateDto } from './dto/ai.dto'

@ApiTags('ai')
@ApiBearerAuth()
@Controller({ path: 'ai/prompt-templates', version: '1' })
export class AiPromptTemplatesController {
  constructor(private readonly templatesService: AiPromptTemplatesService) {}

  @Get()
  @RequirePermissions('ai.templates.read')
  @ApiOperation({ summary: 'The effective prompt template for every feature (override or bundled default)' })
  listEffective(@CurrentUser('orgId') orgId: string) {
    return this.templatesService.listEffective(orgId)
  }

  @Get('versions')
  @RequirePermissions('ai.templates.read')
  @ApiOperation({ summary: 'Every stored override version for one feature, newest first' })
  listVersions(@CurrentUser('orgId') orgId: string, @Query('feature') feature: AiFeature) {
    return this.templatesService.listVersions(orgId, feature)
  }

  @Post()
  @RequirePermissions('ai.templates.manage')
  @ApiOperation({ summary: 'Add a new prompt template version (append-only — never edits in place)' })
  createVersion(@CurrentUser() user: JwtPayload, @Body() dto: CreateAiPromptTemplateDto) {
    return this.templatesService.createVersion(user.orgId, user.sub, dto)
  }

  @Patch(':id')
  @RequirePermissions('ai.templates.manage')
  @ApiOperation({ summary: 'Activate or deactivate a version (deactivating all falls back to the bundled default)' })
  setActive(
    @CurrentUser('orgId') orgId: string,
    @Param('id') id: string,
    @Body() dto: UpdateAiPromptTemplateDto,
  ) {
    return this.templatesService.setActive(orgId, id, dto.isActive)
  }
}
