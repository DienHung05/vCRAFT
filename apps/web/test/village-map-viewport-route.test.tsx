import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { MapPinDto } from '@vcraft/contracts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MapCanvasProps } from '@/features/village-map/map-canvas';
import { VillageMapExplorer } from '@/features/village-map/village-map-explorer';
import { renderVi } from './render';

vi.mock('@/i18n/navigation', () => ({
  Link: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <a href="/x" className={className}>
      {children}
    </a>
  ),
}));

// The real canvas needs WebGL; this stand-in shows what the explorer hands the map and lets a test
// move it the way a visitor does.
vi.mock('next/dynamic', () => ({
  default: () =>
    function MapCanvasStub(props: MapCanvasProps) {
      return (
        <div
          data-testid="map-stub"
          data-pins={props.pins.length}
          data-route={props.route?.length ?? 0}
        >
          <button
            type="button"
            onClick={() =>
              props.onUserMove({ west: 105.9, south: 20.97, east: 105.92, north: 20.98 })
            }
          >
            move map
          </button>
        </div>
      );
    },
}));

const HOURS = [1, 2, 3, 4, 5].map((day) => ({ day, open: '08:00', close: '17:00' }));

function pin(id: string, lat: number, lng: number, overrides: Partial<MapPinDto> = {}): MapPinDto {
  return {
    workshopId: `00000000-0000-4000-8000-00000000000${id}`,
    workshopName: `Xưởng ${id}`,
    address: 'Bát Tràng',
    purpose: 'SHOWROOM',
    visitable: true,
    visitingInfo: null,
    openingHours: HOURS,
    experience: null,
    temporarilyClosed: false,
    closureReason: null,
    lat,
    lng,
    household: {
      name: `Hộ ${id}`,
      slug: `ho-${id}`,
      craft: 'men lam',
      craftCategory: null,
      coverUrl: null,
    },
    ...overrides,
  };
}

// Village centre defaults to 20.9758, 105.9139.
const NEAR = pin('1', 20.976, 105.914);
const MID = pin('2', 20.98, 105.914);
const FAR = pin('3', 20.99, 105.914);
const CLOSED = pin('4', 20.9761, 105.9141, { openingHours: null });
const PINS = [FAR, CLOSED, NEAR, MID];

const stopNames = () =>
  within(screen.getByTestId('route-stops'))
    .getAllByRole('listitem')
    .map((li) => li.textContent?.split(' · ')[0]);

function stubGeolocation(
  impl: ((ok: PositionCallback, fail: PositionErrorCallback) => void) | null,
) {
  if (!impl) {
    // jsdom has no geolocation: removing the stub restores that.
    Reflect.deleteProperty(navigator, 'geolocation');
    return;
  }
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: { getCurrentPosition: impl },
  });
}

describe('VillageMapExplorer walking route (FR-MAP-08)', () => {
  beforeEach(() => {
    // Monday 10:00 in Vietnam.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-02T10:00:00+07:00'));
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({} as never);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('starts from the village centre when location is denied and orders open stops by proximity', async () => {
    stubGeolocation((_ok, fail) => fail({ code: 1 } as GeolocationPositionError));
    renderVi(<VillageMapExplorer pins={PINS} fetchPinsInViewport={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Gợi ý tuyến đi bộ' }));

    const panel = await screen.findByTestId('walking-route');
    expect(within(panel).getByText(/trung tâm làng/)).toBeTruthy();
    // The closed workshop is left out; the others are ordered nearest first.
    expect(stopNames()).toEqual(['1. Hộ 1', '2. Hộ 2', '3. Hộ 3']);
    expect(within(panel).getAllByText(/Mở đến 17:00/)).toHaveLength(3);
    // Start plus three stops reach the map layer.
    expect(screen.getByTestId('map-stub').dataset.route).toBe('4');
  });

  it('starts from the visitor location when it is granted', async () => {
    stubGeolocation((ok) =>
      ok({ coords: { latitude: 20.9899, longitude: 105.914 } } as GeolocationPosition),
    );
    renderVi(<VillageMapExplorer pins={PINS} fetchPinsInViewport={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Gợi ý tuyến đi bộ' }));

    const panel = await screen.findByTestId('walking-route');
    expect(within(panel).getByText(/từ vị trí của bạn/)).toBeTruthy();
    expect(stopNames()).toEqual(['1. Hộ 3', '2. Hộ 2', '3. Hộ 1']);
  });

  it('falls back to the village centre without a geolocation API, and clears on request', async () => {
    stubGeolocation(null);
    renderVi(<VillageMapExplorer pins={PINS} fetchPinsInViewport={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Gợi ý tuyến đi bộ' }));
    const panel = await screen.findByTestId('walking-route');
    expect(within(panel).getByText(/trung tâm làng/)).toBeTruthy();

    fireEvent.click(within(panel).getByRole('button', { name: 'Xóa tuyến' }));
    expect(screen.queryByTestId('walking-route')).toBeNull();
    expect(screen.getByTestId('map-stub').dataset.route).toBe('0');
  });

  it('says so when no workshop is open', async () => {
    stubGeolocation(null);
    renderVi(<VillageMapExplorer pins={[CLOSED]} fetchPinsInViewport={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Gợi ý tuyến đi bộ' }));
    expect(await screen.findByText(/chưa có xưởng nào đang mở cửa/)).toBeTruthy();
  });
});

describe('VillageMapExplorer viewport loading (FR-MAP-04)', () => {
  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({} as never);
  });
  afterEach(() => vi.restoreAllMocks());

  it('does not fetch on the first render, fetches once after a move, and the list follows', async () => {
    const fetchPins = vi.fn().mockResolvedValue([NEAR]);
    renderVi(<VillageMapExplorer pins={PINS} fetchPinsInViewport={fetchPins} />);
    await screen.findByTestId('map-stub');
    expect(fetchPins).not.toHaveBeenCalled();
    expect(within(screen.getByTestId('workshop-list')).getAllByRole('listitem')).toHaveLength(4);

    fireEvent.click(screen.getByRole('button', { name: 'move map' }));
    await waitFor(() => expect(fetchPins).toHaveBeenCalledTimes(1));
    expect(fetchPins.mock.calls[0]?.[0]).toEqual({
      minLng: 105.9,
      minLat: 20.97,
      maxLng: 105.92,
      maxLat: 20.98,
    });
    await waitFor(() =>
      expect(within(screen.getByTestId('workshop-list')).getAllByRole('listitem')).toHaveLength(1),
    );
    expect(screen.getByTestId('map-stub').dataset.pins).toBe('1');

    // "Show all" returns to the server-rendered list.
    fireEvent.click(screen.getByRole('button', { name: 'Hiện tất cả' }));
    expect(within(screen.getByTestId('workshop-list')).getAllByRole('listitem')).toHaveLength(4);
  });

  it('makes no viewport request on the no-WebGL list', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    const fetchPins = vi.fn();
    renderVi(<VillageMapExplorer pins={PINS} fetchPinsInViewport={fetchPins} />);
    await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(/WebGL/));
    expect(screen.queryByTestId('map-stub')).toBeNull();
    expect(fetchPins).not.toHaveBeenCalled();
  });
});
