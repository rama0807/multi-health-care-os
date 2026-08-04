import { NursingTaskPriority, NursingTaskStatus } from '@medicore/types'
import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'

import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { RequirePermissions } from '../../common/decorators/permissions.decorator'

import { CreateNursingTaskDto } from './dto/create-nursing-task.dto'
import { UpdateNursingTaskStatusDto } from './dto/update-nursing-task-status.dto'
import { NursingTasksService } from './nursing-tasks.service'

@ApiTags('ipd-nursing-tasks')
@ApiBearerAuth()
@Controller({ path: 'ipd', version: '1' })
export class NursingTasksController {
  constructor(private readonly nursingTasksService: NursingTasksService) {}

  /** Org-wide queue — backs `/dashboard/nursing/tasks`. */
  @Get('nursing-tasks')
  @RequirePermissions('ipd.tasks.read')
  listQueue(
    @CurrentUser('orgId') orgId: string,
    @Query('status') status?: NursingTaskStatus,
    @Query('priority') priority?: NursingTaskPriority,
    @Query('assignedToUserId') assignedToUserId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.nursingTasksService.list(orgId, {
      status,
      priority,
      assignedToUserId,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    })
  }

  @Get('admissions/:admissionId/nursing-tasks')
  @RequirePermissions('ipd.tasks.read')
  listForAdmission(
    @CurrentUser('orgId') orgId: string,
    @Param('admissionId') admissionId: string,
    @Query('status') status?: NursingTaskStatus,
    @Query('priority') priority?: NursingTaskPriority,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.nursingTasksService.listForAdmission(orgId, admissionId, {
      status,
      priority,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    })
  }

  @Post('admissions/:admissionId/nursing-tasks')
  @RequirePermissions('ipd.tasks.create')
  create(
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Param('admissionId') admissionId: string,
    @Body() dto: CreateNursingTaskDto,
  ) {
    return this.nursingTasksService.create(orgId, admissionId, dto, userId)
  }

  @Patch('nursing-tasks/:taskId/status')
  @RequirePermissions('ipd.tasks.update')
  updateStatus(
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Param('taskId') taskId: string,
    @Body() dto: UpdateNursingTaskStatusDto,
  ) {
    return this.nursingTasksService.updateStatus(orgId, taskId, dto, userId)
  }
}
