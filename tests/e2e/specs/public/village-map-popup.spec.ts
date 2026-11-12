import { expect, type Locator, type Page, test } from '@playwright/test';

/**
 * GH#475: the info card of a pin stays inside the map whatever the pin's position, and on phones the
 * legend does not sit on the attribution or under the Fox launcher. Needs WebGL (the map is a canvas);
 * the pins come from the public API of the same server, the most isolated one is used so that a click on
 * it cannot land on a cluster.
 */
test.use({
  locale: 'vi-VN',
  launchOptions: {
    args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  },
});

const VIEWPORTS = [
  { width: 360, height: 740 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 },
] as const;

/** Phones get a bottom sheet instead of a popup (`max-width: 639px`). */
const PHONE_MAX = 639;
/** Unselected pin icon (PIN_HEIGHT) and the selected one (x1.3) plus the gap to the card, in px. */
const PIN_HEIGHT = 44;
const CARD_CLEARANCE_ABOVE = Math.round(PIN_HEIGHT * 1.3) + 4;
const CARD_GAP_BELOW = 4;
const EDGE = 24;

interface Pin {
  workshopId: string;
  lat: number;
  lng: number;
  household: { name: string; coverUrl: string | null };
}

/** The pin farthest from every other one, so that at zoom 16 it stands alone. */
function mostIsolated(pins: readonly Pin[]): Pin | undefined {
  const metres = (a: Pin, b: Pin) =>
    Math.hypot(
      (a.lat - b.lat) * 111_000,
      (a.lng - b.lng) * 111_000 * Math.cos((a.lat * Math.PI) / 180),
    );
  let best: { pin: Pin; gap: number } | undefined;
  for (const pin of pins) {
    const gap = Math.min(
      Number.POSITIVE_INFINITY,
      ...pins.filter((other) => other !== pin).map((other) => metres(pin, other)),
    );
    if (!best || gap > best.gap) best = { pin, gap };
  }
  return best?.pin;
}

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

const intersects = (a: Box, b: Box) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

async function box(locator: Locator): Promise<Box> {
  const found = await locator.boundingBox();
  if (!found) throw new Error('element has no box');
  return found;
}

async function openMap(page: Page, pin: Pin, phone: boolean) {
  await page.goto(`/vi/ban-do?xuong=${pin.workshopId}`);
  const frame = page.getByTestId('map-frame');
  await expect(frame.locator('canvas.maplibregl-canvas')).toBeVisible({ timeout: 30_000 });
  await frame.scrollIntoViewIfNeeded();
  // The phone sheet is plain DOM and shows before the map has drawn its pins. The map collapses its
  // attribution on its first `idle` (map-canvas.tsx), so wait for that before dragging or tapping a pin.
  // `maplibregl-compact` must be there too: before the control turns compact it has neither class.
  if (phone) {
    const attribution = frame.locator('.maplibregl-ctrl-attrib');
    await expect
      .poll(
        async () => {
          const classes = (await attribution.getAttribute('class')) ?? '';
          return /\bmaplibregl-compact\b/.test(classes) && !classes.includes('compact-show');
        },
        { message: 'map drawn (attribution collapsed on first idle)', timeout: 30_000 },
      )
      .toBe(true);
  } else {
    // The desktop card only opens once the map has loaded (it needs the pin's screen position): give
    // it the same time as the canvas above.
    await expect(frame.locator('.maplibregl-popup')).toBeVisible({ timeout: 30_000 });
  }
  return frame;
}

