import { resolve } from 'path'

import fastifyCookie from '@fastify/cookie'
import fastifyMultipart from '@fastify/multipart'
import fastifyStatic from '@fastify/static'
import { VersioningType } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { Logger } from 'nestjs-pino'
import { patchNestJsSwagger, ZodValidationPipe } from 'nestjs-zod'

import { AppModule } from './app.module'
import { HttpExceptionFilter } from './common/filters/http-exception.filter'
import { ResponseTransformInterceptor } from './common/interceptors/response-transform.interceptor'

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), {
    bufferLogs: true,
  })

  const configService = app.get(ConfigService)
  const port = configService.get<number>('app.port', 4000)
  const frontendUrl = configService.get<string>('app.frontendUrl', 'http://localhost:3000')
  const cookieSecret = configService.get<string>('app.cookieSecret')

  await app.register(fastifyCookie, { secret: cookieSecret })
  await app.register(fastifyMultipart, { limits: { fileSize: 10 * 1024 * 1024 } })

  // Only relevant when STORAGE_PROVIDER=local — serves uploaded patient
  // documents back out. Under the s3/MinIO driver, uploads are served
  // directly from the object store via S3_PUBLIC_URL instead.
  if (configService.get<string>('storage.provider') !== 's3') {
    await app.register(fastifyStatic, {
      root: resolve(configService.get<string>('storage.local.basePath', './uploads')),
      prefix: '/uploads/',
    })
  }

  app.useLogger(app.get(Logger))

  app.enableCors({
    origin: [frontendUrl],
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Organization-ID', 'X-CSRF-Token'],
    credentials: true,
  })

  app.enableVersioning({ type: VersioningType.URI })
  app.setGlobalPrefix('api')

  // All request validation runs through Zod schemas shared with the frontend
  // (@medicore/types) — see nestjs-zod's createZodDto(). Falls through
  // untouched for handlers whose params aren't zod-dto typed.
  app.useGlobalPipes(new ZodValidationPipe())

  app.useGlobalFilters(new HttpExceptionFilter())
  app.useGlobalInterceptors(new ResponseTransformInterceptor())

  patchNestJsSwagger()

  const swaggerConfig = new DocumentBuilder()
    .setTitle('MediCore API')
    .setDescription('Hospital Management System REST API')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('auth', 'Authentication and authorization')
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
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  })

  await app.listen(port, '0.0.0.0')
  app.get(Logger).log(`MediCore API running on: http://localhost:${port}/api`)
  app.get(Logger).log(`API Documentation: http://localhost:${port}/api/docs`)
}

void bootstrap()
