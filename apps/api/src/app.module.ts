import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { APP_GUARD } from '@nestjs/core'
import { EventEmitterModule } from '@nestjs/event-emitter'
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler'
import { LoggerModule } from 'nestjs-pino'

import { AiCommonModule } from './common/ai/ai-common.module'
import { EmailModule } from './common/email/email.module'
import { JwtAuthGuard } from './common/guards/jwt-auth.guard'
import { PermissionsGuard } from './common/guards/permissions.guard'
import { PermissionsModule } from './common/permissions/permissions.module'
import { RedisModule } from './common/redis/redis.module'
import { StorageModule } from './common/storage/storage.module'
import aiConfig from './config/ai.config'
import appConfig from './config/app.config'
import databaseConfig from './config/database.config'
import emailConfig from './config/email.config'
import jwtConfig from './config/jwt.config'
import redisConfig from './config/redis.config'
import storageConfig from './config/storage.config'
import { AiModule } from './modules/ai/ai.module'
import { AppointmentsModule } from './modules/appointments/appointments.module'
import { AuditModule } from './modules/audit/audit.module'
import { AuthModule } from './modules/auth/auth.module'
import { BillingModule } from './modules/billing/billing.module'
import { DepartmentsModule } from './modules/departments/departments.module'
import { DoctorsModule } from './modules/doctors/doctors.module'
import { HealthModule } from './modules/health/health.module'
import { HospitalsModule } from './modules/hospitals/hospitals.module'
import { InsuranceModule } from './modules/insurance/insurance.module'
import { InventoryModule } from './modules/inventory/inventory.module'
import { IpdModule } from './modules/ipd/ipd.module'
import { LaboratoryModule } from './modules/laboratory/laboratory.module'
import { MedicalRecordsModule } from './modules/medical-records/medical-records.module'
import { NotificationsModule } from './modules/notifications/notifications.module'
import { OrganizationsModule } from './modules/organizations/organizations.module'
import { PatientsModule } from './modules/patients/patients.module'
import { PharmacyModule } from './modules/pharmacy/pharmacy.module'
import { PrescriptionsModule } from './modules/prescriptions/prescriptions.module'
import { RadiologyModule } from './modules/radiology/radiology.module'
import { RolesModule } from './modules/roles/roles.module'
import { SchedulingModule } from './modules/scheduling/scheduling.module'
import { StaffModule } from './modules/staff/staff.module'
import { UsersModule } from './modules/users/users.module'
import { PrismaModule } from './prisma/prisma.module'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, jwtConfig, redisConfig, emailConfig, storageConfig, aiConfig],
      envFilePath: ['.env.local', '.env'],
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        customProps: () => ({ context: 'HTTP' }),
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty', options: { singleLine: true } }
            : undefined,
        level: process.env.LOG_LEVEL ?? 'info',
        serializers: {
          req(req: { method: string; url: string; id: string }) {
            return { method: req.method, url: req.url, id: req.id }
          },
        },
      },
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),
    EventEmitterModule.forRoot({
      wildcard: true,
      delimiter: '.',
    }),
    PrismaModule,
    RedisModule,
    EmailModule,
    StorageModule,
    AiCommonModule,
    HealthModule,
    PermissionsModule,
    RolesModule,
    HospitalsModule,
    DepartmentsModule,
    DoctorsModule,
    SchedulingModule,
    AuthModule,
    UsersModule,
    OrganizationsModule,
    AuditModule,
    PatientsModule,
    AppointmentsModule,
    MedicalRecordsModule,
    PrescriptionsModule,
    LaboratoryModule,
    RadiologyModule,
    BillingModule,
    InsuranceModule,
    PharmacyModule,
    InventoryModule,
    IpdModule,
    StaffModule,
    NotificationsModule,
    AiModule,
  ],
  providers: [
    // Order matters: rate-limit first, then authenticate, then authorize.
    // All three global guards are registered here (not split across
    // modules) so the chain is explicit and auditable in one place.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule {}
