import { AiConversationQuery, AiUsageQuery, JwtPayload } from '@medicore/types'
import { Controller, Get, Param, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'

import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { RequirePermissions } from '../../common/decorators/permissions.decorator'

import { AiConversationsService } from './ai-conversations.service'
import { AiUsageService } from './ai-usage.service'

@ApiTags('ai')
@ApiBearerAuth()
@Controller({ path: 'ai', version: '1' })
export class AiConversationsController {
  constructor(
    private readonly conversationsService: AiConversationsService,
    private readonly usageService: AiUsageService,
  ) {}

  @Get('conversations')
  @RequirePermissions('ai.read')
  @ApiOperation({ summary: 'List AI conversations for the organization' })
  list(@CurrentUser() user: JwtPayload, @Query() query: AiConversationQuery) {
    return this.conversationsService.list(user.orgId, user, {
      ...query,
      page: toInt(query.page),
      limit: toInt(query.limit),
    })
  }

  @Get('conversations/:id')
  @RequirePermissions('ai.read')
  @ApiOperation({ summary: 'Read one AI conversation, including its full message transcript' })
  getById(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.conversationsService.getById(user.orgId, user, id)
  }

  /** Org-wide usage reporting is admin-shaped, so it sits behind `ai.manage`. */
  @Get('usage/summary')
  @RequirePermissions('ai.manage')
  @ApiOperation({ summary: 'Aggregate AI usage and token accounting for a date window' })
  usageSummary(@CurrentUser('orgId') orgId: string, @Query() query: AiUsageQuery) {
    return this.usageService.summary(orgId, normalizeUsageQuery(query))
  }

  @Get('usage')
  @RequirePermissions('ai.manage')
  @ApiOperation({ summary: 'List individual AI usage log entries' })
  usageList(@CurrentUser('orgId') orgId: string, @Query() query: AiUsageQuery) {
    return this.usageService.list(orgId, normalizeUsageQuery(query))
  }
}

function normalizeUsageQuery(query: AiUsageQuery): AiUsageQuery {
  return {
    from: query.from,
    to: query.to,
    feature: query.feature,
    page: toInt(query.page),
    limit: toInt(query.limit),
  }
}

/** Query params arrive as strings; the services expect numbers or `undefined`. */
function toInt(value: number | undefined): number | undefined {
  if (value === undefined) return undefined
  const parsed = Number.parseInt(String(value), 10)
  return Number.isFinite(parsed) ? parsed : undefined
}
