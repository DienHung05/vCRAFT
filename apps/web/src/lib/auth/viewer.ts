import { AccountApiError, type AccountClient, createAccountClient } from '@vcraft/api-client';
import type { MeDto } from '@vcraft/contracts';
import { cache } from 'react';
import { apiBaseUrl } from '@/lib/api/internal-url';
import { createServerSupabase } from './supabase-server';

/** Người đang đăng nhập theo CSDL vCraft (vai trò, trạng thái, hồ sơ hộ), không theo metadata Supabase. */
export type Viewer = MeDto;

/** API không trả lời được `GET /me`: khác hẳn với "chưa đăng nhập", nên guard không được coi là khách. */
export class ViewerUnavailableError extends Error {
  constructor() {
    super('viewer-unavailable');
    this.name = 'ViewerUnavailableError';
  }
}

const API_TIMEOUT_MS = 8000;

/**
 * Caller API cho Server Component, mang access token trong cookie phiên. Token chỉ được chuyển tiếp,
 * không tin ở đây: API tự kiểm chứng chữ ký qua JWKS. `null` khi không có phiên.
 */
export async function serverAccountClient(): Promise<AccountClient | null> {
  const supabase = await createServerSupabase();
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return null;
  return createAccountClient({
    getAccessToken: async () => token,
    // Client dùng đường dẫn `/api/v1/...` cùng origin; phía server đổi sang địa chỉ API nội bộ.
    fetch: (url, init) =>
      fetch(`${apiBaseUrl()}${url.replace(/^\/api\/v1/, '')}`, {
        ...init,
        signal: AbortSignal.timeout(API_TIMEOUT_MS),
      }),
  });
}

/**
 * Người dùng hiện tại, `null` nếu là khách (không có phiên hoặc token không còn hợp lệ). Gọi
 * `GET /me` một lần cho mỗi request render nhờ `cache`. Ném {@link ViewerUnavailableError} khi API sập.
 */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const client = await serverAccountClient();
  if (!client) return null;
  try {
    return await client.me();
  } catch (error) {
    if (error instanceof AccountApiError && error.status === 401) return null;
    throw new ViewerUnavailableError();
  }
});

/** Request có cookie phiên Supabase hay không (chưa hỏi API), cho trang cần biết "đã đăng nhập chưa". */
export async function hasServerSession(): Promise<boolean> {
  const supabase = await createServerSupabase();
  if (!supabase) return false;
  const { data } = await supabase.auth.getSession();
  return data.session !== null;
}
