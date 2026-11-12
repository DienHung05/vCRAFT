/**
 * Keeping the pin's info card inside the map (GH#475). MapLibre opens a popup on the side the card was
 * asked for and never moves the map, so a pin near an edge used to open a card that was cut off. These
 * helpers are plain geometry (screen pixels, no DOM, no map) so they can be tested on their own:
 * `popupAnchorFor` picks the side of the pin the card opens on, `panToFit` says how far to pan the map
 * once the card has been laid out and measured.
 */

export interface ScreenPoint {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export type PopupAnchor =
  | 'top'
  | 'top-left'
  | 'top-right'
  | 'bottom'
  | 'bottom-left'
  | 'bottom-right';

/** The card's rough size (`maxWidth` 18 rem, photo + text + two buttons): enough to choose a side. */
export const CARD_ESTIMATE: Size = { width: 288, height: 380 };

/**
 * Which side of the pin the card opens on, from the pin's position in the map container. The card
 * opens above the pin (the Google Maps way) when it fits there, else below it, else on the side with
 * more room (the upper half of the map opens downwards). Near a left or right edge the card is
 * anchored by its corner so it grows inwards. A pin outside the container counts as on its edge.
 *
 * @param point Pin position in pixels from the container's top-left corner.
 * @param pinHeight Height of the pin icon above the point; the card clears it when opening upwards.
 */
export function popupAnchorFor(
  point: ScreenPoint,
  container: Size,
  card: Size = CARD_ESTIMATE,
  pinHeight = 0,
): PopupAnchor {
  const x = Math.min(Math.max(point.x, 0), container.width);
  const y = Math.min(Math.max(point.y, 0), container.height);
  const above = y - pinHeight;
  const below = container.height - y;
  let vertical: 'top' | 'bottom';
  if (above >= card.height) vertical = 'bottom';
  else if (below >= card.height) vertical = 'top';
  else vertical = y < container.height / 2 ? 'top' : 'bottom';
  if (x < card.width / 2) return `${vertical}-left`;
  if (x > container.width - card.width / 2) return `${vertical}-right`;
  return vertical;
}

/**
 * Popup offset for an anchor. The pin icon stands on its point and reaches `pinHeight` above it, so a
 * card above the pin clears the icon, and a card below it only needs the small `gap`.
 */
export function popupOffsetFor(
  anchor: PopupAnchor,
  pinHeight: number,
  gap: number,
): [number, number] {
  return anchor.startsWith('bottom') ? [0, -(pinHeight + gap)] : [0, gap];
}

/** Union of boxes: the card together with the pin it belongs to. */
export function unionBox(first: Box, ...rest: Box[]): Box {
  return rest.reduce<Box>(
    (all, box) => ({
      left: Math.min(all.left, box.left),
      top: Math.min(all.top, box.top),
      right: Math.max(all.right, box.right),
      bottom: Math.max(all.bottom, box.bottom),
    }),
    first,
  );
}

function shiftOnAxis(start: number, end: number, min: number, max: number): number {
  // Taller (wider) than the room: show the start, so the photo and the name stay visible.
  if (end - start > max - min) return min - start;
  if (start < min) return min - start;
  if (end > max) return max - end;
  return 0;
}

/**
 * How far to pan the map so that `box` lies inside `container`, keeping `padding` pixels from every
 * edge. Both boxes are in the same coordinates (viewport pixels). The result is the offset to hand to
 * `map.panBy` (the movement of the map's centre, which is the opposite of how the content moves);
 * `{ x: 0, y: 0 }` when the box is already inside. A box bigger than the container lines up with its
 * top-left padding corner.
 */
export function panToFit(box: Box, container: Box, padding: number): ScreenPoint {
  const dx = shiftOnAxis(box.left, box.right, container.left + padding, container.right - padding);
  const dy = shiftOnAxis(box.top, box.bottom, container.top + padding, container.bottom - padding);
  // `+ 0` turns -0 into 0.
  return { x: -dx + 0, y: -dy + 0 };
}

function intersectsBox(a: Box, b: Box): boolean {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

function insideBox(box: Box, container: Box, padding: number): boolean {
  return (
    box.left >= container.left + padding &&
    box.top >= container.top + padding &&
    box.right <= container.right - padding &&
    box.bottom <= container.bottom - padding
  );
}

/**
 * Adjusts a `panToFit` offset so the pin does not end up under a fixed overlay such as the map legend
 * (a pin under it cannot be grabbed or tapped). All boxes are in viewport pixels as they are BEFORE the
 * pan; `offset` is the `panToFit` result, so the content moves by the opposite of it. When the pin would
 * land on `obstacle`, the smallest extra pan that clears it by `gap` is used, first moving the content up,
 * then to the right, provided the card and the pin both stay inside `container` minus `padding`. When
 * neither fits the offset is returned unchanged (the card wins, as before).
 */
export function avoidObstacle(
  offset: ScreenPoint,
  pin: Box,
  card: Box,
  obstacle: Box | null,
  container: Box,
  padding: number,
  gap = 8,
): ScreenPoint {
  if (!obstacle) return offset;
  const move = (box: Box, dx: number, dy: number): Box => ({
    left: box.left - dx,
    top: box.top - dy,
    right: box.right - dx,
    bottom: box.bottom - dy,
  });
  const shiftedPin = move(pin, offset.x, offset.y);
  if (!intersectsBox(shiftedPin, obstacle)) return offset;
  const shiftedCard = move(card, offset.x, offset.y);

  // Content up: the pin's bottom edge ends above the obstacle.
  const up = shiftedPin.bottom - (obstacle.top - gap);
  if (
    up > 0 &&
    insideBox(move(shiftedPin, 0, up), container, padding) &&
    insideBox(move(shiftedCard, 0, up), container, padding)
  ) {
    return { x: offset.x, y: offset.y + up + 0 };
  }

  // Content right: the pin's left edge ends to the right of the obstacle.
  const right = obstacle.right + gap - shiftedPin.left;
  if (
    right > 0 &&
    insideBox(move(shiftedPin, -right, 0), container, padding) &&
    insideBox(move(shiftedCard, -right, 0), container, padding)
  ) {
    return { x: offset.x - right + 0, y: offset.y };
  }
  return offset;
}
