'use client';

import { createAccountClient } from '@vcraft/api-client';
import type { MeDto } from '@vcraft/contracts';
import { useEffect, useState } from 'react';
import { favouritesStore } from '@/features/favourites/favourites-store';
import { ACCOUNT_CHANGED_EVENT, hasHouseholdIntent } from './household-intent';
import { hasAuthCookie } from './session-cookie';

export type AccountState =
  | { readonly status: 'loading' }
  | { readonly status: 'guest' }
  /** `me` là hồ sơ theo CSDL vCraft; `null` khi API chưa trả lời (vẫn biết email từ phiên). */
  | {
      readonly status: 'signed-in';
      readonly email: string;
      readonly me: MeDto | null;
      /** GH#180: the account started household registration (Supabase user metadata). */
      readonly householdIntent: boolean;
    };

interface SessionInfo {
  readonly email: string;
  readonly token: string;
  readonly householdIntent: boolean;
}

/**
 * Trạng thái đăng nhập ở trình duyệt cho phần hiển thị (menu tài khoản trong header). Đọc phiên từ
 * client Supabase dùng chung rồi hỏi `GET /me` lấy vai trò thật; đăng nhập/đăng xuất ở tab khác
 * cũng cập nhật theo. Chỉ để HIỂN THỊ: quyền vào trang do guard phía server và API quyết định.
 */
export function useAccount(): AccountState {
  const [session, setSession] = useState<SessionInfo | null | undefined>(undefined);
  const [me, setMe] = useState<MeDto | null>(null);

  useEffect(() => {
    // A guest holds no auth cookie: settle without loading the Supabase SDK (~60 KB gzip). Every way of
    // signing in ends in a full page load (see sign-in-form), which mounts this hook again.
    if (!hasAuthCookie(document.cookie)) {
      setSession(null);
      favouritesStore.startAsGuest();
      return;
    }
    let active = true;
    let unsubscribe: (() => void) | undefined;
    void import('./supabase-browser')
      .then(({ browserSupabase }) => {
        const supabase = browserSupabase();
        if (!active) return;
        if (!supabase) {
          setSession(null);
          favouritesStore.startAsGuest();
          return;
        }
        // INITIAL_SESSION được phát ngay khi đăng ký nên không cần getSession riêng. Callback chỉ ghi
        // state (không gọi lại Supabase bên trong) để tránh khóa vòng đời phiên.
        const { data } = supabase.auth.onAuthStateChange((_event, next) => {
          setSession(
            next
              ? {
                  email: next.user.email ?? '',
                  token: next.access_token,
                  householdIntent: hasHouseholdIntent(next.user.user_metadata),
                }
              : null,
          );
        });
        unsubscribe = () => data.subscription.unsubscribe();
      })
      .catch(() => {
        if (active) setSession(null);
      });
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, []);

  // GH#180: bumped when the role or household changes in this tab (e.g. the wizard's household step).
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const reload = () => setRevision((value) => value + 1);
    window.addEventListener(ACCOUNT_CHANGED_EVENT, reload);
    return () => window.removeEventListener(ACCOUNT_CHANGED_EVENT, reload);
  }, []);

  const token = session?.token;
  useEffect(() => {
    if (!token) {
      setMe(null);
      return;
    }
    // FR-CAT-07: the first time a session is seen, local favourites move to the account (once per page load).
    void favouritesStore.startAsAccount();
    let active = true;
    void revision;
    createAccountClient({ getAccessToken: async () => token })
      .me()
      .then((profile) => active && setMe(profile))
      .catch(() => active && setMe(null));
    return () => {
      active = false;
    };
  }, [token, revision]);

  if (session === undefined) return { status: 'loading' };
  if (session === null) return { status: 'guest' };
  return {
    status: 'signed-in',
    email: session.email,
    me,
    householdIntent: session.householdIntent,
  };
}
