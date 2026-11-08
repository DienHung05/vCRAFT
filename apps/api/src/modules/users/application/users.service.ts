import { MikroORM } from '@mikro-orm/core';
import { Injectable } from '@nestjs/common';
import type { LoginEventListDto, MeDto } from '@vcraft/contracts';
import { AppUser, Household, LoginEvent } from '@vcraft/database';
import { type Actor, needsSecondFactor } from '../../../common/auth/auth.guard';
import { AuthAdmin } from '../../../common/auth/auth-admin';
import { notFound } from '../../../common/errors/app-error';

/** Hồ sơ của chính người đang đăng nhập; đọc từ CSDL vCraft, không tin dữ liệu client gửi lên. */
@Injectable()
export class UsersService {
  constructor(
    private readonly orm: MikroORM,
    private readonly authAdmin: AuthAdmin,
  ) {}

  async me(actor: Actor): Promise<MeDto> {
    const em = this.orm.em.fork();
    const user = await em.findOne(AppUser, actor.id);
    if (!user) throw notFound();
    const household = await em.findOne(Household, { representative: user });
    return {
      id: user.id,
      email: user.email,
      username: user.username ?? null,
      fullName: user.fullName ?? null,
      role: user.role,
      // The guard turns away deleted accounts before this runs.
      status: user.status === 'LOCKED' ? 'LOCKED' : 'ACTIVE',
      emailVerified: actor.emailVerified === true,
      mfaRequired: needsSecondFactor(actor),
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

  /** The account's last 20 sign-ins, newest first (GH#83). */
  async loginEvents(actor: Actor): Promise<LoginEventListDto> {
    const rows = await this.orm.em
      .fork()
      .find(
        LoginEvent,
        { userId: actor.id },
        { orderBy: { createdAt: 'desc', id: 'desc' }, limit: 20 },
      );
    return {
      items: rows.map((row) => ({
        id: row.id,
        method: row.method,
        aal: row.aal === 'aal2' ? 'aal2' : 'aal1',
        browser: row.browser ?? null,
        country: row.country ?? null,
        current: actor.sessionId !== undefined && row.sessionId === actor.sessionId,
        signedOutAt: row.revokedAt?.toISOString() ?? null,
        createdAt: row.createdAt.toISOString(),
      })),
    };
  }

  /**
   * Sign every other session of the account out (FR-AUTH-05): Supabase revokes the other refresh tokens
   * (`signOut` scope `others`, through the token of this request), then the history marks them signed out.
   * The Supabase call comes first, so a failure there leaves the history untouched.
   */
  async signOutOtherSessions(actor: Actor, accessToken: string): Promise<LoginEventListDto> {
    await this.authAdmin.signOutOthers(accessToken);
    if (actor.sessionId) {
      const em = this.orm.em.fork();
      const others = await em.find(LoginEvent, {
        userId: actor.id,
        sessionId: { $ne: actor.sessionId },
        revokedAt: null,
      });
      const now = new Date();
      for (const row of others) row.revokedAt = now;
      await em.flush();
    }
    return this.loginEvents(actor);
  }
}
