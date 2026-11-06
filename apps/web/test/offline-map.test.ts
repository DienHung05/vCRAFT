import { describe, expect, it, vi } from 'vitest';
import {
  chooseMapStyle,
  isReachable,
  isTileServerError,
  offlineStyle,
} from '@/features/village-map/offline-style';

const ONLINE = 'https://tiles.openfreemap.org/styles/liberty';
const PMTILES = 'https://ref.supabase.co/storage/v1/object/public/public/map/bat-trang.pmtiles';

describe('offline village map (GH#100)', () => {
  it('keeps the online style when it answers', async () => {
    const fetchImpl = vi.fn(async () => new Response('{}'));
    expect(await chooseMapStyle({ onlineUrl: ONLINE, pmtilesUrl: PMTILES, fetchImpl })).toEqual({
      style: ONLINE,
      offline: false,
    });
  });

  it('switches to the PMTiles extract when OpenFreeMap is down or failing', async () => {
    const down = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    const failing = vi.fn(async () => new Response('busy', { status: 503 }));
    for (const fetchImpl of [down, failing]) {
      const chosen = await chooseMapStyle({ onlineUrl: ONLINE, pmtilesUrl: PMTILES, fetchImpl });
      expect(chosen.offline).toBe(true);
      expect(chosen.style).toMatchObject({
        sources: { 'bat-trang': { url: `pmtiles://${PMTILES}` } },
      });
    }
  });

  it('does not probe at all without an extract', async () => {
    const fetchImpl = vi.fn();
    expect(await chooseMapStyle({ onlineUrl: ONLINE, pmtilesUrl: '', fetchImpl })).toEqual({
      style: ONLINE,
      offline: false,
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('gives up on a style that hangs', async () => {
    const hang = vi.fn(
      (_: unknown, init?: RequestInit) =>
        new Promise<Response>((_, reject) =>
          init?.signal?.addEventListener('abort', () => reject(new Error('aborted'))),
        ),
    );
    expect(await isReachable(ONLINE, hang as unknown as typeof fetch, 20)).toBe(false);
  });

  it('draws the extract in the brand colours', () => {
    const style = offlineStyle(PMTILES);
    const paint = (id: string) =>
      style.layers.find((l) => l.id === id)?.paint as Record<string, unknown>;
    expect(paint('background')['background-color']).toBe('#f5efe4');
    expect(paint('water')['fill-color']).toBe('#1e3a6e');
    expect(paint('roads-major')['line-color']).toBe('#a8482a');
  });

  it('recognises errors from the online tile server only', () => {
    expect(
      isTileServerError(
        { message: 'AJAXError', url: 'https://tiles.openfreemap.org/planet/1/2/3.pbf' },
        ONLINE,
      ),
    ).toBe(true);
    expect(
      isTileServerError(new Error('Failed to fetch https://tiles.openfreemap.org/x'), ONLINE),
    ).toBe(true);
    expect(isTileServerError(new Error('WebGL context lost'), ONLINE)).toBe(false);
  });
});