for (const viewport of VIEWPORTS) {
  const phone = viewport.width <= PHONE_MAX;

  test.describe(`bản đồ làng ở ${viewport.width} px`, () => {
    test.use({ viewport });

    test('thẻ thông tin của ghim nằm trọn trong khung bản đồ, kể cả ghim sát mép', async ({
      page,
    }) => {
      // Six drag-and-click rounds on a software-rendered WebGL canvas can pass the 30 s default.
      test.slow();
      const response = await page.request.get('/api/v1/map/workshops');
      expect(response.ok()).toBe(true);
      const pins = ((await response.json()) as { data: Pin[] }).data;
      const pin = mostIsolated(pins);
      test.skip(!pin, 'no workshop pins to open');
      if (!pin) return;

      const frame = await openMap(page, pin, phone);
      const card = phone
        ? frame.getByTestId('pin-sheet')
        : frame.locator('.maplibregl-popup').first();

      /** The card is fully inside the map frame (1 px slack for rounding); polled while the map pans. */
      const expectInside = async () => {
        await expect(card).toBeVisible();
        await expect
          .poll(
            async () => {
              const [c, f] = [await box(card), await box(frame)];
              return (
                c.x >= f.x - 1 &&
                c.y >= f.y - 1 &&
                c.x + c.width <= f.x + f.width + 1 &&
                c.y + c.height <= f.y + f.height + 1
              );
            },
            { message: 'info card inside the map frame', timeout: 5_000 },
          )
          .toBe(true);
        // Let a pan that is still gliding finish (the card is inside a little before it comes to rest).
        let last = await box(card);
        for (let i = 0; i < 20; i++) {
          await page.waitForTimeout(120);
          const now = await box(card);
          if (now.x === last.x && now.y === last.y) break;
          last = now;
        }
      };

      /** Name, photo, craft/workshop line, open status and the two buttons are all in the card. */
      const expectContent = async () => {
        await expect(card).toContainText(pin.household.name);
        await expect(card.locator('img, svg').first()).toBeVisible();
        await expect(
          card.getByText(/mở cửa|đóng cửa|Chỉ sản xuất|không đón khách|Chưa có giờ/i).first(),
        ).toBeVisible();
        await expect(card.getByRole('link', { name: 'Xem trang hộ' })).toBeVisible();
        await expect(card.getByRole('link', { name: 'Chỉ đường' })).toBeVisible();
        // The phone sheet scrolls: both buttons must be inside it without scrolling, not below its fold.
        const c = await box(card);
        for (const name of ['Xem trang hộ', 'Chỉ đường']) {
          const b = await box(card.getByRole('link', { name }));
          expect(b.y, `${name} below the fold of the card`).toBeGreaterThanOrEqual(c.y - 1);
          expect(b.y + b.height, `${name} below the fold of the card`).toBeLessThanOrEqual(
            c.y + c.height + 1,
          );
        }
      };

      /** Where the pin stands on the page, read back from where the card hangs on it. */
      let phonePin: { x: number; y: number } | undefined;
      const pinPoint = async () => {
        const f = await box(frame);
        // The sheet never moves the map: the pin is where the map was last dragged to (first, the centre).
        if (phone) return phonePin ?? { x: f.x + f.width / 2, y: f.y + f.height / 2 };
        const c = await box(card);
        const anchor =
          /anchor-([a-z-]+)/.exec((await card.getAttribute('class')) ?? '')?.[1] ?? 'bottom';
        const x = anchor.endsWith('left')
          ? c.x
          : anchor.endsWith('right')
            ? c.x + c.width
            : c.x + c.width / 2;
        const y = anchor.startsWith('bottom')
          ? c.y + c.height + CARD_CLEARANCE_ABOVE
          : c.y - CARD_GAP_BELOW;
        return { x, y };
      };

      await expectInside();
      await expectContent();
      await shot(page, viewport.width, 'centre');

      const edges = {
        top: (f: Box) => ({ x: f.x + f.width / 2, y: f.y + PIN_HEIGHT + 8 }),
        left: (f: Box) => ({ x: f.x + EDGE, y: f.y + f.height / 2 }),
        right: (f: Box) => ({ x: f.x + f.width - EDGE, y: f.y + f.height / 2 }),
        bottom: (f: Box) => ({ x: f.x + f.width / 2, y: f.y + f.height - EDGE }),
        'top-left': (f: Box) => ({ x: f.x + EDGE, y: f.y + PIN_HEIGHT + 8 }),
        'bottom-right': (f: Box) => ({ x: f.x + f.width - EDGE, y: f.y + f.height - EDGE }),
      };

      for (const [name, place] of Object.entries(edges)) {
        // Below 1024 px the map spans the page and the Fox launcher covers that corner: nobody can tap a pin there.
        if (viewport.width < 1024 && name === 'bottom-right') continue;
        const from = await pinPoint();
        await page.keyboard.press('Escape');
        await expect(card).toBeHidden();

        // Drag the map so that the pin stands at the chosen edge, then tap the pin itself.
        const to = place(await box(frame));
        await page.mouse.move(from.x, from.y - PIN_HEIGHT / 2);
        // The press must land on the map itself: an overlay (the legend) over the pin would swallow the drag.
        const onCanvas = await page.evaluate(
          ([x, y]) =>
            document.elementFromPoint(x, y)?.classList.contains('maplibregl-canvas') ?? false,
          [from.x, from.y - PIN_HEIGHT / 2] as [number, number],
        );
        expect(onCanvas, `${name}: selected pin is covered`).toBe(true);
        await page.mouse.down();
        await page.mouse.move(to.x, to.y - PIN_HEIGHT / 2, { steps: 15 });
        await page.waitForTimeout(250); // a still pointer on release leaves no inertia
        await page.mouse.up();
        phonePin = to;
        await page.waitForTimeout(400);

        await page.mouse.click(to.x, to.y - PIN_HEIGHT / 2);
        await expect(card, `${name}: card opens`).toBeVisible();
        await expect(card).toContainText(pin.household.name);
        await expectInside();
        await expectContent();
        if (name === 'top') await shot(page, viewport.width, 'top-edge');
      }
    });
  });
}

