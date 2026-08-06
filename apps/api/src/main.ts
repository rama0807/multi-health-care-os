import { ConfigService } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'
import { NestFastifyApplication } from '@nestjs/platform-fastify'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { Logger } from 'nestjs-pino'
import { patchNestJsSwagger } from 'nestjs-zod'

import { AppModule } from './app.module'
import { configureApp, createHttpAdapter, registerPlugins } from './bootstrap'
import { BackgroundTaskService } from './common/background/background-task.service'
import { drainStartupWarnings } from './config/env.validation'
import { HealthService } from './modules/health/health.service'

const SWAGGER_PATH = 'api/docs'

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, createHttpAdapter(), {
    bufferLogs: true,
  })

  const configService = app.get(ConfigService)
  const port = configService.get<number>('app.port', 4000)
  const isProduction = configService.get<boolean>('app.isProduction') ?? false
  const swaggerEnabled = configService.get<boolean>('security.swaggerEnabled') ?? !isProduction

  await registerPlugins(app, configService)

  const logger = app.get(Logger)
  app.useLogger(logger)

  // Collected by `validateEnv` during ConfigModule initialisation, replayed
  // here now that a real logger exists (ADR-0028).
  for (const warning of drainStartupWarnings()) {
    logger.warn(`[startup] ${warning}`)
  }

  configureApp(app, configService)

  if (swaggerEnabled) {
    setupSwagger(app)
  }

  registerGracefulShutdown(app, logger)

  await app.listen(port, '0.0.0.0')
  logger.log(`MediCore API running on: http://localhost:${port}/api`)
  logger.log(
    swaggerEnabled
      ? `API Documentation: http://localhost:${port}/${SWAGGER_PATH}`
      : 'API Documentation is disabled (SWAGGER_ENABLED=false)',
  )
}

function setupSwagger(app: NestFastifyApplication): void {
  patchNestJsSwagger()

  const swaggerConfig = new DocumentBuilder()
    .setTitle('MediCore API')
    .setDescription('Hospital Management System REST API')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('auth', 'Authentication and authorization')
    .addTag('health', 'Health, readiness and metrics')
    .addTag('organizations', 'Organization management')
    .addTag('hospitals', 'Hospital management')
    .addTag('departments', 'Department management')
    .addTag('roles', 'Roles and permissions')
    .addTag('users', 'User management')
    .addTag('audit', 'Audit log')
    .addTag('patients', 'Patient management')
    .addTag('appointments', 'Appointment scheduling')
    .addTag('medical-records', 'Clinical documentation')
    .addTag('laboratory', 'Lab orders and results')
    .addTag('billing', 'Invoicing and payments')
    .build()

  const document = SwaggerModule.createDocument(app, swaggerConfig)
  SwaggerModule.setup(SWAGGER_PATH, app, document, {
    swaggerOptions: { persistAuthorization: true },
  })
}

/**
 * Graceful shutdown (Milestone 19.5 / ADR-0028).
 *
 * The sequence exists because stopping the server the instant `SIGTERM`
 * arrives drops requests that are already in flight, and - worse - keeps
 * receiving new ones for the seconds it takes a load balancer to notice the
 * instance is gone. So:
 *
 * 1. Readiness flips to 503 immediately, which is the signal every
 *    orchestrator and reverse proxy actually watches.
 * 2. The process keeps serving for `SHUTDOWN_DRAIN_MS`, long enough for that
 *    signal to be observed and for in-flight work to finish.
 * 3. `app.close()` then runs every module's `onModuleDestroy` - the Prisma
 *    disconnect, the Redis `quit`, the notification worker's `clearInterval`.
 *
 * A second signal skips the wait: an operator pressing Ctrl-C twice means it.
 */
function registerGracefulShutdown(app: NestFastifyApplication, logger: Logger): void {
  const drainMs = Number.parseInt(process.env.SHUTDOWN_DRAIN_MS ?? '5000', 10)
  let shuttingDown = false

  const shutdown = (signal: NodeJS.Signals) => {
    if (shuttingDown) {
      logger.warn(`Received ${signal} again - exiting immediately`)
      process.exit(1)
    }
    shuttingDown = true

    void (async () => {
      logger.log(`Received ${signal} - draining for ${drainMs}ms before shutdown`)
      app.get(HealthService).beginShutdown()

      if (drainMs > 0) {
        await new Promise((resolveDrain) => setTimeout(resolveDrain, drainMs))
      }

      // Emails and other off-request work already handed to the background
      // service finish before the Prisma and Redis connections are torn out
      // from under them.
      await app.get(BackgroundTaskService).drain()

      try {
        await app.close()
        logger.log('Shutdown complete')
        process.exit(0)
      } catch (error) {
        logger.error(`Shutdown failed: ${(error as Error).message}`)
        process.exit(1)
      }
    })()
  }

  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)
}

void bootstrap()
