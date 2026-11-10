import { type EntityManager, type FilterQuery, MikroORM, raw } from '@mikro-orm/core';
import { Injectable } from '@nestjs/common';
import type {
  AdminUserDto,
  AdminUserListDto,
  AdminUserListQuery,
  InvitationDto,
  InvitationListDto,
  InviteAccountRequest,
  SuspendUserRequest,
  UnsuspendUserRequest,
} from '@vcraft/contracts';
import { AccountInvitation, AppUser, AuditLog } from '@vcraft/database';
import type { Actor } from '../../../common/auth/auth.guard';
import { AuthAdmin, IdentityExistsError } from '../../../common/auth/auth-admin';
import { AppError, notFound } from '../../../common/errors/app-error';

const accountName = (user: AppUser) => user.fullName ?? user.email;

const toUserDto = (user: AppUser): AdminUserDto => ({
  id: user.id,
  email: user.email,
  username: user.username ?? null,
  fullName: user.fullName ?? null,
  role: user.role,
  status: user.status === 'LOCKED' ? 'LOCKED' : 'ACTIVE',
  statusReason: user.statusReason ?? null,
  createdAt: user.createdAt.toISOString(),
});

const toInvitationDto = (row: AccountInvitation, invitedByName: string | null): InvitationDto => ({
  id: row.id,
  email: row.email,
  role: row.role,
  status: row.status,
  invitedByName,
  createdAt: row.createdAt.toISOString(),
  acceptedAt: row.acceptedAt?.toISOString() ?? null,
});

/** Escapes the wildcards of a SQL `LIKE` pattern so a search term is matched literally. */
const likeLiteral = (term: string) => term.replace(/[\\%_]/g, (char) => `\\${char}`);

/**
 * Account administration for the board (GH#239): suspend and unsuspend an account (FR-AUTH-10) and
 * invite people by email (FR-AUTH-03). Every change is written to the audit log in the same
 * transaction. The Supabase call is the last step before the commit, as in account deletion: when
 * Supabase refuses, nothing is committed and the administrator can retry.
 */
@Injectable()
export class AccountAdminService {
  constructor(
    private readonly orm: MikroORM,
    private readonly authAdmin: AuthAdmin,
  ) {}

  async listUsers(query: AdminUserListQuery): Promise<AdminUserListDto> {
    const and: FilterQuery<AppUser>[] = [{ status: query.status ?? { $in: ['ACTIVE', 'LOCKED'] } }];
    if (query.role) and.push({ role: query.role });
    const term = query.q?.trim();
    if (term) {
      // Emails and usernames are stored in lowercase; names are lowered in SQL so the search is
      // case-insensitive on both drivers (PostgreSQL `like` is case-sensitive, MySQL's is not).
      const lower = `%${likeLiteral(term.toLowerCase())}%`;
      and.push({
        $or: [
          { email: { $like: lower } },
          { username: { $like: lower } },
          { [raw((alias) => `lower(${alias}.full_name)`)]: { $like: lower } },
        ],
      });
    }
    const rows = await this.orm.em
      .fork()
      .find(
        AppUser,
        { $and: and },
        { orderBy: { createdAt: 'desc', id: 'desc' }, limit: query.limit },
      );
    return { items: rows.map(toUserDto) };
  }

  /**
   * Marks the account `LOCKED` with the reason and bans the Supabase identity (`ban_duration`), so the
   * person's refresh token stops working. From the next request the guard answers 403.
   */
  async suspend(actor: Actor, id: string, input: SuspendUserRequest): Promise<AdminUserDto> {
    if (id === actor.id)
      throw new AppError('BUSINESS_RULE_VIOLATED', 'You cannot suspend your own account.');
    return this.orm.em.fork().transactional(async (em) => {
      const user = await this.liveUser(em, id);
      if (user.status === 'LOCKED')
        throw new AppError('INVALID_TRANSITION', 'The account is already suspended.');
      const before = { status: user.status, reason: user.statusReason ?? null };
      user.status = 'LOCKED';
      user.statusReason = input.reason;
      em.create(AuditLog, {
        actorId: actor.id,
        action: 'user.suspend',
        entity: 'app_user',
        entityId: user.id,
        before,
        after: { status: 'LOCKED', reason: input.reason },
      });
      await em.flush();
      await this.authAdmin.banUser(user.id);
      return toUserDto(user);
    });
  }

