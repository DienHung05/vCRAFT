'use client';

import { createAccountClient } from '@vcraft/api-client';
import type { MeDto } from '@vcraft/contracts';
import { useEffect, useState } from 'react';
import { browserSupabase } from './supabase-browser';

export type AccountState =
  | { readonly status: 'loading' }
  | { readonly status: 'guest' }
  /** `me` là hồ sơ theo CSDL vCraft; `null` khi API chưa trả lời (vẫn biết email từ phiên). */
  | { readonly status: 'signed-in'; readonly email: string; readonly me: MeDto | null };

interface SessionInfo {
  readonly email: string;
  readonly token: string;
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
    const supabase = browserSupabase();
    if (!supabase) {
      setSession(null);
      return;
    }
    // INITIAL_SESSION được phát ngay khi đăng ký nên không cần getSession riêng. Callback chỉ ghi
    // state (không gọi lại Supabase bên trong) để tránh khóa vòng đời phiên.
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next ? { email: next.user.email ?? '', token: next.access_token } : null);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const token = session?.token;
  useEffect(() => {
    if (!token) {
      setMe(null);
      return;
    }
    let active = true;
    createAccountClient({ getAccessToken: async () => token })
      .me()
      .then((profile) => active && setMe(profile))
      .catch(() => active && setMe(null));
    return () => {
      active = false;
    };
  }, [token]);

  if (session === undefined) return { status: 'loading' };
  if (session === null) return { status: 'guest' };
  return { status: 'signed-in', email: session.email, me };
}
