import { z } from 'zod'

/**
 * Wraps a schema that rejects an empty string (`.email()`, `.regex()`,
 * `.url()`, `.datetime()`, `.min(1)`, `z.nativeEnum(...)`, ...) so it is
 * genuinely optional.
 *
 * `.optional()` alone only tolerates `undefined` - an empty string still has
 * to satisfy the wrapped schema, which it never does. HTML forms (text
 * inputs cleared by the user, a Select left on its placeholder) bind
 * untouched optional fields to `''`, not `undefined`, so every one of these
 * would reject a blank input. This treats `''` as "not provided" before the
 * wrapped schema runs.
 */
export function optionalString<T extends z.ZodTypeAny>(schema: T) {
  return z.preprocess((value) => (value === '' ? undefined : value), schema.optional())
}
