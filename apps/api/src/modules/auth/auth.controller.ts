import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'

import { LoginDto, RegisterOrganizationDto } from '@medicore/types'

import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { Public } from '../../common/decorators/roles.decorator'
import { AuthService } from './auth.service'

@ApiTags('auth')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Register a new organization with admin user' })
  async register(@Body() dto: RegisterOrganizationDto) {
    return this.authService.register(dto)
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login and receive access + refresh tokens' })
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto)
  }

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  async me(@CurrentUser() user: unknown) {
    return user
  }
}
