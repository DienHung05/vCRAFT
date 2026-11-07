import { Body, Controller, Get, Header, Put } from '@nestjs/common';
import { ChooseUsernameRequestSchema } from '@vcraft/contracts';
import { type Actor, CurrentActor } from '../../common/auth/auth.guard';
import { PasswordAuthService } from '../../common/auth/password-auth.service';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { UsersService } from './application/users.service';

/** `GET /me`: mọi vai trò đã đăng nhập (kể cả tài khoản bị khóa, để giao diện giải thích được lý do). */
@Controller('me')
export class MeController {
  constructor(
    private readonly users: UsersService,
    private readonly passwords: PasswordAuthService,
  ) {}

  @Put('username')
  @Header('Cache-Control', 'private, no-store')
  chooseUsername(
    @CurrentActor() actor: Actor,
    @Body(new ZodValidationPipe(ChooseUsernameRequestSchema)) body: { username: string },
  ) {
    return this.passwords.chooseUsername(actor.id, body.username);
  }

  @Get()
  @Header('Cache-Control', 'private, no-store')
  me(@CurrentActor() actor: Actor) {
    return this.users.me(actor);
  }

  /** Sign-in history for the account security page (GH#83). */
  @Get('login-events')
  @Header('Cache-Control', 'private, no-store')
  loginEvents(@CurrentActor() actor: Actor) {
    return this.users.loginEvents(actor);
  }
}
