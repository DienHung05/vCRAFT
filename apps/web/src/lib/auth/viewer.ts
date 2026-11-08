import { AccountApiError, type AccountClient, createAccountClient } from '@vcraft/api-client';
import type { MeDto } from '@vcraft/contracts';
import { cache } from 'react';
import { apiBaseUrl } from '@/lib/api/internal-url';
import { resilientFetch } from '@/lib/api/resilient-fetch';
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
    // Bounded by a timeout, with one quick retry for a rate limit, a gateway error or an HTML challenge page.
    fetch: (url, init) => resilientFetch(`${apiBaseUrl()}${url.replace(/^\/api\/v1/, '')}`, init),
  });
}

/** Result of asking the API who is signed in; "unavailable" is neither a guest nor a failure to render. */
export type ViewerState =
  | { status: 'signed-in'; viewer: Viewer }
  | { status: 'guest' }
  | { status: 'unavailable' };

/**
 * Who is signed in, without throwing: a guest (no session, or a token the API rejects with 401), a signed-in
 * viewer, or "unavailable" when `GET /me` still fails after the timeout and retry of {@link serverAccountClient}
 * (slow API, 429/503, an HTML challenge page). Layouts use it to render a retryable inline state instead of
 * an HTTP 500 document. One `GET /me` per render request thanks to `cache`.
 */
export const getViewerState = cache(async (): Promise<ViewerState> => {
  const client = await serverAccountClient();
  if (!client) return { status: 'guest' };
  try {
    return { status: 'signed-in', viewer: await client.me() };
  } catch (error) {
    if (error instanceof AccountApiError && error.status === 401) return { status: 'guest' };
    return { status: 'unavailable' };
  }
});

/**
 * Người dùng hiện tại, `null` nếu là khách (không có phiên hoặc token không còn hợp lệ). Ném
 * {@link ViewerUnavailableError} khi API không trả lời được; trang nào muốn hiện trạng thái thử lại thay
 * vì lỗi thì dùng {@link getViewerState}.
 */
export async function getViewer(): Promise<Viewer | null> {
  const state = await getViewerState();
  if (state.status === 'unavailable') throw new ViewerUnavailableError();
  return state.status === 'signed-in' ? state.viewer : null;
}

/** Request có cookie phiên Supabase hay không (chưa hỏi API), cho trang cần biết "đã đăng nhập chưa". */
export async function hasServerSession(): Promise<boolean> {
  const supabase = await createServerSupabase();
  if (!supabase) return false;
  const { data } = await supabase.auth.getSession();
  return data.session !== null;
}