test.describe('chú giải bản đồ trên điện thoại', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('chú giải không đè lên ghi công bản đồ và tránh nút Cáo', async ({ page }) => {
    await page.goto('/vi/ban-do');
    const frame = page.getByTestId('map-frame');
    await expect(frame.locator('canvas.maplibregl-canvas')).toBeVisible({ timeout: 30_000 });
    await frame.scrollIntoViewIfNeeded();
    const legend = frame.getByTestId('map-legend');
    await expect(legend).toBeVisible();
    // Every line of the legend is visible, none cut off by the frame.
    for (const line of ['Đang mở cửa', 'Đang đóng cửa', 'Chỉ sản xuất']) {
      await expect(legend.getByText(line)).toBeVisible();
    }
    const attribution = frame.locator('.maplibregl-ctrl-attrib');
    await expect(attribution).toBeVisible();

    // The attribution starts as a small button once the map has drawn its first frame (it opens wide until then).
    await expect
      .poll(async () => intersects(await box(legend), await box(attribution)), {
        message: 'legend vs attribution',
        // It collapses on the map's first `idle`, which a software-rendered canvas can take a while to reach.
        timeout: 30_000,
      })
      .toBe(false);
    const [l, a, f, fox] = [
      await box(legend),
      await box(attribution),
      await box(frame),
      await box(page.getByRole('button', { name: 'Hỏi Cáo' })),
    ];
    expect(intersects(l, fox), 'legend vs Fox launcher').toBe(false);
    expect(intersects(a, fox), 'attribution vs Fox launcher').toBe(false);
    expect(l.x).toBeGreaterThanOrEqual(f.x);
    expect(l.y).toBeGreaterThanOrEqual(f.y);
    expect(l.x + l.width).toBeLessThanOrEqual(f.x + f.width);
    expect(l.y + l.height).toBeLessThanOrEqual(f.y + f.height);
    await shot(frame, 390, 'legend');
  });
});

/** Set `E2E_SHOTS_DIR` to keep a screenshot of the map after the key steps (for reviews); no-op otherwise. */
async function shot(target: Page | Locator, width: number, name: string) {
  const dir = process.env.E2E_SHOTS_DIR;
  if (dir) await target.screenshot({ path: `${dir}/${width}-${name}.png` });
}
