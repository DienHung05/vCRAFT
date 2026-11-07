import { fireEvent, screen } from '@testing-library/react';
import type { MapPinDto } from '@vcraft/contracts';
import { describe, expect, it, vi } from 'vitest';
import {
  directionsUrl,
  pinIconId,
  pinStatus,
  toFeatureCollection,
} from '@/features/village-map/map-model';
import { parsePinIconId, pinSvg } from '@/features/village-map/pin-icons';
import { type MiniMapPin, VillageMiniMap } from '@/features/village-map/village-mini-map';
import { renderVi } from './render';

vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...rest }: { href: unknown; children: React.ReactNode }) => (
    <a href={typeof href === 'string' ? href : JSON.stringify(href)} {...rest}>
      {children}
    </a>
  ),
}));

/** GH#216: marker pins by status and purpose, directions, and info cards on the mini maps. */
const base: MapPinDto = {
  workshopId: '0192f0d6-0000-7000-8000-000000000001',
  workshopName: 'Phòng trưng bày',
  address: 'Xóm 2, Bát Tràng',
  purpose: 'SHOWROOM',
  visitable: true,
  visitingInfo: null,
  // Every day 08:00–17:00 (Vietnam time).
  openingHours: [0, 1, 2, 3, 4, 5, 6].map((day) => ({ day, open: '08:00', close: '17:00' })),
  lat: 20.97,
  lng: 105.91,
  household: { name: 'Gốm Minh Hải', slug: 'gom-minh-hai', craft: null, coverUrl: null },
};
// 10:00 and 22:00 in Vietnam (UTC+7).
const morning = new Date('2026-11-07T03:00:00Z');
const night = new Date('2026-11-07T15:00:00Z');

describe('pin status and icons', () => {
  it('tells open, closed and production-only workshops apart', () => {
    expect(pinStatus(base, morning)).toBe('open');
    expect(pinStatus(base, night)).toBe('closed');
    expect(pinStatus({ ...base, visitable: false }, morning)).toBe('production');
  });

  it('names one icon per status and purpose, and parses it back', () => {
    expect(pinIconId('open', 'BOTH')).toBe('pin-open-both');
    expect(parsePinIconId('pin-closed-production')).toEqual({
      status: 'closed',
      purpose: 'PRODUCTION',
    });
    expect(parsePinIconId('marker-15')).toBeNull();
    expect(pinSvg('production', 'SHOWROOM')).toContain('fill="#6b635a"');
  });

  it('puts status and icon on every map feature', () => {
    const [feature] = toFeatureCollection([base], night).features;
    expect(feature?.properties).toMatchObject({
      open: false,
      status: 'closed',
      icon: 'pin-closed-showroom',
    });
  });

  it('links directions to Google Maps by coordinates', () => {
    expect(directionsUrl(base)).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=20.97,105.91',
    );
  });
});

describe('<VillageMiniMap> cards', () => {
  const pins: MiniMapPin[] = [
    {
      id: 'a',
      x: 30,
      y: 30,
      open: true,
      label: 'Gốm Minh Hải',
      card: {
        title: 'Gốm Minh Hải',
        lines: ['Xóm 2'],
        status: 'open' as const,
        link: { href: '/ban-do', label: 'Xem trang hộ' },
      },
    },
    { id: 'b', x: 70, y: 70, open: false, label: 'Không thẻ' },
  ];

  it('opens a card from a pin button and closes it with Esc', () => {
    renderVi(<VillageMiniMap label="Bản đồ" pins={pins} />);
    const button = screen.getByRole('button', { name: 'Gốm Minh Hải: xem thông tin' });
    expect(screen.getAllByRole('button')).toHaveLength(1);
    fireEvent.click(button);
    expect(button.getAttribute('aria-expanded')).toBe('true');
    const card = screen.getByRole('group', { name: 'Gốm Minh Hải' });
    expect(card.textContent).toContain('Đang mở cửa');
    expect(screen.getByRole('link', { name: 'Xem trang hộ' })).toBeTruthy();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('group', { name: 'Gốm Minh Hải' })).toBeNull();
  });
});
