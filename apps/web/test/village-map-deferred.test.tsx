import { act, fireEvent, screen, within } from '@testing-library/react';
import type { MapPinDto } from '@vcraft/contracts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MapCanvasProps } from '@/features/village-map/map-canvas';
import { MAP_IDLE_START_MS } from '@/features/village-map/use-map-start';
import { VillageMapExplorer } from '@/features/village-map/village-map-explorer';
import { renderVi } from './render';

vi.mock('@/i18n/navigation', () => ({
  Link: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <a href="/x" className={className}>
      {children}
    </a>
  ),
}));

// The real canvas needs WebGL and loads MapLibre; this stand-in only marks that it was mounted.
vi.mock('next/dynamic', () => ({
  default: () =>
    function MapCanvasStub(props: MapCanvasProps) {
      return <div data-testid="map-stub" data-selected={props.selected?.workshopName ?? ''} />;
    },
}));

function pin(id: string): MapPinDto {
  return {
    workshopId: `00000000-0000-4000-8000-00000000000${id}`,
    workshopName: `Xuong ${id}`,
    address: 'Bat Trang',
    purpose: 'SHOWROOM',
    visitable: true,
    visitingInfo: null,
    openingHours: null,
    experience: null,
    temporarilyClosed: false,
    closureReason: null,
    lat: 20.97,
    lng: 105.91,
    household: {
      name: `Ho ${id}`,
      slug: `ho-${id}`,
      craft: 'men lam',
      craftCategory: null,
      coverUrl: null,
    },
  };
}

const PINS = [pin('1'), pin('2')];

describe('VillageMapExplorer deferred map (GH#481)', () => {
  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({} as never);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('shows the workshop list and a fixed-size placeholder before MapLibre starts', async () => {
    renderVi(<VillageMapExplorer pins={PINS} />);
    const frame = await screen.findByTestId('map-frame');
    expect(within(frame).getByTestId('map-placeholder')).toBeTruthy();
    expect(screen.queryByTestId('map-stub')).toBeNull();
    // The list is usable meanwhile.
    expect(within(screen.getByTestId('workshop-list')).getAllByRole('listitem')).toHaveLength(2);
    // The frame keeps its own height, so the map replacing the placeholder shifts nothing.
    expect(frame.className).toContain('h-[');
  });

  it('starts the map from the placeholder button', async () => {
    renderVi(<VillageMapExplorer pins={PINS} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Mở bản đồ' }));
    expect(await screen.findByTestId('map-stub')).toBeTruthy();
    expect(screen.queryByTestId('map-placeholder')).toBeNull();
  });

  it('starts the map on the first touch of the page', async () => {
    renderVi(<VillageMapExplorer pins={PINS} />);
    await screen.findByTestId('map-placeholder');
    fireEvent.pointerDown(document.body);
    expect((await screen.findByTestId('map-stub')).dataset.selected).toBe('');
  });

  it('starts the map on its own once the page has been quiet for a while', async () => {
    vi.useFakeTimers();
    renderVi(<VillageMapExplorer pins={PINS} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByTestId('map-placeholder')).toBeTruthy();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(MAP_IDLE_START_MS + 100);
    });
    expect(screen.getByTestId('map-stub')).toBeTruthy();
  });

  it('opens the map straight away for a deep link to one workshop', async () => {
    renderVi(<VillageMapExplorer pins={PINS} initialSelectedId={PINS[1]?.workshopId ?? ''} />);
    expect((await screen.findByTestId('map-stub')).dataset.selected).toBe('Xuong 2');
    expect(screen.queryByTestId('map-placeholder')).toBeNull();
  });
});
