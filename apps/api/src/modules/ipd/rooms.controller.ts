import { RoomStatus } from '@medicore/types'
import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'

import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { RequirePermissions } from '../../common/decorators/permissions.decorator'

import { CreateRoomDto } from './dto/create-room.dto'
import { UpdateRoomDto } from './dto/update-room.dto'
import { RoomsService } from './rooms.service'

@ApiTags('ipd-rooms')
@ApiBearerAuth()
@Controller({ path: 'ipd/rooms', version: '1' })
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Get()
  @RequirePermissions('ipd.rooms.read')
  list(
    @CurrentUser('orgId') orgId: string,
    @Query('search') search?: string,
    @Query('wardId') wardId?: string,
    @Query('status') status?: RoomStatus,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.roomsService.list(orgId, {
      search,
      wardId,
      status,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    })
  }

  @Get(':id')
  @RequirePermissions('ipd.rooms.read')
  getById(@CurrentUser('orgId') orgId: string, @Param('id') id: string) {
    return this.roomsService.getById(orgId, id)
  }

  @Post()
  @RequirePermissions('ipd.rooms.create')
  create(@CurrentUser('orgId') orgId: string, @Body() dto: CreateRoomDto) {
    return this.roomsService.create(orgId, dto)
  }

  @Patch(':id')
  @RequirePermissions('ipd.rooms.update')
  update(@CurrentUser('orgId') orgId: string, @Param('id') id: string, @Body() dto: UpdateRoomDto) {
    return this.roomsService.update(orgId, id, dto)
  }

  @Delete(':id')
  @RequirePermissions('ipd.rooms.delete')
  deactivate(@CurrentUser('orgId') orgId: string, @Param('id') id: string) {
    return this.roomsService.deactivate(orgId, id)
  }
}
