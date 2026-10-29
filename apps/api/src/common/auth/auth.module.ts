import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthGuard } from './auth.guard';
import { IdentityVerifier, SupabaseIdentityVerifier } from './identity-verifier';

/** Guard xác thực toàn cục; route nào không đăng nhập được phải đánh dấu `@Public()`. */
@Global()
@Module({
  providers: [
    { provide: IdentityVerifier, useClass: SupabaseIdentityVerifier },
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
  exports: [IdentityVerifier],
})
export class AuthModule {}
