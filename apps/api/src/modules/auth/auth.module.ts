import { Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtModule } from '@nestjs/jwt'
import { PassportModule } from '@nestjs/passport'

import { OrganizationEmailConfigModule } from '../organizations/organization-email-config.module'
import { RolesModule } from '../roles/roles.module'

import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'
import { SessionsService } from './sessions.service'
import { JwtStrategy } from './strategies/jwt.strategy'
import { TokensService } from './tokens.service'

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      useFactory: (configService: ConfigService) => ({
        privateKey: configService.get<string>('jwt.privateKey'),
        publicKey: configService.get<string>('jwt.publicKey'),
        signOptions: {
          algorithm: 'RS256',
          expiresIn: configService.get<string>('jwt.accessTokenExpiry'),
        },
        verifyOptions: { algorithms: ['RS256'] },
      }),
      inject: [ConfigService],
    }),
    RolesModule,
    OrganizationEmailConfigModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, SessionsService, TokensService, JwtStrategy],
  exports: [AuthService, SessionsService, TokensService],
})
export class AuthModule {}
