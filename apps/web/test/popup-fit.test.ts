import { describe, expect, it } from 'vitest';
import {
  type Box,
  CARD_ESTIMATE,
  panToFit,
  popupAnchorFor,
  popupOffsetFor,
  unionBox,
} from '@/features/village-map/popup-fit';

const map = { width: 900, height: 675 };
const PIN = 57;

/** GH#475: the info card opens on the side of the pin that has room for it. */
describe('popupAnchorFor', () => {
  it('opens above a pin that has room above it (the card stays where it always was)', () => {
    expect(popupAnchorFor({ x: 450, y: 560 }, map, CARD_ESTIMATE, PIN)).toBe('bottom');
  });

  it('opens below a pin near the top edge, the case that cut the card off', () => {
    expect(popupAnchorFor({ x: 450, y: 120 }, map, CARD_ESTIMATE, PIN)).toBe('top');
    expect(popupAnchorFor({ x: 450, y: 0 }, map, CARD_ESTIMATE, PIN)).toBe('top');
  });

  it('takes the pin height into account when checking the room above', () => {
    const tall = { width: 900, height: 1000 };
    const y = CARD_ESTIMATE.height + 10;
    expect(popupAnchorFor({ x: 450, y }, tall, CARD_ESTIMATE, 0)).toBe('bottom');
    expect(popupAnchorFor({ x: 450, y }, tall, CARD_ESTIMATE, PIN)).toBe('top');
  });

  it('opens on the roomier side when neither side fits: downwards in the upper half', () => {
    const short = { width: 900, height: 420 };
    expect(popupAnchorFor({ x: 450, y: 150 }, short, CARD_ESTIMATE, PIN)).toBe('top');
    expect(popupAnchorFor({ x: 450, y: 300 }, short, CARD_ESTIMATE, PIN)).toBe('bottom');
  });

  it('anchors by a corner near the left and right edges so the card grows inwards', () => {
    expect(popupAnchorFor({ x: 40, y: 560 }, map, CARD_ESTIMATE, PIN)).toBe('bottom-left');
    expect(popupAnchorFor({ x: 880, y: 560 }, map, CARD_ESTIMATE, PIN)).toBe('bottom-right');
    expect(popupAnchorFor({ x: 40, y: 50 }, map, CARD_ESTIMATE, PIN)).toBe('top-left');
    expect(popupAnchorFor({ x: 880, y: 50 }, map, CARD_ESTIMATE, PIN)).toBe('top-right');
  });

  it('treats a pin outside the map as sitting on its nearest edge', () => {
    expect(popupAnchorFor({ x: -300, y: -300 }, map, CARD_ESTIMATE, PIN)).toBe('top-left');
    expect(popupAnchorFor({ x: 2000, y: 2000 }, map, CARD_ESTIMATE, PIN)).toBe('bottom-right');
  });
});

describe('popupOffsetFor', () => {
  it('lifts a card above the pin over the icon and drops a card below it by the gap only', () => {
    expect(popupOffsetFor('bottom', 57, 4)).toEqual([0, -61]);
    expect(popupOffsetFor('bottom-left', 57, 4)).toEqual([0, -61]);
    expect(popupOffsetFor('top', 57, 4)).toEqual([0, 4]);
    expect(popupOffsetFor('top-right', 57, 4)).toEqual([0, 4]);
  });
});

describe('unionBox', () => {
  it('spans every box', () => {
    const a: Box = { left: 10, top: 20, right: 30, bottom: 40 };
    const b: Box = { left: 5, top: 25, right: 50, bottom: 30 };
    expect(unionBox(a, b)).toEqual({ left: 5, top: 20, right: 50, bottom: 40 });
  });
});

describe('panToFit', () => {
  const container: Box = { left: 100, top: 50, right: 1000, bottom: 725 };

  it('does nothing for a box that is already inside', () => {
    const box: Box = { left: 300, top: 200, right: 588, bottom: 580 };
    expect(panToFit(box, container, 12)).toEqual({ x: 0, y: 0 });
  });

  it('moves the map up and down by the clipped amount, keeping the padding (panBy offset)', () => {
    // Cut off 80 px at the top: the content must move down 92 px, i.e. the map centre up 92.
    const top: Box = { left: 300, top: -30, right: 588, bottom: 350 };
    expect(panToFit(top, container, 12)).toEqual({ x: 0, y: -92 });
    const bottom: Box = { left: 300, top: 500, right: 588, bottom: 780 };
    expect(panToFit(bottom, container, 12)).toEqual({ x: 0, y: 67 });
  });

  it('works on both axes at once', () => {
    const corner: Box = { left: 60, top: 20, right: 348, bottom: 400 };
    expect(panToFit(corner, container, 12)).toEqual({ x: -52, y: -42 });
    const far: Box = { left: 800, top: 400, right: 1100, bottom: 800 };
    expect(panToFit(far, container, 12)).toEqual({ x: 112, y: 87 });
  });

  it('returns 0, not -0, when an axis needs no move', () => {
    const result = panToFit({ left: 300, top: 200, right: 400, bottom: 300 }, container, 12);
    expect(Object.is(result.x, 0)).toBe(true);
    expect(Object.is(result.y, 0)).toBe(true);
  });

  it('lines a box bigger than the container up with its top-left corner, so the photo and name show', () => {
    const tall: Box = { left: 300, top: -200, right: 588, bottom: 900 };
    expect(panToFit(tall, container, 12)).toEqual({ x: 0, y: -(62 + 200) });
    const wide: Box = { left: 0, top: 200, right: 1200, bottom: 300 };
    expect(panToFit(wide, container, 12)).toEqual({ x: -112, y: 0 });
  });
});
