import { AppointmentQuery, JwtPayload } from '@medicore/types'
import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'

import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { RequirePermissions } from '../../common/decorators/permissions.decorator'
import { PermissionsService } from '../../common/permissions/permissions.service'
import { DoctorRefService } from '../scheduling/doctor-ref.service'

import { AppointmentsService } from './appointments.service'
import { CreateAppointmentDto } from './dto/create-appointment.dto'
import { CreateRecurringAppointmentDto } from './dto/create-recurring-appointment.dto'
import { CreateWalkInAppointmentDto } from './dto/create-walk-in-appointment.dto'
import { UpdateAppointmentStatusDto } from './dto/update-appointment-status.dto'

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

@ApiTags('appointments')
@ApiBearerAuth()
@Controller({ path: 'appointments', version: '1' })
export class AppointmentsController {
  constructor(
    private readonly appointmentsService: AppointmentsService,
    private readonly doctorRef: DoctorRefService,
    private readonly permissionsService: PermissionsService,
  ) {}

  @Get()
  @RequirePermissions('appointments.read')
  list(
    @CurrentUser('orgId') orgId: string,
    @Query('date') date?: string,
    @Query('doctorId') doctorId?: string,
    @Query('patientId') patientId?: string,
    @Query('status') status?: AppointmentQuery['status'],
    @Query('type') type?: AppointmentQuery['type'],
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.appointmentsService.list(orgId, {
      date,
      doctorId,
      patientId,
      status,
      type,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    })
  }

  @Get('available-slots')
  @RequirePermissions('appointments.read')
  async availableSlots(
    @CurrentUser('orgId') orgId: string,
    @Query('doctorId') doctorId?: string,
    @Query('date') date?: string,
    @Query('duration') duration?: string,
  ) {
    if (!doctorId) throw new BadRequestException('Query param "doctorId" is required')
    if (!date || !DATE_ONLY.test(date)) {
      throw new BadRequestException('Query param "date" is required in YYYY-MM-DD format')
    }
    const slots = await this.appointmentsService.getAvailableSlotsForBooking(
      orgId,
      doctorId,
      date,
      duration ? Number(duration) : undefined,
    )
    return { slots }
  }

  @Get(':id')
  @RequirePermissions('appointments.read')
  getById(@CurrentUser('orgId') orgId: string, @Param('id') id: string) {
    return this.appointmentsService.getById(orgId, id)
  }

  @Post()
  @RequirePermissions('appointments.create')
  create(
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateAppointmentDto,
  ) {
    return this.appointmentsService.create(orgId, dto, userId)
  }

  @Post('walk-in')
  @RequirePermissions('appointments.create')
  createWalkIn(
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateWalkInAppointmentDto,
  ) {
    return this.appointmentsService.createWalkIn(orgId, dto, userId)
  }

  @Post('recurring')
  @RequirePermissions('appointments.create')
  createRecurring(
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateRecurringAppointmentDto,
  ) {
    return this.appointmentsService.createRecurring(orgId, dto, userId)
  }

  @Patch(':id/status')
  @RequirePermissions('appointments.update')
  async updateStatus(
    @CurrentUser() user: JwtPayload,
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateAppointmentStatusDto,
  ) {
    await this.assertOwnScopeOk(orgId, id, user)
    return this.appointmentsService.updateStatus(orgId, id, dto, userId)
  }

  /**
   * `appointments.update` can be held at `.own` scope (a doctor managing
   * only their own appointments) — the guard only proves the permission
   * exists at some scope, so this re-checks the specific appointment's
   * doctorId matches the caller's linked profile when scoped to `.own`.
   */
  private async assertOwnScopeOk(orgId: string, appointmentId: string, user: JwtPayload): Promise<void> {
    const scope = this.permissionsService.getScope(user, 'appointments', 'update')
    if (scope !== 'own') return

    const appointment = await this.appointmentsService.getById(orgId, appointmentId)
    const ownProfile = await this.doctorRef.findDoctorProfileForUser(orgId, user.sub)
    if (!ownProfile || ownProfile.id !== appointment.doctorId) {
      throw new ForbiddenException('You can only update your own appointments')
    }
  }
}
