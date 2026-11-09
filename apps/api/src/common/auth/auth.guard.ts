import { MikroORM } from '@mikro-orm/core';
import {
  type CanActivate,
  createParamDecorator,
  type ExecutionContext,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AccountInvitation, AppUser, ConsentRecord, LoginEvent } from '@vcraft/database';
import { type AccountRole, isCurrentPolicyVersion } from '@vcraft/domain';
import { AppError } from '../errors/app-error';
import type { HttpRequest } from '../http/http-types';
import { clientHints } from './client-hints';
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
  /** Supabase session id of this request's token, when the token carries one. */
  readonly sessionId?: string;
}

type RequestWithActor = HttpRequest & { actor?: Actor | null };

export const PUBLIC_KEY = 'vcraft:public';
export const ROLES_KEY = 'vcraft:roles';
export const AAL2_KEY = 'vcraft:aal2';
export const ALLOW_SUSPENDED_KEY = 'vcraft:allow-suspended';

/** Route công khai: không bắt buộc đăng nhập (nếu có token hợp lệ thì vẫn gắn `actor`). */
export const Public = () => SetMetadata(PUBLIC_KEY, true);
export const PUBLIC_STATE_CHANGE_KEY = 'vcraft:public-state-change';
/**
 * Marks a public handler that changes state although its HTTP method is GET (a provider IPN that is a GET).
 * Has no effect at runtime; the route policy test requires every marked route to be reviewed and listed.
 */
export const PublicStateChange = () => SetMetadata(PUBLIC_STATE_CHANGE_KEY, true);
/** Giới hạn vai trò được gọi route. */
export const Roles = (...roles: AccountRole[]) => SetMetadata(ROLES_KEY, roles);
/**
 * GH#83: an admin calling this route needs an `aal2` session (TOTP done). Every route open to the ADMIN
 * role already requires it; this marks other routes explicitly.
 */
export const RequireAal2 = () => SetMetadata(AAL2_KEY, true);

/**
 * FR-AUTH-10: a suspended account is refused on every route with `AUTH_ACCOUNT_SUSPENDED` (403). A route
 * marked with this stays open to it; only `GET /me`, so the web can tell the person why they are locked out.
 */
export const AllowSuspended = () => SetMetadata(ALLOW_SUSPENDED_KEY, true);

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

    // A public route may be called with a credential that is not a user session: a provider webhook carries
    // `Authorization: Apikey <key>` (SePay), which the route checks itself. Only a Bearer token is a session.
    const authorization = request.headers.authorization;
    const sessionless =
      isPublic && !(typeof authorization === 'string' && /^Bearer\s/i.test(authorization));
    const actor = sessionless ? null : await this.resolveActor(request);
    request.actor = actor;
    if (isPublic) return true;
    if (!actor) throw new AppError('AUTH_UNAUTHENTICATED');
    // FR-AUTH-10: the database status is checked on every request, so a suspension holds at once, before the
    // Supabase ban has made the person's token stop verifying.
    if (actor.locked && !this.reflector.getAllAndOverride<boolean>(ALLOW_SUSPENDED_KEY, targets))
      throw new AppError('AUTH_ACCOUNT_SUSPENDED');
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
      // FR-AUTH-03: a person invited by an administrator gets the invited role on the first sign-in, but
      // only once Supabase confirms they own the address (accepting the invitation mail confirms it).
      const invitation = identity.emailVerified
        ? await em.findOne(AccountInvitation, {
            email: identity.email.trim().toLowerCase(),
            status: 'PENDING',
          })
        : null;
      user = em.create(AppUser, {
        id: identity.sub,
        email: identity.email,
        role: invitation?.role ?? 'BUYER',
      });
      if (invitation) {
        invitation.status = 'ACCEPTED';
        invitation.acceptedAt = new Date();
      }
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
    if (identity.sessionId) await this.recordSignIn(user.id, identity, request.headers);
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      locked: user.status === 'LOCKED',
      emailVerified: identity.emailVerified === true,
      aal: identity.aal ?? 'aal1',
      ...(identity.sessionId && { sessionId: identity.sessionId }),
    };
  }

  /** First request of a Supabase session: one `LoginEvent` row (GH#83); later requests skip the database. */
  private async recordSignIn(
    userId: string,
    identity: { sessionId?: string; method?: string; aal?: 'aal1' | 'aal2' },
    headers: HttpRequest['headers'],
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
        ...clientHints(headers),
      });
      // A parallel request of the same new session may have written it first; that is fine.
      await em.flush().catch(() => undefined);
    }
    if (RECORDED_SESSIONS.size >= RECORDED_SESSIONS_MAX) RECORDED_SESSIONS.clear();
    RECORDED_SESSIONS.add(key);
  }
}
