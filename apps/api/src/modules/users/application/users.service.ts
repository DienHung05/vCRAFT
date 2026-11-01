import { MikroORM } from '@mikro-orm/core';
import { Injectable } from '@nestjs/common';
import type { MeDto } from '@vcraft/contracts';
import { AppUser, Household } from '@vcraft/database';
import type { Actor } from '../../../common/auth/auth.guard';
import { notFound } from '../../../common/errors/app-error';

/** Hồ sơ của chính người đang đăng nhập; đọc từ CSDL vCraft, không tin dữ liệu client gửi lên. */
@Injectable()
export class UsersService {
  constructor(private readonly orm: MikroORM) {}

  async me(actor: Actor): Promise<MeDto> {
    const em = this.orm.em.fork();
    const user = await em.findOne(AppUser, actor.id);
    if (!user) throw notFound();
    const household = await em.findOne(Household, { representative: user });
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName ?? null,
      role: user.role,
      // The guard turns away deleted accounts before this runs.
      status: user.status === 'LOCKED' ? 'LOCKED' : 'ACTIVE',
      emailVerified: actor.emailVerified === true,
      household: household
        ? {
            id: household.id,
            name: household.name,
            slug: household.slug,
            status: household.status,
            statusReason: household.statusReason ?? null,
          }
        : null,
    };
  }
}
