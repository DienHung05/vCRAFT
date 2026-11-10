import type { MyInvitationDto } from '@vcraft/contracts';

/** An invitation whose request still accepts offers: bidding stage and the deadline is ahead. */
export function isOpenInvitation({ request }: MyInvitationDto, now = Date.now()): boolean {
  return (
    ['SENT', 'BIDDING'].includes(request.status) &&
    new Date(request.biddingClosesAt).getTime() > now
  );
}

/**
 * What the household has left to answer: invitations that are open and not declined, with the
 * nearest bidding deadline among them (ISO string, `null` when none).
 */
export function summarizeInvitations(
  rows: readonly MyInvitationDto[],
  now = Date.now(),
): { openCount: number; nearestDeadline: string | null } {
  const open = rows.filter((row) => !row.declined && isOpenInvitation(row, now));
  const nearest = open
    .map((row) => row.request.biddingClosesAt)
    .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())[0];
  return { openCount: open.length, nearestDeadline: nearest ?? null };
}
