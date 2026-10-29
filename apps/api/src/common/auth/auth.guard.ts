import { MikroORM } from '@mikro-orm/core';
import {
  type CanActivate,
  createParamDecorator,
  type ExecutionContext,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AppUser } from '@vcraft/database';
import type { AccountRole } from '@vcraft/domain';
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
}

type RequestWithActor = HttpRequest & { actor?: Actor | null };

const PUBLIC_KEY = 'vcraft:public';
const ROLES_KEY = 'vcraft:roles';

/** Route công khai: không bắt buộc đăng nhập (nếu có token hợp lệ thì vẫn gắn `actor`). */
export const Public = () => SetMetadata(PUBLIC_KEY, true);
/** Giới hạn vai trò được gọi route. */
export const Roles = (...roles: AccountRole[]) => SetMetadata(ROLES_KEY, roles);

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
      await em.flush();
    }
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      locked: user.status === 'LOCKED',
      emailVerified: identity.emailVerified === true,
    };
  }
}
