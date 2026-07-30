# ADR-002: NestJS as Backend Framework

**Status:** Accepted  
**Date:** 2024-01-15

---

## Context

We need a Node.js backend framework that can handle:
- Enterprise-grade module structure
- Dependency injection for testability
- Decorator-based authorization and validation
- Easy integration with Prisma, Redis, BullMQ
- OpenAPI documentation generation
- Future extensibility (WebSockets, microservices)

## Decision

Use **NestJS with TypeScript**.

## Rationale

**Dependency Injection:** NestJS's IoC container enables true unit testing — services are injected, not imported directly, so tests can swap real implementations for mocks without module rewiring.

**Module system:** Each feature is a self-contained NestJS module with its controller, service, guards, and DTOs. This enforces the module boundary architecture we need for a large system.

**Decorator-based cross-cutting concerns:**

```typescript
@Controller('patients')
@UseGuards(JwtAuthGuard, RbacGuard)
@Roles(Permission.PATIENTS_READ)
export class PatientController {
  @Get(':id')
  @AuditLog('patient.viewed')
  findOne(@Param('id') id: string) { ... }
}
```

Guards, audit logging, and validation all applied without cluttering business logic.

**Built-in pipes:** `ValidationPipe` with `class-validator` / `class-transformer` gives DTO validation with zero boilerplate.

**OpenAPI generation:** `@nestjs/swagger` generates complete API documentation from decorators automatically — no separate spec files to maintain.

## Tradeoffs

| Concern | Assessment |
|---------|-----------|
| Learning curve | Moderate — opinionated conventions |
| Bundle size | Larger than Express/Fastify bare | 
| Performance | Excellent with Fastify adapter |
| Testability | Excellent — DI is first-class |
| Ecosystem | Strong — active community, good integrations |

**Performance note:** NestJS defaults to Express adapter. We use the **Fastify adapter** for ~2x throughput improvement on high-traffic endpoints.

## Rejected Alternatives

**Express.js:** Too minimal for enterprise use. Would require building the module system, DI, validation, and documentation tooling from scratch — essentially reinventing NestJS badly.

**Hono:** Excellent performance and simplicity, but lacks the enterprise patterns (DI, module system) we need at this scale. Better for microservices.

**Fastify alone:** Same concern as Express — raw framework requires too much custom scaffolding.

**tRPC:** Compelling for full-stack TypeScript, but couples frontend and backend too tightly. Our architecture may add mobile clients or third-party integrations that need standard REST/OpenAPI.
