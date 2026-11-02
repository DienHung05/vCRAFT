import { describe, expect, it } from 'vitest';
import {
  LABEL_HEIGHT,
  type LayoutPinInput,
  layoutMiniMap,
} from '@/features/village-map/mini-map-layout';

// Roughly the six demo workshops of the home page teaser; Kim Lien and Hoang Long sit close together.
const PINS: LayoutPinInput[] = [
  { id: 'lam-ngoc', x: 46, y: 14, size: 26, labelWidth: 96 },
  { id: 'dai-phong', x: 24, y: 47, size: 26, labelWidth: 98 },
  { id: 'bich-hop', x: 62, y: 42, size: 26, labelWidth: 92 },
  { id: 'hanh-thuy', x: 56, y: 57, size: 26, labelWidth: 100 },
  { id: 'hoang-long', x: 78, y: 58, size: 26, labelWidth: 108 },
  { id: 'kim-lien', x: 84, y: 64, size: 26, labelWidth: 94 },
];

interface Box {
  name: string;
  left: number;
  top: number;
  width: number;
  height: number;
}

function boxes(pins: readonly LayoutPinInput[], frame: { width: number; height: number }): Box[] {
  const placed = layoutMiniMap(pins, frame);
  return pins.flatMap((pin) => {
    const spot = placed.get(pin.id);
    if (!spot) throw new Error(`missing ${pin.id}`);
    return [
      {
        name: `${pin.id}/pin`,
        left: spot.cx - pin.size / 2,
        top: spot.cy - pin.size / 2,
        width: pin.size,
        height: pin.size,
      },
      {
        name: `${pin.id}/label`,
        left: spot.labelLeft,
        top: spot.labelTop,
        width: pin.labelWidth,
        height: LABEL_HEIGHT,
      },
    ];
  });
}

const intersects = (a: Box, b: Box) =>
  a.left < b.left + b.width &&
  b.left < a.left + a.width &&
  a.top < b.top + b.height &&
  b.top < a.top + a.height;

const owner = (box: Box) => box.name.split('/')[0];

describe('layoutMiniMap', () => {
  it.each([
    [312, 234],
    [696, 522],
    [677, 508],
  ])('keeps every pin and label clear of the others in a %ix%i frame', (width, height) => {
    const all = boxes(PINS, { width, height });
    const hits: string[] = [];
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        const [a, b] = [all[i], all[j]];
        if (a && b && owner(a) !== owner(b) && intersects(a, b)) hits.push(`${a.name} x ${b.name}`);
      }
    }
    expect(hits).toEqual([]);
  });

  it('keeps every label inside the frame', () => {
    const frame = { width: 312, height: 234 };
    for (const box of boxes(PINS, frame).filter((b) => b.name.endsWith('/label'))) {
      expect(box.left).toBeGreaterThanOrEqual(0);
      expect(box.top).toBeGreaterThanOrEqual(0);
      expect(box.left + box.width).toBeLessThanOrEqual(frame.width);
      expect(box.top + box.height).toBeLessThanOrEqual(frame.height);
    }
  });

  it('leaves an isolated pin where it is, with its label below', () => {
    const placed = layoutMiniMap([{ id: 'solo', x: 50, y: 40, size: 26, labelWidth: 80 }], {
      width: 400,
      height: 300,
    });
    const solo = placed.get('solo');
    expect(solo?.cx).toBeCloseTo(200);
    expect(solo?.cy).toBeCloseTo(120);
    expect(solo?.labelTop).toBeGreaterThan(120);
  });

  it('spreads pins that share the same spot', () => {
    const twins: LayoutPinInput[] = [
      { id: 'a', x: 50, y: 50, size: 26, labelWidth: 60 },
      { id: 'b', x: 50, y: 50, size: 26, labelWidth: 60 },
    ];
    const all = boxes(twins, { width: 400, height: 300 });
    expect(
      all.some((a, i) => all.some((b, j) => j > i && owner(a) !== owner(b) && intersects(a, b))),
    ).toBe(false);
  });
});
