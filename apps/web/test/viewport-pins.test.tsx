import { act, renderHook } from '@testing-library/react';
import type { MapPinDto } from '@vcraft/contracts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useViewportPins } from '@/features/village-map/use-viewport-pins';

const bounds = (west: number) => ({ west, south: 20.9, east: west + 0.01, north: 21 });
const pinAt = (n: number) => ({ workshopId: `id-${n}` }) as MapPinDto;

describe('useViewportPins (FR-MAP-04)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('makes no request until a move, and none before the debounce elapses', async () => {
    const fetchPins = vi.fn().mockResolvedValue([pinAt(1)]);
    const { result } = renderHook(() => useViewportPins(fetchPins, 300));
    expect(fetchPins).not.toHaveBeenCalled();
    expect(result.current.pins).toBeNull();

    act(() => result.current.schedule(bounds(105.9)));
    await act(() => vi.advanceTimersByTimeAsync(299));
    expect(fetchPins).not.toHaveBeenCalled();
    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(fetchPins).toHaveBeenCalledTimes(1);
    expect(fetchPins.mock.calls[0]?.[0]).toEqual({
      minLng: 105.9,
      minLat: 20.9,
      maxLng: expect.closeTo(105.91, 6),
      maxLat: 21,
    });
    expect(result.current.pins).toEqual([pinAt(1)]);
  });

  it('collapses a burst of moves into one request for the last viewport', async () => {
    const fetchPins = vi.fn().mockResolvedValue([]);
    const { result } = renderHook(() => useViewportPins(fetchPins, 300));
    act(() => result.current.schedule(bounds(105.1)));
    await act(() => vi.advanceTimersByTimeAsync(200));
    act(() => result.current.schedule(bounds(105.2)));
    await act(() => vi.advanceTimersByTimeAsync(200));
    act(() => result.current.schedule(bounds(105.3)));
    await act(() => vi.advanceTimersByTimeAsync(300));
    expect(fetchPins).toHaveBeenCalledTimes(1);
    expect(fetchPins.mock.calls[0]?.[0].minLng).toBe(105.3);
  });

  it('aborts the request in flight when the map moves again and ignores its answer', async () => {
    const signals: AbortSignal[] = [];
    const resolvers: ((pins: MapPinDto[]) => void)[] = [];
    const fetchPins = vi.fn(
      (_bbox: unknown, signal: AbortSignal) =>
        new Promise<MapPinDto[]>((resolve) => {
          signals.push(signal);
          resolvers.push(resolve);
        }),
    );
    const { result } = renderHook(() => useViewportPins(fetchPins, 300));
    act(() => result.current.schedule(bounds(105.1)));
    await act(() => vi.advanceTimersByTimeAsync(300));
    expect(signals[0]?.aborted).toBe(false);

    act(() => result.current.schedule(bounds(105.2)));
    expect(signals[0]?.aborted).toBe(true);
    await act(() => vi.advanceTimersByTimeAsync(300));
    expect(fetchPins).toHaveBeenCalledTimes(2);

    await act(async () => resolvers[0]?.([pinAt(1)]));
    expect(result.current.pins).toBeNull();
    await act(async () => resolvers[1]?.([pinAt(2)]));
    expect(result.current.pins).toEqual([pinAt(2)]);
  });

  it('keeps the current pins when a request fails, and reset returns to the full list', async () => {
    const fetchPins = vi
      .fn()
      .mockResolvedValueOnce([pinAt(1)])
      .mockRejectedValueOnce(new Error('network'));
    const { result } = renderHook(() => useViewportPins(fetchPins, 300));
    act(() => result.current.schedule(bounds(105.1)));
    await act(() => vi.advanceTimersByTimeAsync(300));
    act(() => result.current.schedule(bounds(105.2)));
    await act(() => vi.advanceTimersByTimeAsync(300));
    expect(result.current.pins).toEqual([pinAt(1)]);
    act(() => result.current.reset());
    expect(result.current.pins).toBeNull();
  });

  it('aborts on unmount', async () => {
    let signal: AbortSignal | undefined;
    const fetchPins = vi.fn((_bbox: unknown, s: AbortSignal) => {
      signal = s;
      return new Promise<MapPinDto[]>(() => undefined);
    });
    const { result, unmount } = renderHook(() => useViewportPins(fetchPins, 300));
    act(() => result.current.schedule(bounds(105.1)));
    await act(() => vi.advanceTimersByTimeAsync(300));
    unmount();
    expect(signal?.aborted).toBe(true);
  });
});
