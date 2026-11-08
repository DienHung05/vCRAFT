import { render } from '@testing-library/react';
import type { MapPinDto } from '@vcraft/contracts';
import { messages } from '@vcraft/i18n';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';
import MapCanvas, { type MapCanvasProps } from '@/features/village-map/map-canvas';

// WebGL is not available in jsdom: the map itself is replaced by a plain container.
vi.mock('maplibre-gl', () => ({ addProtocol: vi.fn(), setWorkerUrl: vi.fn() }));
vi.mock('maplibre-gl/dist/maplibre-gl.css', () => ({}));
vi.mock('pmtiles', () => ({
  Protocol: class {
    tile = vi.fn();
  },
}));
vi.mock('@/features/village-map/use-map-style', () => ({
  useMapStyle: () => ({ style: 'style.json', offline: false, onMapError: vi.fn() }),
}));
vi.mock('react-map-gl/maplibre', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Layer: () => null,
  Source: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Marker: () => null,
  Popup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/i18n/navigation', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a href="/x">{children}</a>,
}));

const pin: MapPinDto = {
  workshopId: '0192f0d6-0000-7000-8000-000000000001',
  workshopName: 'Phòng trưng bày',
  address: 'Xóm 2, Bát Tràng',
  purpose: 'SHOWROOM',
  visitable: true,
  visitingInfo: null,
  openingHours: null,
  experience: null,
  temporarilyClosed: false,
  closureReason: null,
  lat: 20.97,
  lng: 105.91,
  household: { name: 'Gốm Minh Hải', slug: 'gom-minh-hai', craft: null, coverUrl: null },
};

function stubViewport(phone: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: phone && query.includes('max-width'),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
}

const props = (selected: MapPinDto | null): MapCanvasProps => ({
  pins: [pin],
  highlightId: null,
  selected,
  userLocation: null,
  now: new Date('2026-11-07T03:00:00Z'),
  onHighlight: vi.fn(),
  onSelect: vi.fn(),
  onUserMove: vi.fn(),
});

// `rerender` drops the wrapper `renderVi` adds, so each render carries its own provider.
const canvas = (selected: MapPinDto | null) => (
  <NextIntlClientProvider locale="vi" messages={messages.vi}>
    <MapCanvas {...props(selected)} />
  </NextIntlClientProvider>
);

const flag = () => document.documentElement.dataset.mapSheet;

afterEach(() => {
  vi.unstubAllGlobals();
});

/** GH#297: the phone bottom sheet flags the root element so the Fox assistant steps aside. */
describe('MapCanvas bottom sheet flag', () => {
  it('sets the flag while the phone bottom sheet is shown and clears it when it closes', () => {
    stubViewport(true);
    const { rerender } = render(canvas(pin));
    expect(flag()).toBe('open');
    rerender(canvas(null));
    expect(flag()).toBeUndefined();
  });

  it('clears the flag when the map unmounts with the sheet open', () => {
    stubViewport(true);
    const { unmount } = render(canvas(pin));
    expect(flag()).toBe('open');
    unmount();
    expect(flag()).toBeUndefined();
  });

  it('does not set the flag on a phone without a selected pin', () => {
    stubViewport(true);
    render(canvas(null));
    expect(flag()).toBeUndefined();
  });

  it('does not set the flag for the desktop popup', () => {
    stubViewport(false);
    render(canvas(pin));
    expect(flag()).toBeUndefined();
  });
});
