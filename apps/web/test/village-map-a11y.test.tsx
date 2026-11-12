import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { MapPinDto } from '@vcraft/contracts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VillageMapExplorer } from '@/features/village-map/village-map-explorer';
import { renderVi } from './render';

vi.mock('@/i18n/navigation', () => ({
  Link: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <a href="/x" className={className}>
      {children}
    </a>
  ),
}));

// The real canvas needs WebGL; this stand-in only reports which workshop is selected.
vi.mock('@/features/village-map/map-canvas', () => ({
  default: ({ selected }: { selected: { workshopName: string } | null }) => (
    <div data-testid="canvas-selected">{selected?.workshopName ?? 'none'}</div>
  ),
}));

function pin(id: string, craft = 'men lam'): MapPinDto {
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
    household: { name: `Ho ${id}`, slug: `ho-${id}`, craft, craftCategory: null, coverUrl: null },
  };
}

describe('VillageMapExplorer keyboard access (GH#364)', () => {
  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({} as never);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('the show-on-map control is a named, tabbable button that selects the workshop', async () => {
    renderVi(<VillageMapExplorer pins={[pin('1'), pin('3')]} />);
    await screen.findByTestId('map-placeholder');
    fireEvent.pointerDown(document.body);
    await screen.findByTestId('canvas-selected');
    const list = screen.getByTestId('workshop-list');
    const button = within(list).getByRole('button', { name: 'Xem Ho 3 trên bản đồ' });
    expect(button.getAttribute('tabindex')).not.toBe('-1');
    expect(button.closest('[aria-hidden="true"]')).toBeNull();
    expect(within(list).getAllByRole('button')).toHaveLength(2);
    button.focus();
    expect(document.activeElement).toBe(button);
    fireEvent.click(button);
    expect(screen.getByTestId('canvas-selected').textContent).toBe('Xuong 3');
  });

  it('labels the map region and points it at the keyboard hint', async () => {
    renderVi(<VillageMapExplorer pins={[pin('1')]} />);
    const frame = await screen.findByRole('region', { name: 'Bản đồ làng' });
    expect(frame.getAttribute('aria-hidden')).toBeNull();
    const hint = document.getElementById(frame.getAttribute('aria-describedby') ?? '');
    expect(hint?.textContent).toMatch(/danh sách xưởng/);
  });

  it('announces the result count politely when a filter changes', async () => {
    renderVi(<VillageMapExplorer pins={[pin('1'), pin('3', 'men ngoc')]} />);
    await waitFor(() => screen.getByTestId('map-frame'));
    const heading = screen.getByRole('heading', { level: 2 });
    expect(heading.getAttribute('aria-live')).toBe('polite');
    expect(heading.getAttribute('aria-atomic')).toBe('true');
    expect(heading.textContent).toBe('2 xưởng');
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'men ngoc' } });
    expect(heading.textContent).toBe('1 xưởng');
  });
});
