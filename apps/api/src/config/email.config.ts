import { registerAs } from '@nestjs/config'

export default registerAs('email', () => ({
  resendApiKey: process.env.RESEND_API_KEY,
  fromEmail: process.env.EMAIL_FROM ?? 'onboarding@medicore.app',
  fromName: process.env.EMAIL_FROM_NAME ?? 'MediCore',
  /**
   * Base64-encoded 32-byte key `SecretEncryptionService` uses to encrypt a
   * tenant's own Resend API key at rest (TD-0064). Optional in development -
   * `SecretEncryptionService.isConfigured()` is how callers ask before
   * attempting to encrypt/decrypt, rather than throwing on a missing key.
   */
  configEncryptionKey: process.env.EMAIL_CONFIG_ENCRYPTION_KEY,
}))
