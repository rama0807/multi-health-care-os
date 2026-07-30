import { ValidationPipe, VersioningType } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { Logger } from 'nestjs-pino'

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

  app.useLogger(app.get(Logger))

  app.enableCors({
    origin: [frontendUrl],
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Organization-ID'],
    credentials: true,
  })

  app.enableVersioning({ type: VersioningType.URI })
  app.setGlobalPrefix('api')

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  )

  app.useGlobalFilters(new HttpExceptionFilter())
  app.useGlobalInterceptors(new ResponseTransformInterceptor())

  const swaggerConfig = new DocumentBuilder()
    .setTitle('MediCore API')
    .setDescription('Hospital Management System REST API')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('auth', 'Authentication and authorization')
    .addTag('organizations', 'Organization management')
    .addTag('users', 'User management')
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
  console.log(`\n🏥 MediCore API running on: http://localhost:${port}/api`)
  console.log(`📚 API Documentation: http://localhost:${port}/api/docs\n`)
}

void bootstrap()
