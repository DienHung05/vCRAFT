import { render } from '@testing-library/react';
import type { WorkshopDto } from '@vcraft/contracts';
import { BAT_TRANG_BOUNDARY } from '@vcraft/domain';
import type { ReactNode } from 'react';
import { expect, it, vi } from 'vitest';
import WorkshopReviewMap from '@/features/admin/workshop-review-map';

const captured = vi.hoisted(() => ({
  source: null as unknown,
  bounds: null as unknown,
  layers: [] as string[],
}));

vi.mock('maplibre-gl', () => ({ setWorkerUrl: vi.fn() }));
vi.mock('react-map-gl/maplibre', () => ({
  default: ({
    children,
    initialViewState,
  }: {
    children: ReactNode;
    initialViewState: { bounds: unknown };
  }) => {
    captured.bounds = initialViewState.bounds;
    return <div>{children}</div>;
  },
  Source: ({ children, data }: { children: ReactNode; data: unknown }) => {
    captured.source = data;
    return <div>{children}</div>;
  },
  Layer: ({ id }: { id: string }) => {
    captured.layers.push(id);
    return null;
  },
  Marker: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

it('preserves every boundary ring and fits the village together with an outside workshop', () => {
  const outside = { id: 'outside', lat: 21.05, lng: 106 } as WorkshopDto;
  render(<WorkshopReviewMap workshops={[outside]} />);

  expect(captured.source).toEqual({
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {},
        geometry: { type: 'Polygon', coordinates: BAT_TRANG_BOUNDARY },
      },
    ],
  });
  expect(captured.layers).toEqual(['bat-trang-boundary-fill', 'bat-trang-boundary-outline']);
  const [[west, south], [east, north]] = captured.bounds as [[number, number], [number, number]];
  for (const [lng, lat] of [...BAT_TRANG_BOUNDARY.flat(), [outside.lng, outside.lat]]) {
    expect(lng).toBeGreaterThanOrEqual(west);
    expect(lng).toBeLessThanOrEqual(east);
    expect(lat).toBeGreaterThanOrEqual(south);
    expect(lat).toBeLessThanOrEqual(north);
  }
});
