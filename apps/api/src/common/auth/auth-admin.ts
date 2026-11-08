import { createAdminClient } from '@supabase/server/core';
import type { AccountRole } from '@vcraft/domain';

/** The address already belongs to a Supabase identity that finished sign-up. */
export class IdentityExistsError extends Error {}

/**
 * How long a suspended account stays banned on Supabase (~100 years). Supabase has no "forever"; the ban
 * is lifted explicitly on unsuspend.
 */
export const SUSPENSION_BAN_DURATION = '876000h';

/**
 * Administration of identities held by Supabase Auth. Production uses {@link SupabaseAuthAdmin}
 * (secret key, server only); tests replace it with a fake so no real auth user is ever touched.
 */
export abstract class AuthAdmin {
  /** Delete the identity. An identity that no longer exists counts as deleted. */
  abstract deleteUser(id: string): Promise<void>;

  /**
   * Ban the identity (`ban_duration`, FR-AUTH-10): its refresh tokens stop working and password sign-in
   * fails, so a suspended person cannot get a new session. An identity that does not exist is skipped.
   */
  abstract banUser(id: string): Promise<void>;

  /** Lift the ban of {@link banUser}. */
  abstract unbanUser(id: string): Promise<void>;

  /**
   * Send the invitation email (`inviteUserByEmail`, FR-AUTH-03). Throws {@link IdentityExistsError} when the
   * address already has a confirmed account. Inviting an address that was invited before resends the mail.
   * `role` only picks the wording of the mail; the role itself is applied from our own invitation row.
   */
  abstract inviteUserByEmail(email: string, role: AccountRole): Promise<void>;

  /**
   * Sign every session of the owner of `accessToken` out except the one that token belongs to
   * (`signOut` with scope `others`, FR-AUTH-05): the other refresh tokens are revoked.
   */
  abstract signOutOthers(accessToken: string): Promise<void>;
}

const isMissingUser = (error: { status?: number; code?: string }) =>
  error.status === 404 || error.code === 'user_not_found';

export class SupabaseAuthAdmin extends AuthAdmin {
  async deleteUser(id: string): Promise<void> {
    const { error } = await createAdminClient().auth.admin.deleteUser(id);
    if (error && !isMissingUser(error)) throw error;
  }

  async banUser(id: string): Promise<void> {
    await this.setBan(id, SUSPENSION_BAN_DURATION);
  }

  async unbanUser(id: string): Promise<void> {
    await this.setBan(id, 'none');
  }

  private async setBan(id: string, banDuration: string): Promise<void> {
    const { error } = await createAdminClient().auth.admin.updateUserById(id, {
      ban_duration: banDuration,
    });
    if (error && !isMissingUser(error)) throw error;
  }

  async inviteUserByEmail(email: string, role: AccountRole): Promise<void> {
    const { error } = await createAdminClient().auth.admin.inviteUserByEmail(email, {
      data: { invited_as: role },
    });
    if (!error) return;
    if (error.code === 'email_exists' || error.code === 'user_already_exists')
      throw new IdentityExistsError(error.message);
    throw error;
  }

  async signOutOthers(accessToken: string): Promise<void> {
    const { error } = await createAdminClient().auth.admin.signOut(accessToken, 'others');
    // A token Supabase no longer knows has no other sessions worth keeping.
    if (error && !isMissingUser(error)) throw error;
  }
}
