import { IncomingMessage } from 'node:http'
import { resolve } from 'path'

import fastifyCookie from '@fastify/cookie'
import fastifyHelmet from '@fastify/helmet'
import fastifyMultipart from '@fastify/multipart'
import fastifyStatic from '@fastify/static'
import { VersioningType } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify'
import { ZodValidationPipe } from 'nestjs-zod'

import { HttpExceptionFilter } from './common/filters/http-exception.filter'
import { ResponseTransformInterceptor } from './common/interceptors/response-transform.interceptor'
import { deriveRequestId } from './common/observability/request-context.middleware'

/**
 * The HTTP-layer setup shared by the real process and its tests
 * (Milestone 19.1 / 19.4).
 *
 * It lives here rather than inline in `main.ts` for one reason: a security
 * header that only exists in `main.ts` is a security header no test can
 * assert. Everything that hardens the transport — the adapter options, helmet,
 * CORS, the global pipe/filter/interceptor chain — is therefore callable, and
 * `test/production-hardening.e2e-spec.ts` exercises exactly what ships.
 */

/**
 * `TRUST_PROXY` is read from the environment rather than `ConfigService`
 * because the adapter is constructed before the DI container exists. It must
 * stay off unless a proxy we control sets `X-Forwarded-For` — trusting it
 * while directly exposed lets any caller spoof `request.ip`, and with it
 * per-IP rate limiting and the address recorded on every audit row.
 */
export function createHttpAdapter(): FastifyAdapter {
  return new FastifyAdapter({
    trustProxy: /^(true|1|yes)$/i.test(process.env.TRUST_PROXY ?? ''),
    // Fastify assigns `request.id` before any middleware runs, and by default
    // mints its own `req-N` counter. Both settings hand that decision to
    // `deriveRequestId`, which is what makes a caller-supplied `x-request-id`
    // actually win — and makes it validated first, since the id ends up in log
    // lines and in a response header.
    requestIdHeader: false,
    genReqId: (req: IncomingMessage) => deriveRequestId(req.headers),
  })
}

/**
 * Registers the Fastify plugins the API depends on. Must run before
 * `app.listen()` (or, in a test, before `app.init()`).
 */
export async function registerPlugins(app: NestFastifyApplication, config: ConfigService): Promise<void> {
  const isProduction = config.get<boolean>('app.isProduction') ?? false
  const swaggerEnabled = config.get<boolean>('security.swaggerEnabled') ?? !isProduction

  await app.register(fastifyCookie, { secret: config.get<string>('app.cookieSecret') })
  await app.register(fastifyMultipart, { limits: { fileSize: 10 * 1024 * 1024 } })

  /**
   * Security headers (Milestone 19.1 / ADR-0028).
   *
   * These matter even though `infra/nginx/nginx.conf` also sets some: nginx is
   * one deployment topology, and the API is directly reachable in the compose
   * stack, in a Kubernetes service mesh, and in local development. Headers
   * belong with the thing that emits the response.
   *
   * The CSP is deliberately strict for an API that serves JSON and file
   * downloads — `default-src 'none'` — and relaxed only when Swagger is
   * mounted, which is why disabling the docs in production removes the
   * exception rather than weakening it everywhere.
   */
  await app.register(fastifyHelmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'none'"],
        baseUri: ["'none'"],
        formAction: ["'none'"],
        frameAncestors: ["'none'"],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        ...(swaggerEnabled
          ? { scriptSrc: ["'self'", "'unsafe-inline'"], styleSrc: ["'self'", "'unsafe-inline'"] }
          : {}),
      },
    },
    // A browser ignores HSTS on a plain-HTTP response, so sending it
    // unconditionally in production is safe; sending it in development would
    // pin a developer's browser to HTTPS on localhost.
    hsts: isProduction
      ? {
          maxAge: config.get<number>('security.hstsMaxAgeSeconds') ?? 31_536_000,
          includeSubDomains: config.get<boolean>('security.hstsIncludeSubDomains') ?? true,
          preload: config.get<boolean>('security.hstsPreload') ?? false,
        }
      : false,
    // An uploaded clinical document must never be embeddable from another
    // origin, and nothing here is ever legitimately framed.
    crossOriginResourcePolicy: { policy: 'same-site' },
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    // Swagger UI loads its assets from this origin; COEP would block them and
    // buys nothing for a JSON API that isolates nothing cross-origin.
    crossOriginEmbedderPolicy: false,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    frameguard: { action: 'deny' },
    hidePoweredBy: true,
    noSniff: true,
  })

  // Only relevant when STORAGE_PROVIDER=local — serves uploaded patient
  // documents back out. Under the s3/MinIO driver, uploads are served
  // directly from the object store via S3_PUBLIC_URL instead.
  if (config.get<string>('storage.provider') !== 's3') {
    await app.register(fastifyStatic, {
      root: resolve(config.get<string>('storage.local.basePath', './uploads')),
      prefix: '/uploads/',
      // A stored document is data, never a page in this origin.
      // `void` because @fastify/static hands back a FastifyReply here, which
      // is thenable — the header is set synchronously, there is nothing to await.
      setHeaders: (res) => {
        void res.setHeader('Content-Disposition', 'attachment')
        void res.setHeader('X-Content-Type-Options', 'nosniff')
      },
    })
  }
}

/** CORS, versioning, prefix, and the global pipe/filter/interceptor chain. */
export function configureApp(app: NestFastifyApplication, config: ConfigService): void {
  app.enableCors({
    origin: config.get<string[]>('security.corsOrigins') ?? [],
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Organization-ID',
      'X-CSRF-Token',
      'X-Request-ID',
      'traceparent',
    ],
    // Lets a browser client read back the id it should quote in a bug report.
    exposedHeaders: ['X-Request-ID', 'traceparent'],
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
}
