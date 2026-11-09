import type { ProductCardDto } from '@vcraft/contracts';
import { hasAuthCookie } from '@/lib/auth/session-cookie';
import { readLocalFavourites, writeLocalFavourites } from './local-favourites';

/** The three calls of the account client the favourites need; tests pass a stand-in. */
export interface FavouritesApi {
  favourites(): Promise<{ data: readonly ProductCardDto[] }>;
  addFavourite(productId: string): Promise<void>;
  removeFavourite(productId: string): Promise<void>;
}

export interface FavouritesSnapshot {
  /** Saved product ids: the account's list when signed in, else this browser's list. */
  readonly ids: ReadonlySet<string>;
  /** False until the list has been read (server render, or the first account fetch still running). */
  readonly ready: boolean;
  readonly mode: 'unset' | 'guest' | 'account';
}

const INITIAL: FavouritesSnapshot = { ids: new Set(), ready: false, mode: 'unset' };

const statusOf = (error: unknown) =>
  typeof error === 'object' && error !== null && 'status' in error ? error.status : undefined;

/** A merge failure that will never succeed (the product is gone or hidden): drop the id instead of retrying. */
const isPermanent = (error: unknown) => [400, 404, 422].includes(statusOf(error) as number);

/**
 * One list of favourites shared by every heart on the page (FR-CAT-07). A guest's list is in
 * `localStorage`; once an account session exists, local ids are merged into the account once, the local
 * copy is cleared and the account's list takes over. Components read it through `useFavourites`.
 */
export class FavouritesStore {
  private snapshot: FavouritesSnapshot = INITIAL;
  private listeners = new Set<() => void>();
  private loading: Promise<void> | null = null;
  private api: FavouritesApi | null = null;

  /** Tests inject the API; the app resolves the browser client on first use. */
  constructor(private apiOverride?: FavouritesApi) {}

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = () => this.snapshot;
  getServerSnapshot = () => INITIAL;

  private set(next: Partial<FavouritesSnapshot>) {
    this.snapshot = { ...this.snapshot, ...next };
    for (const listener of this.listeners) listener();
  }

  /** Called by every heart on mount: picks guest or account from the auth cookie, once. */
  ensure(): void {
    if (this.snapshot.mode !== 'unset') return;
    if (this.apiOverride || hasAuthCookie(document.cookie)) void this.startAsAccount();
    else this.startAsGuest();
  }

  /** Reads this browser's list; the guest state. */
  startAsGuest(): void {
    this.loading = null;
    this.set({ mode: 'guest', ready: true, ids: new Set(readLocalFavourites()) });
  }

  /** A session exists: merge the local list into the account once, then show the account's list. */
  startAsAccount(): Promise<void> {
    if (this.snapshot.mode === 'account' && this.loading) return this.loading;
    this.set({ mode: 'account', ready: false });
    this.loading = this.syncWithAccount();
    return this.loading;
  }

  private async client(): Promise<FavouritesApi> {
    if (this.apiOverride) return this.apiOverride;
    if (!this.api) {
      // Loaded on demand: the Supabase SDK is only needed once there is a session.
      const { browserAccountClient } = await import('@/lib/auth/supabase-browser');
      this.api = browserAccountClient();
    }
    return this.api;
  }

  private async syncWithAccount(): Promise<void> {
    try {
      const api = await this.client();
      const local = readLocalFavourites();
      if (local.length > 0) {
        const results = await Promise.allSettled(local.map((id) => api.addFavourite(id)));
        // Keep what failed for a reason that may pass (network, server error) for the next visit.
        writeLocalFavourites(
          local.filter((_, i) => {
            const result = results[i];
            return result?.status === 'rejected' && !isPermanent(result.reason);
          }),
        );
      }
      const list = await api.favourites();
      this.set({ ids: new Set(list.data.map((product) => product.id)), ready: true });
    } catch (error) {
      if (statusOf(error) === 401) {
        // A stale auth cookie: nobody is signed in after all.
        this.startAsGuest();
        return;
      }
      this.set({ ready: true });
    }
  }

  /** Saves or removes one product. Resolves false when the change could not be kept (and was undone). */
  toggle = async (productId: string): Promise<boolean> => {
    const { ids, mode } = this.snapshot;
    const saved = ids.has(productId);
    const next = new Set(ids);
    if (saved) next.delete(productId);
    else next.add(productId);

    if (mode !== 'account') {
      if (!writeLocalFavourites([...next])) return false;
      this.set({ ids: next, mode: 'guest', ready: true });
      return true;
    }
    this.set({ ids: next });
    try {
      const api = await this.client();
      if (saved) await api.removeFavourite(productId);
      else await api.addFavourite(productId);
      return true;
    } catch {
      const current = new Set(this.snapshot.ids);
      if (saved) current.add(productId);
      else current.delete(productId);
      this.set({ ids: current });
      return false;
    }
  };

  /** Cards of the saved products: from the account, or from the public catalog for a guest's ids. */
  async fetchCards(): Promise<readonly ProductCardDto[]> {
    if (this.snapshot.mode === 'account') return (await (await this.client()).favourites()).data;
    const ids = [...this.snapshot.ids];
    if (ids.length === 0) return [];
    const response = await fetch(`/api/v1/products?limit=${ids.length}&ids=${ids.join(',')}`);
    if (!response.ok) throw new Error(String(response.status));
    // Same-origin API with its own contract: no schema parse here, which would put zod in the header bundle.
    const body = (await response.json()) as { data?: ProductCardDto[] };
    if (!Array.isArray(body.data)) throw new Error('Unexpected favourites payload');
    return body.data;
  }

  /** Back to the start; for tests. */
  reset(apiOverride?: FavouritesApi): void {
    this.apiOverride = apiOverride;
    this.api = null;
    this.loading = null;
    this.snapshot = INITIAL;
    for (const listener of this.listeners) listener();
  }
}

export const favouritesStore = new FavouritesStore();
