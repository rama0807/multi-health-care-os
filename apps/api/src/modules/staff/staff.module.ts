import { Module } from '@nestjs/common'

import { StaffOnboardingModule } from '../../common/onboarding/staff-onboarding.module'
import { DepartmentsModule } from '../departments/departments.module'
import { HospitalsModule } from '../hospitals/hospitals.module'

import { AttendanceController } from './attendance.controller'
import { AttendanceService } from './attendance.service'
import { HolidaysService } from './holidays.service'
import { LeaveTypesService } from './leave-types.service'
import { LeaveController } from './leave.controller'
import { PayrollController } from './payroll.controller'
import { PayrollService } from './payroll.service'
import { ShiftRosterController } from './shift-roster.controller'
import { ShiftRosterService } from './shift-roster.service'
import { ShiftsController } from './shifts.controller'
import { ShiftsService } from './shifts.service'
import { StaffDashboardController } from './staff-dashboard.controller'
import { StaffDashboardService } from './staff-dashboard.service'
import { StaffDocumentsController } from './staff-documents.controller'
import { StaffDocumentsService } from './staff-documents.service'
import { StaffLeaveService } from './staff-leave.service'
import { StaffRefService } from './staff-ref.service'
import { StaffController } from './staff.controller'
import { StaffService } from './staff.service'

@Module({
  imports: [StaffOnboardingModule, HospitalsModule, DepartmentsModule],
  controllers: [
    StaffController,
    StaffDocumentsController,
    StaffDashboardController,
    ShiftsController,
    ShiftRosterController,
    AttendanceController,
    LeaveController,
    PayrollController,
  ],
  providers: [
    StaffRefService,
    StaffService,
    StaffDocumentsService,
    StaffDashboardService,
    ShiftsService,
    ShiftRosterService,
    AttendanceService,
    HolidaysService,
    LeaveTypesService,
    StaffLeaveService,
    PayrollService,
  ],
  exports: [StaffRefService, StaffService],
})
export class StaffModule {}
