import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthGuard } from './auth.guard';
import { AuthAdmin, SupabaseAuthAdmin } from './auth-admin';
import { AuthRateLimit } from './auth-rate-limit';
import { IdentityVerifier, SupabaseIdentityVerifier } from './identity-verifier';
import { PasswordAuthController } from './password-auth.controller';
import { PasswordAuthService } from './password-auth.service';
import {
  PasswordIdentityProvider,
  SupabasePasswordIdentityProvider,
} from './password-identity-provider';

/** Guard xác thực toàn cục; route nào không đăng nhập được phải đánh dấu `@Public()`. */
@Global()
@Module({
  controllers: [PasswordAuthController],
  providers: [
    PasswordAuthService,
    AuthRateLimit,
    { provide: PasswordIdentityProvider, useClass: SupabasePasswordIdentityProvider },
    { provide: IdentityVerifier, useClass: SupabaseIdentityVerifier },
    { provide: AuthAdmin, useClass: SupabaseAuthAdmin },
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
  exports: [IdentityVerifier, PasswordAuthService, AuthAdmin],
})
export class AuthModule {}
