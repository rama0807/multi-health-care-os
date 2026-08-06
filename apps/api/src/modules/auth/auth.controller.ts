import { JwtPayload } from '@medicore/types'
import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, Res, UseGuards } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Throttle } from '@nestjs/throttler'
import { FastifyReply, FastifyRequest } from 'fastify'


import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { Public } from '../../common/decorators/public.decorator'
import { CsrfGuard } from '../../common/guards/csrf.guard'
import { authThrottle } from '../../config/security.config'

import { clearAuthCookies, REFRESH_COOKIE_NAME, setAuthCookies } from './auth-cookies.util'
import { AuthSessionResult, AuthService, RequestMeta } from './auth.service'
import { ChangePasswordDto } from './dto/change-password.dto'
import { ForgotPasswordDto } from './dto/forgot-password.dto'
import { LoginDto } from './dto/login.dto'
import { RegisterOrganizationDto } from './dto/register-organization.dto'
import { ResetPasswordDto } from './dto/reset-password.dto'
import { VerifyEmailDto } from './dto/verify-email.dto'

/**
 * `@Throttle(authThrottle())` marks the routes that accept or issue a
 * credential (Milestone 19.1). They override the global 100/minute budget with
 * a much smaller one; the routes that merely *use* an established session
 * (`refresh`, `logout`, `me`, `sessions`) stay on the default tier, because a
 * dashboard with several tabs open legitimately hits those far more often.
 *
 * This is the coarse, per-IP line of defence. The precise one - a lock after
 * five failed attempts on a *specific account* - lives in `AuthService` and is
 * unaffected by the shared NAT address a hospital LAN presents.
 */
@ApiTags('auth')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  private requestMeta(request: FastifyRequest): RequestMeta {
    return {
      userAgent: request.headers['user-agent'] ?? 'unknown',
      ipAddress: request.ip,
    }
  }

  private respondWithSession(reply: FastifyReply, result: AuthSessionResult) {
    setAuthCookies(
      reply,
      result.refreshToken,
      result.refreshTokenTtlSeconds,
      result.rememberMe,
      this.configService.get<boolean>('app.isProduction') ?? false,
    )
    return { accessToken: result.accessToken, expiresIn: result.expiresIn, user: result.user }
  }

  @Throttle(authThrottle())
  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Register a new organization with its admin user' })
  async register(
    @Body() dto: RegisterOrganizationDto,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const result = await this.authService.register(dto, this.requestMeta(request))
    return this.respondWithSession(reply, result)
  }

  @Throttle(authThrottle())
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login and receive an access token (refresh token via cookie)' })
  async login(
    @Body() dto: LoginDto,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const result = await this.authService.login(dto, this.requestMeta(request))
    return this.respondWithSession(reply, result)
  }

  @Public()
  @UseGuards(CsrfGuard)
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate the refresh token cookie for a new access token' })
  async refresh(
    @Req() request: FastifyRequest & { cookies?: Record<string, string> },
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const presentedToken = request.cookies?.[REFRESH_COOKIE_NAME]
    const result = await this.authService.refresh(presentedToken, this.requestMeta(request))
    return this.respondWithSession(reply, result)
  }

  @ApiBearerAuth()
  @UseGuards(CsrfGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke the current session' })
  async logout(@CurrentUser() user: JwtPayload, @Res({ passthrough: true }) reply: FastifyReply) {
    await this.authService.logout(user.sub, user.sessionId)
    clearAuthCookies(reply, this.configService.get<boolean>('app.isProduction') ?? false)
    return { message: 'Logged out' }
  }

  @ApiBearerAuth()
  @UseGuards(CsrfGuard)
  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke every session for the current user' })
  async logoutAll(@CurrentUser() user: JwtPayload, @Res({ passthrough: true }) reply: FastifyReply) {
    await this.authService.logoutAll(user.sub)
    clearAuthCookies(reply, this.configService.get<boolean>('app.isProduction') ?? false)
    return { message: 'Logged out of all devices' }
  }

  @Throttle(authThrottle())
  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request a password reset email' })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.authService.forgotPassword(dto.email)
    return { message: 'If that email exists, a reset link has been sent' }
  }

  @Throttle(authThrottle())
  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password using a reset token' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.authService.resetPassword(dto.token, dto.password)
    return { message: 'Password has been reset' }
  }

  @Throttle(authThrottle())
  @Public()
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify an email address using a verification token' })
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    await this.authService.verifyEmail(dto.token)
    return { message: 'Email verified' }
  }

  @Throttle(authThrottle())
  @ApiBearerAuth()
  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resend the email verification link' })
  async resendVerification(@CurrentUser('sub') userId: string) {
    await this.authService.resendVerificationEmail(userId)
    return { message: 'Verification email sent' }
  }

  @Throttle(authThrottle())
  @ApiBearerAuth()
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change the current password' })
  async changePassword(@CurrentUser() user: JwtPayload, @Body() dto: ChangePasswordDto) {
    await this.authService.changePassword(
      user.sub,
      user.sessionId,
      dto.currentPassword,
      dto.newPassword,
    )
    return { message: 'Password changed' }
  }

  @ApiBearerAuth()
  @Get('sessions')
  @ApiOperation({ summary: 'List active sessions for the current user' })
  async sessions(@CurrentUser() user: JwtPayload) {
    return this.authService.getSessions(user.sub, user.sessionId)
  }

  @ApiBearerAuth()
  @Get('me')
  @ApiOperation({ summary: 'Get the current user profile' })
  async me(@CurrentUser('sub') userId: string) {
    return this.authService.me(userId)
  }
}
