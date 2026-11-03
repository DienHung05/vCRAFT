import { Controller, Get, Header } from '@nestjs/common';
import { type Actor, CurrentActor } from '../../common/auth/auth.guard';
import { UsersService } from './application/users.service';

/** `GET /me`: mọi vai trò đã đăng nhập (kể cả tài khoản bị khóa, để giao diện giải thích được lý do). */
@Controller('me')
export class MeController {
  constructor(private readonly users: UsersService) {}

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
