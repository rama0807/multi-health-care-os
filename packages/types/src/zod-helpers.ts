import { z } from 'zod'

/**
 * Wraps a format-validating string schema (`.email()`, `.regex()`, `.url()`,
 * `.datetime()`, ...) so it is genuinely optional.
 *
 * `z.string().email().optional()` only tolerates `undefined` - an empty
 * string still has to pass `.email()`, which it never does. HTML forms bind
 * untouched optional fields to `''`, not `undefined`, so every optional
 * format-validated field would reject a blank input. This treats `''` as
 * "not provided" before the wrapped schema runs.
 */
export function optionalString<T extends z.ZodTypeAny>(schema: T) {
  return z.preprocess((value) => (value === '' ? undefined : value), schema.optional())
}
