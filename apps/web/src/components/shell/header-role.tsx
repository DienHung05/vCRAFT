'use client';

import type { AccountRole } from '@vcraft/domain';
import { createContext, type ReactNode, useContext } from 'react';
import { useAccount } from '@/lib/auth/use-account';

export interface HeaderRole {
  /** `null` for a guest, and until the session is known: the server HTML is the guest version. */
  readonly role: AccountRole | null;
}

const HeaderRoleContext = createContext<HeaderRole>({ role: null });

export function useHeaderRole(): HeaderRole {
  return useContext(HeaderRoleContext);
}

/**
 * Reads the viewer once for both header navs (bar and narrow menu). The header stays a server
 * component with the guest markup, so it caches; this provider only changes the quotation tab after
 * hydration. Display only: access is decided by the area guards and the API.
 *
 * GH#490: the household tab opens the open coordinated requests, a different destination from the
 * Studio "invitations" tab, so it no longer carries that tab's open-invitations badge (and the header
 * no longer calls `/me/invitations`).
 */
export function HeaderRoleProvider({ children }: { children: ReactNode }) {
  const account = useAccount();
  const role = account.status === 'signed-in' ? (account.me?.role ?? null) : null;
  return <HeaderRoleContext.Provider value={{ role }}>{children}</HeaderRoleContext.Provider>;
}
