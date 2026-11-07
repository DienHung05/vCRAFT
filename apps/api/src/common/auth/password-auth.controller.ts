import { Body, Controller, Get, Header, HttpCode, Post, Query, Req } from '@nestjs/common';
import {
  type PasswordSignInRequest,
  PasswordSignInRequestSchema,
  type PasswordSignUpRequest,
  PasswordSignUpRequestSchema,
} from '@vcraft/contracts';
import { ZodValidationPipe } from '../pipes/zod-validation.pipe';
import { Public } from './auth.guard';
import { AuthRateLimit } from './auth-rate-limit';
import { PasswordAuthService } from './password-auth.service';

@Controller('auth')
@Public()
export class PasswordAuthController {
  constructor(
    private readonly passwords: PasswordAuthService,
    private readonly limits: AuthRateLimit,
  ) {}

  @Post('sign-in')
  @HttpCode(200)
  @Header('Cache-Control', 'private, no-store')
  async signIn(
    @Req() request: { ip: string },
    @Body(new ZodValidationPipe(PasswordSignInRequestSchema)) body: PasswordSignInRequest,
  ) {
    await this.limits.check(request.ip, 'sign-in', body.identifier);
    return this.passwords.signIn(body);
  }

  @Post('sign-up')
  @HttpCode(200)
  @Header('Cache-Control', 'private, no-store')
  async signUp(
    @Req() request: { ip: string },
    @Body(new ZodValidationPipe(PasswordSignUpRequestSchema)) body: PasswordSignUpRequest,
  ) {
    await this.limits.check(request.ip, 'sign-up', body.email);
    return this.passwords.signUp(body);
  }

  @Get('username-availability')
  @Header('Cache-Control', 'private, no-store')
  async availability(@Req() request: { ip: string }, @Query('username') username: unknown) {
    await this.limits.check(request.ip, 'availability');
    return this.passwords.availability(typeof username === 'string' ? username.slice(0, 320) : '');
  }
}
