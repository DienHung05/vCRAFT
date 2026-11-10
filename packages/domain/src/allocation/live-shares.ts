/**
 * Shares that still count toward the order: a cancelled share and a declined share whose quantity has
 * been reallocated (GH#246) are history, so they neither block production nor delivery. The API
 * guards and the web "all done" checks must use this one rule (GH#416).
 */
export function liveShares<T extends { status: string; quantity: number }>(
  allocations: readonly T[],
): T[] {
  return allocations.filter(
    (a) => a.status !== 'CANCELLED' && !(a.status === 'DECLINED' && a.quantity === 0),
  );
}