  /** Lifts the suspension and the Supabase ban; the person can sign in again. */
  async unsuspend(actor: Actor, id: string, input: UnsuspendUserRequest): Promise<AdminUserDto> {
    return this.orm.em.fork().transactional(async (em) => {
      const user = await this.liveUser(em, id);
      if (user.status !== 'LOCKED')
        throw new AppError('INVALID_TRANSITION', 'The account is not suspended.');
      const before = { status: user.status, reason: user.statusReason ?? null };
      user.status = 'ACTIVE';
      user.statusReason = null;
      em.create(AuditLog, {
        actorId: actor.id,
        action: 'user.unsuspend',
        entity: 'app_user',
        entityId: user.id,
        before,
        after: { status: 'ACTIVE', ...(input.reason && { reason: input.reason }) },
      });
      await em.flush();
      await this.authAdmin.unbanUser(user.id);
      return toUserDto(user);
    });
  }

  async listInvitations(): Promise<InvitationListDto> {
    const em = this.orm.em.fork();
    const rows = await em.find(
      AccountInvitation,
      {},
      { orderBy: { createdAt: 'desc', id: 'desc' }, limit: 50 },
    );
    const inviters = await em.find(AppUser, {
      id: { $in: [...new Set(rows.map((row) => row.invitedBy))] },
    });
    const names = new Map(
      inviters
        .filter((user) => user.status !== 'DELETED')
        .map((user) => [user.id, accountName(user)]),
    );
    return { items: rows.map((row) => toInvitationDto(row, names.get(row.invitedBy) ?? null)) };
  }

  /**
   * Records the invitation, then asks Supabase to send the mail. The role is applied on the invited
   * person's first sign-in with this verified address (see `AuthGuard`). Inviting an address again
   * resends the mail and replaces the role.
   */
  async invite(actor: Actor, input: InviteAccountRequest): Promise<InvitationDto> {
    return this.orm.em.fork().transactional(async (em) => {
      if (await em.findOne(AppUser, { email: input.email, status: { $ne: 'DELETED' } }))
        throw new AppError('CONFLICT_DUPLICATE', 'This email already has an account.');
      let invitation = await em.findOne(AccountInvitation, { email: input.email });
      const before = invitation ? { role: invitation.role, status: invitation.status } : null;
      if (invitation) {
        invitation.role = input.role;
        invitation.status = 'PENDING';
        invitation.acceptedAt = null;
        invitation.invitedBy = actor.id;
      } else {
        invitation = em.create(AccountInvitation, {
          email: input.email,
          role: input.role,
          invitedBy: actor.id,
        });
      }
      em.create(AuditLog, {
        actorId: actor.id,
        action: 'user.invite',
        entity: 'account_invitation',
        entityId: invitation.id,
        before,
        after: { email: input.email, role: input.role, status: 'PENDING' },
      });
      await em.flush();
      try {
        await this.authAdmin.inviteUserByEmail(input.email, input.role);
      } catch (error) {
        if (error instanceof IdentityExistsError)
          throw new AppError('CONFLICT_DUPLICATE', 'This email already has an account.');
        throw error;
      }
      return toInvitationDto(invitation, accountName(await em.findOneOrFail(AppUser, actor.id)));
    });
  }

  private async liveUser(em: EntityManager, id: string): Promise<AppUser> {
    const user = await em.findOne(AppUser, id);
    if (!user || user.status === 'DELETED') throw notFound();
    return user;
  }
}
