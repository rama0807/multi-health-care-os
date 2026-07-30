import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { APP_GUARD } from '@nestjs/core'
import { EventEmitterModule } from '@nestjs/event-emitter'
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler'
import { LoggerModule } from 'nestjs-pino'

import appConfig from './config/app.config'
import databaseConfig from './config/database.config'
import jwtConfig from './config/jwt.config'
import redisConfig from './config/redis.config'
import { AiModule } from './modules/ai/ai.module'
import { AppointmentsModule } from './modules/appointments/appointments.module'
import { AuthModule } from './modules/auth/auth.module'
import { BillingModule } from './modules/billing/billing.module'
import { InsuranceModule } from './modules/insurance/insurance.module'
import { InventoryModule } from './modules/inventory/inventory.module'
import { LaboratoryModule } from './modules/laboratory/laboratory.module'
import { MedicalRecordsModule } from './modules/medical-records/medical-records.module'
import { NotificationsModule } from './modules/notifications/notifications.module'
import { OrganizationsModule } from './modules/organizations/organizations.module'
import { PatientsModule } from './modules/patients/patients.module'
import { PharmacyModule } from './modules/pharmacy/pharmacy.module'
import { PrescriptionsModule } from './modules/prescriptions/prescriptions.module'
import { RadiologyModule } from './modules/radiology/radiology.module'
import { StaffModule } from './modules/staff/staff.module'
import { UsersModule } from './modules/users/users.module'
import { PrismaModule } from './prisma/prisma.module'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, jwtConfig, redisConfig],
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
          req(req) {
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
    AuthModule,
    OrganizationsModule,
    UsersModule,
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
    StaffModule,
    NotificationsModule,
    AiModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
