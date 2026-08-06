import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Resend } from 'resend'

interface SendEmailInput {
  to: string
  subject: string
  html: string
}

@Injectable()
export class EmailService implements OnModuleInit {
  private readonly logger = new Logger(EmailService.name)
  private resend: Resend | null = null
  private fromAddress = 'MediCore <onboarding@medicore.app>'

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    const apiKey = this.configService.get<string>('email.resendApiKey')
    const fromEmail = this.configService.get<string>('email.fromEmail')
    const fromName = this.configService.get<string>('email.fromName')

    if (fromEmail) {
      this.fromAddress = fromName ? `${fromName} <${fromEmail}>` : fromEmail
    }

    if (apiKey) {
      this.resend = new Resend(apiKey)
    } else {
      this.logger.warn(
        'RESEND_API_KEY is not set - emails will be logged to the console instead of sent.',
      )
    }
  }

  async send({ to, subject, html }: SendEmailInput): Promise<void> {
    if (!this.resend) {
      this.logger.log(`[email:dev-fallback] To: ${to} | Subject: ${subject}\n${html}`)
      return
    }

    try {
      await this.resend.emails.send({ from: this.fromAddress, to, subject, html })
    } catch (error) {
      this.logger.error(`Failed to send email to ${to}: ${(error as Error).message}`)
      throw error
    }
  }
}
