'use client';

import type { AccountRole } from '@vcraft/domain';
import { createContext, type ReactNode, useContext, useEffect, useState } from 'react';
import { summarizeInvitations } from '@/features/studio/invitation-summary';
import { useQuotationClient } from '@/lib/api/use-quotation-client';
import { useAccount } from '@/lib/auth/use-account';

export interface HeaderRole {
  /** `null` for a guest, and until the session is known: the server HTML is the guest version. */
  readonly role: AccountRole | null;
  /** Open invitations of a household viewer; 0 for everybody else or when unknown. */
  readonly openInvitations: number;
}

const HeaderRoleContext = createContext<HeaderRole>({ role: null, openInvitations: 0 });

export function useHeaderRole(): HeaderRole {
  return useContext(HeaderRoleContext);
}

/**
 * Reads the viewer once for both header navs (bar and narrow menu). The header stays a server
 * component with the guest markup, so it caches; this provider only changes the quotation tab after
 * hydration. Display only: access is decided by the area guards and the API.
 */
export function HeaderRoleProvider({ children }: { children: ReactNode }) {
  const account = useAccount();
  const role = account.status === 'signed-in' ? (account.me?.role ?? null) : null;
  const [openInvitations, setOpenInvitations] = useState(0);
  return (
    <HeaderRoleContext.Provider
      value={{ role, openInvitations: role === 'HOUSEHOLD' ? openInvitations : 0 }}
    >
      {role === 'HOUSEHOLD' ? <OpenInvitationsLoader onCount={setOpenInvitations} /> : null}
      {children}
    </HeaderRoleContext.Provider>
  );
}

/** Mounted for household viewers only, so guests and buyers never call `/me/invitations`. */
function OpenInvitationsLoader({ onCount }: { onCount: (count: number) => void }) {
  const { client } = useQuotationClient();
  useEffect(() => {
    if (!client) return;
    let active = true;
    client
      .listInvitations()
      .then((rows) => active && onCount(summarizeInvitations(rows).openCount))
      // The badge is a hint: a failed load just leaves the tab without it.
      .catch(() => active && onCount(0));
    return () => {
      active = false;
    };
  }, [client, onCount]);
  return null;
}
