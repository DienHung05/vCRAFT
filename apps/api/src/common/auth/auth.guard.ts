import { MikroORM } from '@mikro-orm/core';
import {
  type CanActivate,
  createParamDecorator,
  type ExecutionContext,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AppUser, ConsentRecord, LoginEvent } from '@vcraft/database';
import { type AccountRole, isCurrentPolicyVersion } from '@vcraft/domain';
import { AppError } from '../errors/app-error';
import type { HttpRequest } from '../http/http-types';
import { IdentityVerifier, InvalidTokenError } from './identity-verifier';

/** Tác nhân của request: tài khoản vCraft đã xác thực (một vai trò cho mỗi tài khoản). */
export interface Actor {
  readonly id: string;
  readonly email: string;
  readonly role: AccountRole;
  readonly locked: boolean;
  readonly emailVerified?: boolean;
  /** `aal2` once the session passed the second factor; tokens without the claim count as `aal1`. */
  readonly aal: 'aal1' | 'aal2';
}

type RequestWithActor = HttpRequest & { actor?: Actor | null };

export const PUBLIC_KEY = 'vcraft:public';
export const ROLES_KEY = 'vcraft:roles';
export const AAL2_KEY = 'vcraft:aal2';

/** Route công khai: không bắt buộc đăng nhập (nếu có token hợp lệ thì vẫn gắn `actor`). */
export const Public = () => SetMetadata(PUBLIC_KEY, true);
/** Giới hạn vai trò được gọi route. */
export const Roles = (...roles: AccountRole[]) => SetMetadata(ROLES_KEY, roles);
/**
 * GH#83: an admin calling this route needs an `aal2` session (TOTP done). Every route open to the ADMIN
 * role already requires it; this marks other routes explicitly.
 */
export const RequireAal2 = () => SetMetadata(AAL2_KEY, true);

/** `AUTH_ADMIN_MFA=off` lifts the admin second-factor rule (local demos without Supabase MFA). */
export const adminMfaEnforced = () => process.env.AUTH_ADMIN_MFA?.trim().toLowerCase() !== 'off';

/** Whether this admin still has to pass the second factor before the admin area. */
export const needsSecondFactor = (actor: Pick<Actor, 'role' | 'aal'>) =>
  actor.role === 'ADMIN' && actor.aal !== 'aal2' && adminMfaEnforced();

// Sessions already recorded by this process, so a sign-in is written once, not on every request.
const RECORDED_SESSIONS = new Set<string>();
const RECORDED_SESSIONS_MAX = 10_000;

export const CurrentActor = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): Actor | null =>
    ctx.switchToHttp().getRequest<RequestWithActor>().actor ?? null,
);

/**
 * Guard toàn cục (ARCHITECTURE §7.5): kiểm chứng token, nạp `AppUser` theo `sub`; lần đầu thì tạo hồ sơ
 * vai trò `BUYER` (hồ sơ lười, không trigger trong schema `auth`). Vai trò ADMIN/HOUSEHOLD chỉ do
 * Ban quản lý / dữ liệu mẫu cấp, không tự nâng được.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly verifier: IdentityVerifier,
    private readonly orm: MikroORM,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, targets) ?? false;
    const roles = this.reflector.getAllAndOverride<AccountRole[]>(ROLES_KEY, targets);
    const request = context.switchToHttp().getRequest<RequestWithActor>();

    const actor = await this.resolveActor(request);
    request.actor = actor;
    if (isPublic) return true;
    if (!actor) throw new AppError('AUTH_UNAUTHENTICATED');
    if (roles && !roles.includes(actor.role)) throw new AppError('AUTH_FORBIDDEN');
    const aal2 =
      this.reflector.getAllAndOverride<boolean>(AAL2_KEY, targets) || roles?.includes('ADMIN');
    if (aal2 && needsSecondFactor(actor)) throw new AppError('AUTH_MFA_REQUIRED');
    return true;
  }

  private async resolveActor(request: HttpRequest): Promise<Actor | null> {
    let identity: Awaited<ReturnType<IdentityVerifier['verify']>>;
    try {
      identity = await this.verifier.verify(request.headers);
    } catch (error) {
      if (error instanceof InvalidTokenError) throw new AppError('AUTH_TOKEN_INVALID');
      throw error;
    }
    if (!identity) return null;

    const em = this.orm.em.fork();
    let user = await em.findOne(AppUser, identity.sub);
    if (!user) {
      user = em.create(AppUser, { id: identity.sub, email: identity.email, role: 'BUYER' });
      // The sign-up form's consent box travels in the user metadata; record it with the new account.
      if (identity.consentPolicyVersion && isCurrentPolicyVersion(identity.consentPolicyVersion)) {
        em.create(ConsentRecord, {
          userId: user.id,
          purpose: 'SIGN_UP',
          policyVersion: identity.consentPolicyVersion,
        });
      }
      await em.flush();
    }
    // The person deleted their account (NFR-SEC-07); a token issued before that must stop working now.
    if (user.status === 'DELETED') throw new AppError('AUTH_TOKEN_INVALID');
    if (identity.sessionId) await this.recordSignIn(user.id, identity);
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      locked: user.status === 'LOCKED',
      emailVerified: identity.emailVerified === true,
      aal: identity.aal ?? 'aal1',
    };
  }

  /** First request of a Supabase session: one `LoginEvent` row (GH#83); later requests skip the database. */
  private async recordSignIn(
    userId: string,
    identity: { sessionId?: string; method?: string; aal?: 'aal1' | 'aal2' },
  ): Promise<void> {
    const sessionId = identity.sessionId as string;
    // Keyed with the level, so a session that later passes TOTP is looked at once more.
    const key = `${sessionId}:${identity.aal ?? 'aal1'}`;
    if (RECORDED_SESSIONS.has(key)) return;
    const em = this.orm.em.fork();
    const existing = await em.findOne(LoginEvent, { sessionId });
    if (existing) {
      // The session passed TOTP after it started: keep the history truthful.
      if (identity.aal === 'aal2' && existing.aal !== 'aal2') {
        existing.aal = 'aal2';
        await em.flush();
      }
    } else {
      em.create(LoginEvent, {
        userId,
        sessionId,
        method: identity.method ?? 'unknown',
        aal: identity.aal ?? 'aal1',
      });
      // A parallel request of the same new session may have written it first; that is fine.
      await em.flush().catch(() => undefined);
    }
    if (RECORDED_SESSIONS.size >= RECORDED_SESSIONS_MAX) RECORDED_SESSIONS.clear();
    RECORDED_SESSIONS.add(key);
  }
}
