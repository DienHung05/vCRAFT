import { createAdminClient } from '@supabase/server/core';

/**
 * Administration of identities held by Supabase Auth. Production uses {@link SupabaseAuthAdmin}
 * (secret key, server only); tests replace it with a fake so no real auth user is ever deleted.
 */
export abstract class AuthAdmin {
  /** Delete the identity. An identity that no longer exists counts as deleted. */
  abstract deleteUser(id: string): Promise<void>;
}

export class SupabaseAuthAdmin extends AuthAdmin {
  async deleteUser(id: string): Promise<void> {
    const { error } = await createAdminClient().auth.admin.deleteUser(id);
    if (error && error.status !== 404 && error.code !== 'user_not_found') throw error;
  }
}
