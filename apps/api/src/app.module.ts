import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core'
import { EventEmitterModule } from '@nestjs/event-emitter'
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler'
import { LoggerModule } from 'nestjs-pino'

import { AiCommonModule } from './common/ai/ai-common.module'
import { BackgroundModule } from './common/background/background.module'
import { EmailModule } from './common/email/email.module'
import { JwtAuthGuard } from './common/guards/jwt-auth.guard'
import { PermissionsGuard } from './common/guards/permissions.guard'
import { MetricsInterceptor } from './common/observability/metrics.interceptor'
import { ObservabilityModule } from './common/observability/observability.module'
import { deriveRequestId } from './common/observability/request-context.middleware'
import { currentRequestContext } from './common/observability/request-context.service'
import { PermissionsModule } from './common/permissions/permissions.module'
import { RedisModule } from './common/redis/redis.module'
import { StorageModule } from './common/storage/storage.module'
import { ApiUsageInterceptor } from './common/tenant/api-usage.interceptor'
import { TenantModule } from './common/tenant/tenant.module'
import aiConfig from './config/ai.config'
import appConfig from './config/app.config'
import databaseConfig from './config/database.config'
import emailConfig from './config/email.config'
import { validateEnv } from './config/env.validation'
import jwtConfig from './config/jwt.config'
import notificationsConfig from './config/notifications.config'
import redisConfig from './config/redis.config'
import securityConfig from './config/security.config'
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
import { PlatformModule } from './modules/platform/platform.module'
import { PrescriptionsModule } from './modules/prescriptions/prescriptions.module'
import { RadiologyModule } from './modules/radiology/radiology.module'
import { ReportsModule } from './modules/reports/reports.module'
import { RolesModule } from './modules/roles/roles.module'
import { SchedulingModule } from './modules/scheduling/scheduling.module'
import { StaffModule } from './modules/staff/staff.module'
import { UsersModule } from './modules/users/users.module'
import { PrismaModule } from './prisma/prisma.module'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [
        appConfig,
        databaseConfig,
        jwtConfig,
        redisConfig,
        emailConfig,
        storageConfig,
        aiConfig,
        notificationsConfig,
        securityConfig,
      ],
      envFilePath: ['.env.local', '.env'],
      // Runs before a single provider is constructed — an unsafe production
      // environment fails the boot rather than serving traffic (ADR-0028).
      validate: validateEnv,
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        // Shares one derivation rule with `RequestContextMiddleware`, so the
        // access log, every service log line and the `x-request-id` response
        // header always quote the same id (ADR-0029).
        genReqId: (req) => (req as { id?: string }).id ?? deriveRequestId(req.headers),
        customProps: () => {
          const context = currentRequestContext()
          return {
            context: 'HTTP',
            ...(context
              ? {
                  requestId: context.requestId,
                  traceId: context.trace.traceId,
                  spanId: context.trace.spanId,
                  ...(context.organizationId ? { organizationId: context.organizationId } : {}),
                  ...(context.userId ? { userId: context.userId } : {}),
                }
              : {}),
          }
        },
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty', options: { singleLine: true } }
            : undefined,
        level: process.env.LOG_LEVEL ?? 'info',
        // Credentials reach this process in headers and cookies; a structured
        // log that captured them would turn every log sink into a secret store.
        redact: {
          paths: [
            'req.headers.authorization',
            'req.headers.cookie',
            'req.headers["x-csrf-token"]',
            'res.headers["set-cookie"]',
          ],
          remove: true,
        },
        serializers: {
          req(req: { method: string; url: string; id: string }) {
            return { method: req.method, url: req.url, id: req.id }
          },
        },
      },
    }),
    // One named throttler, not two (ADR-0028). Every configured throttler is
    // evaluated on every route, so a second "auth" tier would apply its small
    // limit to the whole API; credential endpoints instead *override* this
    // one per route with `@Throttle(authThrottle())`.
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            name: 'default',
            ttl: (config.get<number>('security.throttle.ttlSeconds') ?? 60) * 1000,
            limit: config.get<number>('security.throttle.limit') ?? 100,
          },
        ],
      }),
    }),
    EventEmitterModule.forRoot({
      wildcard: true,
      delimiter: '.',
    }),
    ObservabilityModule,
    BackgroundModule,
    PrismaModule,
    RedisModule,
    EmailModule,
    StorageModule,
    TenantModule,
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
    ReportsModule,
    PlatformModule,
  ],
  providers: [
    // Order matters: rate-limit first, then authenticate, then authorize.
    // All three global guards are registered here (not split across
    // modules) so the chain is explicit and auditable in one place.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    // Registered first so it is the outermost interceptor: the latency it
    // measures then includes everything the request actually spent, including
    // the interceptors below it.
    { provide: APP_INTERCEPTOR, useClass: MetricsInterceptor },
    // Runs after the guards, so `request.user` (and therefore the tenant it
    // belongs to) is already resolved — unauthenticated traffic is not metered.
    { provide: APP_INTERCEPTOR, useClass: ApiUsageInterceptor },
  ],
})
export class AppModule {}
